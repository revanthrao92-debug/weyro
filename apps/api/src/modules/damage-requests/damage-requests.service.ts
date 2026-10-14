import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDamageRequestDto } from './dto/create-damage-request.dto';

@Injectable()
export class DamageRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  // In-memory fallback cache when PostgreSQL is offline
  private memoryCache: any[] = [
    {
      id: 'req_seed_01',
      customerId: 'cust_01',
      vehicleId: 'veh_01',
      title: 'Front Bumper & Headlight Assembly',
      description:
        'Cracked lower valence and damaged LED matrix headlight unit from parking post impact. Need replacement assembly and painting.',
      category: 'REPAIR',
      urgency: 'URGENT',
      status: 'OPEN',
      address: '742 Evergreen Terrace, Springfield',
      latitude: 40.7128,
      longitude: -74.006,
      isBroadcast: true,
      damagePhotos: [
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
      ],
      fulfillmentType: 'PARTS_SHIPPING',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      vehicle: {
        make: 'BMW',
        model: '330i M-Sport',
        year: 2022,
      },
      customer: {
        firstName: 'Marcus',
        lastName: 'Vance',
      },
      quotations: [
        {
          id: 'q_01',
          providerName: 'Apex OEM Auto Dismantlers',
          providerType: 'PARTS_DEALER',
          totalCost: 1450,
          partCondition: 'OEM',
          etaDescription: '2 business days',
          notes: 'Genuine OEM LED matrix unit in pristine condition. Includes insured courier shipping.',
          status: 'PENDING',
        },
      ],
    },
  ];

  async create(dto: CreateDamageRequestDto) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || 7));

    try {
      return await this.prisma.serviceRequest.create({
        data: {
          customerId: dto.customerId,
          vehicleId: dto.vehicleId,
          category: 'REPAIR',
          title: dto.title,
          description: dto.description,
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
          urgency: dto.urgency || 'URGENT',
          status: 'OPEN',
          isBroadcast: dto.isBroadcast !== false,
          damagePhotos: dto.damagePhotos,
          fulfillmentType: dto.fulfillmentType || 'PARTS_SHIPPING',
          expiresAt,
        },
        include: {
          vehicle: true,
          quotations: true,
        },
      });
    } catch {
      // Graceful fallback for local development without DB
      const newReq = {
        id: `req_${Date.now()}`,
        ...dto,
        category: 'REPAIR',
        urgency: dto.urgency || 'URGENT',
        status: 'OPEN',
        isBroadcast: true,
        fulfillmentType: dto.fulfillmentType || 'PARTS_SHIPPING',
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        quotations: [],
      };
      this.memoryCache.unshift(newReq);
      return newReq;
    }
  }

  async getBroadcastFeed(providerLat?: number, providerLng?: number, radiusKm: number = 25) {
    try {
      return await this.prisma.serviceRequest.findMany({
        where: {
          status: 'OPEN',
          OR: [
            { isBroadcast: true }, // Broadcast to all dealers & mechanics irrespective of distance & time
          ],
        },
        include: {
          vehicle: true,
          customer: true,
          quotations: {
            include: {
              provider: true,
            },
          },
        },
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      });
    } catch {
      return this.memoryCache;
    }
  }

  async findOne(id: string) {
    try {
      const found = await this.prisma.serviceRequest.findUnique({
        where: { id },
        include: {
          vehicle: true,
          customer: true,
          quotations: {
            include: {
              provider: true,
            },
          },
        },
      });
      if (!found) throw new NotFoundException(`Request with ID ${id} not found`);
      return found;
    } catch {
      const found = this.memoryCache.find((r) => r.id === id);
      if (!found) throw new NotFoundException(`Request with ID ${id} not found`);
      return found;
    }
  }
}
