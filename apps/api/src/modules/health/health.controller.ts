import { Controller, Get, ServiceUnavailableException, Optional } from '@nestjs/common';
import { CacheService } from '../../common/redis/cache.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  getLiveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health/redis')
  async getRedisHealth() {
    if (!this.cache) return { status: 'no-redis', ok: false };
    const ok = await this.cache.ping();
    return { status: ok ? 'ok' : 'down', ok };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }
  }
}
