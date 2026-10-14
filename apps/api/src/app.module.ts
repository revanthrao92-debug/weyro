import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { DamageRequestsModule } from './modules/damage-requests/damage-requests.module';
import { QuotationsModule } from './modules/quotations/quotations.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DamageRequestsModule,
    QuotationsModule,
  ],
})
export class AppModule {}
