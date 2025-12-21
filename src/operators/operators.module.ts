import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';
import { Operator, OperatorSchema } from './schemas/operator.schema';
import { OperatorJwtStrategy } from './strategies/operator-jwt.strategy';
import { OperatorJwtAuthGuard } from './guards/operator-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'operator-jwt' }),
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [OperatorsController],
  providers: [
    OperatorsService,
    OperatorJwtStrategy,
    OperatorJwtAuthGuard,
    RolesGuard,
  ],
  exports: [OperatorsService, OperatorJwtAuthGuard, RolesGuard],
})
export class OperatorsModule {}
