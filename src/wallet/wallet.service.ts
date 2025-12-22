import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Wallet, WalletDocument } from './schemas/wallet.schema';
import {
  WalletTransaction,
  WalletTransactionDocument,
  TransactionType,
  TransactionReason,
} from './schemas/wallet-transaction.schema';
import {
  InsufficientFundsException,
  WalletNotFoundException,
  DuplicateTransactionException,
  WalletOperationFailedException,
  UserNotFoundException,
} from './exceptions/wallet.exceptions';
import { UsersService } from '../users/users.service';

export interface WalletInfo {
  userId: string;
  balance: number;
  currency: string;
}

export interface TransactionResult {
  transactionId: string;
  userId: string;
  amount: number;
  type: TransactionType;
  reason: TransactionReason;
  balanceAfter: number;
  createdAt: Date;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectModel(Wallet.name)
    private walletModel: Model<WalletDocument>,
    @InjectModel(WalletTransaction.name)
    private transactionModel: Model<WalletTransactionDocument>,
    @InjectConnection()
    private connection: Connection,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
  ) {}

  /**
   * Get wallet balance and info - O(1) read
   */
  async getWallet(userId: string): Promise<WalletInfo> {
    const wallet = await this.walletModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec();

    if (!wallet) {
      throw new WalletNotFoundException(userId);
    }

    return {
      userId: wallet.userId.toString(),
      balance: wallet.balance,
      currency: wallet.currency,
    };
  }

  /**
   * Create wallet for a user - idempotent operation
   * Verifies user exists before creating wallet
   */
  async createWallet(
    userId: string,
    currency = 'TND',
  ): Promise<WalletDocument> {
    const userObjectId = new Types.ObjectId(userId);

    // Try to find existing wallet first (idempotent)
    const existingWallet = await this.walletModel
      .findOne({ userId: userObjectId })
      .exec();

    if (existingWallet) {
      return existingWallet;
    }

    // Verify user exists before creating wallet
    try {
      await this.usersService.findOne(userId);
    } catch {
      throw new UserNotFoundException(userId);
    }

    // Create new wallet
    try {
      const wallet = new this.walletModel({
        userId: userObjectId,
        balance: 0,
        currency,
        version: 0,
      });
      return await wallet.save();
    } catch (error: any) {
      // Handle race condition - wallet may have been created by another request
      if (error.code === 11000) {
        const wallet = await this.walletModel
          .findOne({ userId: userObjectId })
          .exec();
        if (wallet) {
          return wallet;
        }
      }
      throw error;
    }
  }

  /**
   * Credit wallet - add funds with atomic transaction
   * Idempotent if referenceId is provided
   */
  async creditWallet(
    userId: string,
    amount: number,
    reason: TransactionReason,
    referenceId?: string,
  ): Promise<TransactionResult> {
    if (amount <= 0) {
      throw new WalletOperationFailedException('Amount must be positive');
    }

    const userObjectId = new Types.ObjectId(userId);
    const refObjectId = referenceId
      ? new Types.ObjectId(referenceId)
      : undefined;

    // Check idempotency - if referenceId exists, return existing transaction
    if (refObjectId) {
      const existingTx = await this.transactionModel
        .findOne({ referenceId: refObjectId })
        .lean()
        .exec();

      if (existingTx) {
        this.logger.log(
          `Duplicate transaction detected for referenceId: ${referenceId}`,
        );
        return {
          transactionId: existingTx._id.toString(),
          userId: existingTx.userId.toString(),
          amount: existingTx.amount,
          type: existingTx.type,
          reason: existingTx.reason,
          balanceAfter: existingTx.balanceAfter,
          createdAt: existingTx.createdAt!,
        };
      }
    }

    const session = await this.connection.startSession();

    try {
      let result: TransactionResult | null = null;

      await session.withTransaction(async () => {
        // Update wallet balance atomically using $inc
        const wallet = await this.walletModel
          .findOneAndUpdate(
            { userId: userObjectId },
            {
              $inc: { balance: amount, version: 1 },
            },
            { new: true, session },
          )
          .exec();

        if (!wallet) {
          throw new WalletNotFoundException(userId);
        }

        // Create ledger transaction
        const transaction = new this.transactionModel({
          userId: userObjectId,
          amount: amount, // Positive for credit
          type: TransactionType.CREDIT,
          reason,
          referenceId: refObjectId,
          balanceAfter: wallet.balance,
        });

        await transaction.save({ session });

        result = {
          transactionId: transaction._id.toString(),
          userId: userId,
          amount: amount,
          type: TransactionType.CREDIT,
          reason,
          balanceAfter: wallet.balance,
          createdAt: transaction.createdAt!,
        };
      });

      if (!result) {
        throw new WalletOperationFailedException('Transaction failed');
      }

      return result;
    } catch (error) {
      if (
        error instanceof WalletNotFoundException ||
        error instanceof DuplicateTransactionException
      ) {
        throw error;
      }
      this.logger.error(`Credit wallet failed: ${error}`);
      throw new WalletOperationFailedException('Failed to credit wallet');
    } finally {
      await session.endSession();
    }
  }

  /**
   * Debit wallet - subtract funds with atomic transaction
   * Validates sufficient balance inside the update operation
   * Idempotent if referenceId is provided
   */
  async debitWallet(
    userId: string,
    amount: number,
    reason: TransactionReason,
    referenceId?: string,
  ): Promise<TransactionResult> {
    if (amount <= 0) {
      throw new WalletOperationFailedException('Amount must be positive');
    }

    const userObjectId = new Types.ObjectId(userId);
    const refObjectId = referenceId
      ? new Types.ObjectId(referenceId)
      : undefined;

    // Check idempotency - if referenceId exists, return existing transaction
    if (refObjectId) {
      const existingTx = await this.transactionModel
        .findOne({ referenceId: refObjectId })
        .lean()
        .exec();

      if (existingTx) {
        this.logger.log(
          `Duplicate transaction detected for referenceId: ${referenceId}`,
        );
        return {
          transactionId: existingTx._id.toString(),
          userId: existingTx.userId.toString(),
          amount: existingTx.amount,
          type: existingTx.type,
          reason: existingTx.reason,
          balanceAfter: existingTx.balanceAfter,
          createdAt: existingTx.createdAt!,
        };
      }
    }

    const session = await this.connection.startSession();

    try {
      let result: TransactionResult | null = null;

      await session.withTransaction(async () => {
        // Conditional update: only succeed if balance >= amount
        const wallet = await this.walletModel
          .findOneAndUpdate(
            {
              userId: userObjectId,
              balance: { $gte: amount }, // Guard: sufficient balance
            },
            {
              $inc: { balance: -amount, version: 1 },
            },
            { new: true, session },
          )
          .exec();

        if (!wallet) {
          // Determine if wallet doesn't exist or insufficient funds
          const existingWallet = await this.walletModel
            .findOne({ userId: userObjectId })
            .session(session)
            .lean()
            .exec();

          if (!existingWallet) {
            throw new WalletNotFoundException(userId);
          }

          throw new InsufficientFundsException(
            `Insufficient balance: ${existingWallet.balance} < ${amount}`,
          );
        }

        // Create ledger transaction
        const transaction = new this.transactionModel({
          userId: userObjectId,
          amount: -amount, // Negative for debit
          type: TransactionType.DEBIT,
          reason,
          referenceId: refObjectId,
          balanceAfter: wallet.balance,
        });

        await transaction.save({ session });

        result = {
          transactionId: transaction._id.toString(),
          userId: userId,
          amount: -amount,
          type: TransactionType.DEBIT,
          reason,
          balanceAfter: wallet.balance,
          createdAt: transaction.createdAt!,
        };
      });

      if (!result) {
        throw new WalletOperationFailedException('Transaction failed');
      }

      return result;
    } catch (error) {
      if (
        error instanceof WalletNotFoundException ||
        error instanceof InsufficientFundsException ||
        error instanceof DuplicateTransactionException
      ) {
        throw error;
      }
      this.logger.error(`Debit wallet failed: ${error}`);
      throw new WalletOperationFailedException('Failed to debit wallet');
    } finally {
      await session.endSession();
    }
  }

  /**
   * Rebuild wallet balance from ledger transactions (admin only)
   * Aggregates all transactions and recalculates balance
   */
  async rebuildWallet(userId: string): Promise<WalletInfo> {
    const userObjectId = new Types.ObjectId(userId);

    // Verify wallet exists
    const wallet = await this.walletModel
      .findOne({ userId: userObjectId })
      .exec();

    if (!wallet) {
      throw new WalletNotFoundException(userId);
    }

    // Aggregate all transactions to compute balance
    const aggregation = await this.transactionModel
      .aggregate([
        { $match: { userId: userObjectId } },
        {
          $group: {
            _id: '$userId',
            totalBalance: { $sum: '$amount' },
          },
        },
      ])
      .exec();

    const computedBalance =
      aggregation.length > 0 ? aggregation[0].totalBalance : 0;

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // Update wallet with computed balance
        await this.walletModel
          .updateOne(
            { userId: userObjectId },
            {
              $set: { balance: computedBalance },
              $inc: { version: 1 },
            },
            { session },
          )
          .exec();
      });

      this.logger.log(
        `Wallet rebuilt for user ${userId}: previous=${wallet.balance}, computed=${computedBalance}`,
      );

      return {
        userId: userId,
        balance: computedBalance,
        currency: wallet.currency,
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get wallet transaction history
   */
  async getTransactions(
    userId: string,
    options?: { limit?: number; skip?: number },
  ): Promise<WalletTransactionDocument[]> {
    const userObjectId = new Types.ObjectId(userId);

    return this.transactionModel
      .find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .skip(options?.skip || 0)
      .limit(options?.limit || 50)
      .exec();
  }

  /**
   * Check if wallet exists for user
   */
  async walletExists(userId: string): Promise<boolean> {
    const count = await this.walletModel
      .countDocuments({ userId: new Types.ObjectId(userId) })
      .exec();
    return count > 0;
  }

  /**
   * Get all wallets (admin only)
   */
  async getAllWallets(options?: {
    limit?: number;
    skip?: number;
  }): Promise<{ wallets: WalletDocument[]; total: number }> {
    const [wallets, total] = await Promise.all([
      this.walletModel
        .find()
        .populate('userId', 'phone firstName lastName email')
        .sort({ updatedAt: -1 })
        .skip(options?.skip || 0)
        .limit(options?.limit || 50)
        .exec(),
      this.walletModel.countDocuments().exec(),
    ]);

    return { wallets, total };
  }

  /**
   * Get all transactions (admin only)
   */
  async getAllTransactions(options?: {
    limit?: number;
    skip?: number;
    userId?: string;
    type?: TransactionType;
    reason?: TransactionReason;
  }): Promise<{ transactions: WalletTransactionDocument[]; total: number }> {
    const query: any = {};

    if (options?.userId) {
      query.userId = new Types.ObjectId(options.userId);
    }
    if (options?.type) {
      query.type = options.type;
    }
    if (options?.reason) {
      query.reason = options.reason;
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .populate('userId', 'phone firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(options?.skip || 0)
        .limit(options?.limit || 50)
        .exec(),
      this.transactionModel.countDocuments(query).exec(),
    ]);

    return { transactions, total };
  }

  /**
   * Get wallet by userId (admin only)
   */
  async getWalletByUserId(userId: string): Promise<WalletDocument | null> {
    return this.walletModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'phone firstName lastName email')
      .exec();
  }

  /**
   * Admin credit wallet for a user
   */
  async adminCreditWallet(
    userId: string,
    amount: number,
    reason: TransactionReason,
  ): Promise<TransactionResult> {
    // Ensure wallet exists
    const exists = await this.walletExists(userId);
    if (!exists) {
      await this.createWallet(userId);
    }

    return this.creditWallet(userId, amount, reason);
  }
}
