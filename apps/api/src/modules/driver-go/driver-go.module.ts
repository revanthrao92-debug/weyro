import { Module } from '@nestjs/common';
import { DriverGoController } from './driver-go.controller';
import { DriverGoService } from './driver-go.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DriverGoController],
  providers: [DriverGoService],
  exports: [DriverGoService],
})
export class DriverGoModule {}
