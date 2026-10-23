import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';
import { toPublicProvider } from '../../common/serializers/public-provider';
import { UpdateProviderProfileDto } from './dto/providers.dto';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  private providerId(user: AuthUserPayload): string {
    if (!user.providerProfileId) {
      throw new ForbiddenException('Provider profile required');
    }
    return user.providerProfileId;
  }

  async getMyProfile(user: AuthUserPayload) {
    const id = this.providerId(user);
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, phone: true, isActive: true } },
        _count: {
          select: {
            quotations: true,
            bookings: true,
            reviews: true,
            spareParts: true,
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const { user: account, _count, ...profile } = provider;
    return {
      ...profile,
      email: account.email,
      accountPhone: account.phone,
      isActive: account.isActive,
      counts: {
        quotations: _count.quotations,
        bookings: _count.bookings,
        reviews: _count.reviews,
        listings: _count.spareParts,
      },
    };
  }

  async updateMyProfile(
    user: AuthUserPayload,
    dto: UpdateProviderProfileDto,
  ) {
    const id = this.providerId(user);
    return this.prisma.providerProfile.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Public provider page. Deliberately excludes phone, exact address and KYC
   * documents: customers only get the marketing-safe projection.
   */
  async getPublicProfile(id: string) {
    const provider = await this.prisma.providerProfile.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        businessName: true,
        providerType: true,
        description: true,
        serviceRadiusKm: true,
        verificationStatus: true,
        avgRating: true,
        totalReviews: true,
        completedJobs: true,
        isAvailable: true,
        towingVehicleTypes: true,
        maxVehicleWeightKg: true,
        towingBaseFee: true,
        towingPerKmFee: true,
      },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const base = toPublicProvider(provider);
    return {
      ...base,
      towingVehicleTypes: provider.towingVehicleTypes,
      maxVehicleWeightKg: provider.maxVehicleWeightKg ?? null,
      towingBaseFee: provider.towingBaseFee
        ? Number(provider.towingBaseFee)
        : null,
      towingPerKmFee: provider.towingPerKmFee
        ? Number(provider.towingPerKmFee)
        : null,
    };
  }

  async getPublicReviews(id: string, cursor?: string, limit: number = 20) {
    const boundedLimit = Math.min(50, Math.max(1, limit));
    const cursorTuple = cursor ? decodeCursor(cursor) : null;

    const provider = await this.prisma.providerProfile.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const reviews = await this.prisma.review.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        providerId: id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    return {
      items: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        customerName: `${review.customer.firstName} ${
          review.customer.lastName
            ? `${review.customer.lastName.charAt(0)}.`
            : ''
        }`.trim(),
      })),
      nextCursor:
        reviews.length === boundedLimit
          ? encodeCursor({
              createdAt: reviews[reviews.length - 1].createdAt.toISOString(),
              id: reviews[reviews.length - 1].id,
            })
          : null,
    };
  }
}
