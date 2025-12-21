import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { PayWalletDto } from './dto/pay-wallet.dto';
import { TransactionReason } from './schemas/wallet-transaction.schema';
import { WalletNotFoundException } from './exceptions/wallet.exceptions';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Ensure wallet exists for user, create if not (lazy initialization)
   */
  private async ensureWalletExists(userId: string): Promise<void> {
    const exists = await this.walletService.walletExists(userId);
    if (!exists) {
      await this.walletService.createWallet(userId);
    }
  }

  /**
   * Get current wallet balance
   * GET /api/v1/wallet
   */
  @Get()
  async getWallet(@Req() req: any) {
    const userId = req.user.sub || req.user.userId;

    // Lazy wallet creation for existing users without wallets
    await this.ensureWalletExists(userId);

    const wallet = await this.walletService.getWallet(userId);

    return {
      success: true,
      data: wallet,
    };
  }

  /**
   * Get wallet transaction history
   * GET /api/v1/wallet/transactions
   */
  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    const userId = req.user.sub || req.user.userId;
    const transactions = await this.walletService.getTransactions(userId, {
      limit: limit || 50,
      skip: skip || 0,
    });

    return {
      success: true,
      data: transactions,
      count: transactions.length,
    };
  }

  /**
   * Top up wallet (add funds)
   * POST /api/v1/wallet/topup
   */
  @Post('topup')
  @HttpCode(HttpStatus.OK)
  async topup(@Req() req: any, @Body() topupDto: TopupWalletDto) {
    const userId = req.user.sub || req.user.userId;

    // Lazy wallet creation for existing users without wallets
    await this.ensureWalletExists(userId);

    const result = await this.walletService.creditWallet(
      userId,
      topupDto.amount,
      TransactionReason.TOPUP,
      topupDto.referenceId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Pay from wallet (deduct funds)
   * POST /api/v1/wallet/pay
   */
  @Post('pay')
  @HttpCode(HttpStatus.OK)
  async pay(@Req() req: any, @Body() payDto: PayWalletDto) {
    const userId = req.user.sub || req.user.userId;

    // Ensure wallet exists (but don't create - payment requires existing wallet with balance)
    const exists = await this.walletService.walletExists(userId);
    if (!exists) {
      throw new WalletNotFoundException(userId);
    }

    const result = await this.walletService.debitWallet(
      userId,
      payDto.amount,
      payDto.reason || TransactionReason.PARKING_PAYMENT,
      payDto.referenceId,
    );

    return {
      success: true,
      data: result,
    };
  }
}
