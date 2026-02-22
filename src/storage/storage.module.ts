import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryStorageDriver } from './drivers/cloudinary.storage.driver';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CloudinaryStorageDriver],
  exports: [CloudinaryStorageDriver],
})
export class StorageModule {}
