import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ParkingSessionsModule } from './parking-sessions/parking-sessions.module';
import { ParkingZonesModule } from './parking-zones/parking-zones.module';
import { QrCodesModule } from './qr-codes/qr-codes.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { TicketTokensModule } from './ticket-tokens/ticket-tokens.module';
import { AgentsModule } from './agents/agents.module';
import { StreetsModule } from './streets/streets.module';
import { OperatorsModule } from './operators/operators.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ParkingSessionsModule,
    ParkingZonesModule,
    QrCodesModule,
    UsersModule,
    AuthModule,
    TicketsModule,
    TicketTokensModule,
    AgentsModule,
    StreetsModule,
    OperatorsModule,
    WalletModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
