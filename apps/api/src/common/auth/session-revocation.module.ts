import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SessionRevocationService } from './session-revocation.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SessionRevocationService],
  exports: [SessionRevocationService],
})
export class SessionRevocationModule {}
