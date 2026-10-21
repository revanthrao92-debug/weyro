import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDamageRequestDto } from './dto/create-damage-request.dto';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { getProviderFeedQuery } from '@weyro/database';

@Injectable()
export class DamageRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private formatRequest(req: any) {
    if (!req) return req;
    const damagePhotos = req.media
      ? req.media.map((m: any) => m.url)
      : req.damagePhotos || [];
    return {
      ...req,
      damagePhotos,
    };
  }

  async create(customerId: string, dto: CreateDamageRequestDto) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || 7));

    const created = await this.prisma.serviceRequest.create({
      data: {
        customerId,
        vehicleId: dto.vehicleId,
        category: (dto.category as any) || 'REPAIR',
        title: dto.title,
        description: dto.description,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        urgency: dto.urgency || 'URGENT',
        status: 'OPEN',
        isBroadcast: dto.isBroadcast !== false,
        fulfillmentType: dto.fulfillmentType || 'PARTS_SHIPPING',
        expiresAt,
        media:
          (dto.mediaUrls?.length || dto.damagePhotos?.length)
            ? {
                create: (dto.mediaUrls?.length ? dto.mediaUrls : dto.damagePhotos!).map((url) => ({
                  url,
                  fileType: 'image/jpeg',
                })),
              }
            : undefined,
      },
      include: {
        media: true,
        vehicle: true,
        quotations: true,
      },
    });

    return this.formatRequest(created);
  }

  async getBroadcastFeed(params: {
    providerLat?: number;
    providerLng?: number;
    radiusKm?: number;
    category?: string;
    cursor?: string;
    limit?: number;
  }) {
    const boundedLimit = Math.min(50, Math.max(1, params.limit || 20));

    if (
      typeof params.providerLat === 'number' &&
      typeof params.providerLng === 'number'
    ) {
      let cursorItem: { createdAt: Date; id: string } | null = null;
      if (params.cursor) {
        cursorItem = await this.prisma.serviceRequest.findUnique({
          where: { id: params.cursor },
          select: { createdAt: true, id: true },
        });
      }

      const query = getProviderFeedQuery({
        providerLat: params.providerLat,
        providerLng: params.providerLng,
        radiusKm: params.radiusKm || 25,
        category: params.category,
        limit: boundedLimit,
        cursorCreatedAt: cursorItem?.createdAt,
        cursorId: cursorItem?.id,
      });

      const rawResults = await this.prisma.$queryRaw<any[]>(query);
      const items = rawResults.map((req) => ({
        ...req,
        address: this.maskAddress(req.address),
      }));

      return {
        items,
        nextCursor: items.length === boundedLimit ? items[items.length - 1].id : null,
      };
    }

    const where: any = {
      status: 'OPEN',
      isBroadcast: true,
      expiresAt: { gt: new Date() },
    };
    if (params.category) {
      where.category = params.category;
    }

    const requests = await this.prisma.serviceRequest.findMany({
      where,
      include: {
        media: true,
        vehicle: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        quotations: {
          include: {
            provider: true,
          },
        },
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      take: boundedLimit,
      skip: params.cursor ? 1 : 0,
      cursor: params.cursor ? { id: params.cursor } : undefined,
    });

    const items = requests.map((req) => ({
      ...this.formatRequest(req),
      address: this.maskAddress(req.address),
    }));

    return {
      items,
      nextCursor: items.length === boundedLimit ? items[items.length - 1].id : null,
    };
  }

  async findOne(id: string, user: AuthUserPayload) {
    const found = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        media: true,
        vehicle: true,
        customer: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        quotations: {
          include: {
            provider: true,
            booking: true,
          },
        },
      },
    });

    if (!found) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    const isCustomerOwner =
      user.customerProfileId && found.customerId === user.customerProfileId;
    const isAdmin = user.role === 'ADMIN';

    // Check if provider has an accepted booking on this request
    const acceptedQuotationForProvider = found.quotations.find(
      (q) =>
        q.providerId === user.providerProfileId &&
        q.status === 'ACCEPTED' &&
        q.booking !== null,
    );

    const hasAcceptedBooking = Boolean(acceptedQuotationForProvider);

    // If caller is customer: must be the owner
    if (user.role === 'CUSTOMER' && !isCustomerOwner && !isAdmin) {
      throw new ForbiddenException('You can only access your own requests');
    }

    // Privacy protection: Redact customer contact & exact address for providers until quote accepted
    if (!isCustomerOwner && !isAdmin && !hasAcceptedBooking) {
      const sanitizedCustomer = {
        id: found.customer.id,
        firstName: found.customer.firstName,
        lastName: found.customer.lastName,
        avatarUrl: found.customer.avatarUrl,
      };

      return {
        ...found,
        address: this.maskAddress(found.address),
        customer: sanitizedCustomer,
      };
    }

    return found;
  }

  private maskAddress(fullAddress: string): string {
    if (!fullAddress) return 'Location specified upon booking';
    const parts = fullAddress.split(',');
    // If multiple parts, return the city/area only
    if (parts.length >= 2) {
      return parts
        .slice(-2)
        .map((p) => p.trim())
        .join(', ');
    }
    return fullAddress.replace(/^\d+[\w\s]+,\s*/, '').trim();
  }
}
