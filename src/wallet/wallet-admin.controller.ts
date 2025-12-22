import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { OperatorJwtAuthGuard } from '../operators/guards/operator-jwt-auth.guard';
import { RolesGuard } from '../operators/guards/roles.guard';
import { Roles } from '../operators/decorators/roles.decorator';
import { OperatorRole } from '../operators/schemas/operator.schema';
import {
  TransactionType,
  TransactionReason,
} from './schemas/wallet-transaction.schema';

@Controller('wallets')
@UseGuards(OperatorJwtAuthGuard, RolesGuard)
@Roles(OperatorRole.ADMIN)
export class WalletAdminController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Get all wallets (admin only)
   * GET /api/v1/wallets
   */
  @Get()
  async getAllWallets(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const { wallets, total } = await this.walletService.getAllWallets({
      limit: limit ? parseInt(limit, 10) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
    });

    return {
      success: true,
      data: wallets,
      count: wallets.length,
      total,
    };
  }

  /**
   * Get wallet by user ID (admin only)
   * GET /api/v1/wallets/user/:userId
   */
  @Get('user/:userId')
  async getWalletByUser(@Param('userId') userId: string) {
    const wallet = await this.walletService.getWalletByUserId(userId);

    return {
      success: true,
      data: wallet,
    };
  }

  /**
   * Get all transactions (admin only)
   * GET /api/v1/wallets/transactions
   */
  @Get('transactions')
  async getAllTransactions(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('userId') userId?: string,
    @Query('type') type?: TransactionType,
    @Query('reason') reason?: TransactionReason,
  ) {
    const { transactions, total } = await this.walletService.getAllTransactions(
      {
        limit: limit ? parseInt(limit, 10) : 50,
        skip: skip ? parseInt(skip, 10) : 0,
        userId,
        type,
        reason,
      },
    );

    return {
      success: true,
      data: transactions,
      count: transactions.length,
      total,
    };
  }

  /**
   * Get transactions for a specific user (admin only)
   * GET /api/v1/wallets/user/:userId/transactions
   */
  @Get('user/:userId/transactions')
  async getUserTransactions(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const transactions = await this.walletService.getTransactions(userId, {
      limit: limit ? parseInt(limit, 10) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
    });

    return {
      success: true,
      data: transactions,
      count: transactions.length,
    };
  }

  /**
   * Credit a user's wallet (admin only)
   * POST /api/v1/wallets/user/:userId/credit
   */
  @Post('user/:userId/credit')
  @HttpCode(HttpStatus.OK)
  async creditUserWallet(
    @Param('userId') userId: string,
    @Body() body: { amount: number; reason?: TransactionReason },
  ) {
    const result = await this.walletService.adminCreditWallet(
      userId,
      body.amount,
      body.reason || TransactionReason.ADJUSTMENT,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Rebuild a user's wallet balance from ledger (admin only)
   * POST /api/v1/wallets/user/:userId/rebuild
   */
  @Post('user/:userId/rebuild')
  @Roles(OperatorRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async rebuildWallet(@Param('userId') userId: string) {
    const result = await this.walletService.rebuildWallet(userId);

    return {
      success: true,
      data: result,
      message: 'Wallet balance rebuilt from ledger',
    };
  }
}
