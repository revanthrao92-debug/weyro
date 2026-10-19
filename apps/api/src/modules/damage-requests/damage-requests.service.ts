import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDamageRequestDto } from './dto/create-damage-request.dto';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

@Injectable()
export class DamageRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadMedia(body: {
    base64?: string;
    filename?: string;
    mimeType?: string;
    url?: string;
  }) {
    if (body.url && body.url.startsWith('http')) {
      return { url: body.url };
    }
    if (body.base64) {
      const fs = await import('fs');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const ext = body.mimeType?.includes('png') ? 'png' : 'jpg';
      const filename = `damage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const filePath = path.join(uploadsDir, filename);
      const cleanBase64 = body.base64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));
      const host = process.env.API_HOST || 'http://localhost:4000';
      return { url: `${host}/uploads/${filename}` };
    }
    return {
      url:
        body.url ||
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    };
  }

  async create(customerId: string, dto: CreateDamageRequestDto) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || 7));

    return await this.prisma.serviceRequest.create({
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
        damagePhotos: dto.damagePhotos || [],
        fulfillmentType: dto.fulfillmentType || 'PARTS_SHIPPING',
        expiresAt,
      },
      include: {
        vehicle: true,
        quotations: true,
      },
    });
  }

  async getBroadcastFeed(
    providerLat?: number,
    providerLng?: number,
    radiusKm: number = 25,
  ) {
    const requests = await this.prisma.serviceRequest.findMany({
      where: {
        status: 'OPEN',
        isBroadcast: true,
        expiresAt: { gt: new Date() },
      },
      include: {
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
      take: 50,
    });

    // Privacy masking: never expose exact address or customer contact in broadcast feed
    return requests.map((req) => ({
      ...req,
      address: this.maskAddress(req.address),
    }));
  }

  async findOne(id: string, user: AuthUserPayload) {
    const found = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
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
      return parts.slice(-2).join(', ').trim();
    }
    return fullAddress.replace(/^\d+[\w\s]+,\s*/, '');
  }
}
