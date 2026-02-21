import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LicensePlateBadgesController } from './license-plate-badges.controller';
import { LicensePlateBadgesService } from './license-plate-badges.service';
import {
  LicensePlateBadge,
  LicensePlateBadgeSchema,
} from './schemas/license-plate-badge.schema';
import { AgentsModule } from '../agents/agents.module';
import { OperatorsModule } from '../operators/operators.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LicensePlateBadge.name, schema: LicensePlateBadgeSchema },
    ]),
    AgentsModule,
    OperatorsModule,
  ],
  controllers: [LicensePlateBadgesController],
  providers: [LicensePlateBadgesService],
  exports: [LicensePlateBadgesService],
})
export class LicensePlateBadgesModule {}
