import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  // Enable CORS
  const allowedOrigins =
    configService.get<string>('CORS_ORIGINS')?.split(',') || [];
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      // Allow Vercel preview/production URLs
      if (origin.includes('vercel.app') || origin.includes('.vercel.app')) {
        return callback(null, true);
      }
      // Allow configured origins from env
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // In development, allow all
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      callback(null, true); // Allow all for now, can be restricted later
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Auto-transform payloads
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  await app.listen(port);
  console.log(`🚀 ParkUp API running on: http://localhost:${port}/api/v1`);
  console.log(`🔌 WebSocket available at: ws://localhost:${port}/parking-sessions`);
}
bootstrap();
