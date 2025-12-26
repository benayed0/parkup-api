import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent, AgentSchema } from './schemas/agent.schema';
import { AgentJwtStrategy } from './strategies/agent-jwt.strategy';
import { AgentJwtAuthGuard } from './guards/agent-jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }]),
    PassportModule.register({ defaultStrategy: 'agent-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AgentJwtStrategy, AgentJwtAuthGuard],
  exports: [AgentsService, AgentJwtAuthGuard],
})
export class AgentsModule {}
