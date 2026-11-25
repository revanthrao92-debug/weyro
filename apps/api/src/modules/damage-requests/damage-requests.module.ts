import { Module } from '@nestjs/common';
import { DamageRequestsController } from './damage-requests.controller';
import { DamageRequestsService } from './damage-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DamageRequestsController],
  providers: [DamageRequestsService],
  exports: [DamageRequestsService],
})
export class DamageRequestsModule {}
