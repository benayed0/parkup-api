import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { TicketTokensService } from './ticket-tokens.service';
import { TicketToken, TicketTokenSchema } from './schemas/ticket-token.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: TicketToken.name, schema: TicketTokenSchema },
    ]),
  ],
  controllers: [],
  providers: [TicketTokensService],
  exports: [TicketTokensService],
})
export class TicketTokensModule {}
