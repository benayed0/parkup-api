import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket, TicketSchema } from './schemas/ticket.schema';
import { TicketTokensModule } from '../ticket-tokens/ticket-tokens.module';
import { OperatorsModule } from '../operators/operators.module';
import { AgentsModule } from '../agents/agents.module';
import { ZoneAccessGuard } from '../shared/auth/zone-access.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }]),
    forwardRef(() => TicketTokensModule),
    ConfigModule,
    OperatorsModule,
    AgentsModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, ZoneAccessGuard],
  exports: [TicketsService],
})
export class TicketsModule {}
