import { Module } from '@nestjs/common';
import { DamageRequestsController } from './damage-requests.controller';
import { DamageRequestsService } from './damage-requests.service';

@Module({
  controllers: [DamageRequestsController],
  providers: [DamageRequestsService],
  exports: [DamageRequestsService],
})
export class DamageRequestsModule {}
