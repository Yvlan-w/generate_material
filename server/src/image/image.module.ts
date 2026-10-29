import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ImageController],
  providers: [ImageService],
  exports: [ImageService]
})
export class ImageModule {}