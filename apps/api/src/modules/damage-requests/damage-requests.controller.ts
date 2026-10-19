import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DamageRequestsService } from './damage-requests.service';
import { CreateDamageRequestDto } from './dto/create-damage-request.dto';

@Controller('damage-requests')
export class DamageRequestsController {
  constructor(private readonly service: DamageRequestsService) {}

  @Post('upload')
  async uploadMedia(
    @Body() body: { base64?: string; filename?: string; mimeType?: string; url?: string }
  ) {
    return this.service.uploadMedia(body);
  }

  @Post()
  async create(@Body() dto: CreateDamageRequestDto) {
    return this.service.create(dto);
  }

  @Get('broadcast-feed')
  async getBroadcastFeed(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string
  ) {
    return this.service.getBroadcastFeed(
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      radiusKm ? parseFloat(radiusKm) : 25
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
