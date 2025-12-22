import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletController } from './wallet.controller';
import { WalletAdminController } from './wallet-admin.controller';
import { WalletService } from './wallet.service';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from './schemas/wallet-transaction.schema';
import { UsersModule } from '../users/users.module';
import { OperatorsModule } from '../operators/operators.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => OperatorsModule),
  ],
  controllers: [WalletController, WalletAdminController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
