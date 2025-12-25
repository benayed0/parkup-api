import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { TicketTokensController } from './ticket-tokens.controller';
import { TicketTokensService } from './ticket-tokens.service';
import { TicketToken, TicketTokenSchema } from './schemas/ticket-token.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: TicketToken.name, schema: TicketTokenSchema },
    ]),
  ],
  controllers: [TicketTokensController],
  providers: [TicketTokensService],
  exports: [TicketTokensService],
})
export class TicketTokensModule {}
