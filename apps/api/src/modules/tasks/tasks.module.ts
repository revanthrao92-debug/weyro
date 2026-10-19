import { Module } from '@nestjs/common';
import { ExpiryCronService } from './expiry-cron.service';

@Module({
  providers: [ExpiryCronService],
  exports: [ExpiryCronService],
})
export class TasksModule {}
