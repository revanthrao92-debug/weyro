import { Module } from '@nestjs/common';
import { DriverGoController } from './driver-go.controller';
import { DriverGoCustomerController } from './driver-go-customer.controller';
import { DriverGoService } from './driver-go.service';
import { DriverGoCustomerService } from './driver-go-customer.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DriverGoController, DriverGoCustomerController],
  providers: [DriverGoService, DriverGoCustomerService],
  exports: [DriverGoService, DriverGoCustomerService],
})
export class DriverGoModule {}
