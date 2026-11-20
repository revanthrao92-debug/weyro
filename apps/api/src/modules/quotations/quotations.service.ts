import { serializeBooking } from './booking-serializer';
import { resolveRequestVehicle } from '../../common/serializers/request-vehicle';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/create-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { validateQuotationTransition, validateServiceRequestTransition } from '../../common/state-machines/state-machines';
import { NotificationsService } from '../notifications/notifications.service';
import { estimateTowingFare, PROVIDER_TYPE_CATEGORIES, TOWING_TARIFF } from '@weyro/api-contracts';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';
import { toPublicProvider } from '../../common/serializers/public-provider';

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    requestId: string,
    providerId: string,
    dto: CreateQuotationDto,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { customer: true },
    });

    if (!request) {
      throw new NotFoundException(`Service request with ID ${requestId} not found`);
    }

    if (
      request.status !== 'OPEN' &&
      request.status !== 'QUOTES_RECEIVED'
    ) {
      throw new BadRequestException(
        `Cannot submit quotation: request is currently ${request.status}`,
      );
    }

    if (request.expiresAt < new Date()) {
      throw new BadRequestException('Cannot submit quotation: request has expired');
    }

    const providerProfile = await this.prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: {
        providerType: true,
        towingVehicleTypes: true,
        maxVehicleWeightKg: true,
        towingBaseFee: true,
        towingPerKmFee: true,
      },
    });

    // Enforce category / equipment / capacity matching before quoting.
    if (providerProfile) {
      const allowedCategories =
        PROVIDER_TYPE_CATEGORIES[providerProfile.providerType];
      if (
        allowedCategories &&
        !allowedCategories.includes(request.category)
      ) {
        throw new ForbiddenException(
          'This request does not match your provider service category',
        );
      }

      if (request.category === 'TOWING') {
        const supported = providerProfile.towingVehicleTypes ?? [];
        if (
          supported.length > 0 &&
          !supported.includes('ANY') &&
          request.towingVehicleType &&
          request.towingVehicleType !== 'ANY' &&
          !supported.includes(request.towingVehicleType)
        ) {
          throw new BadRequestException(
            'Your towing equipment does not match this request',
          );
        }

        if (
          typeof providerProfile.maxVehicleWeightKg === 'number' &&
          typeof request.vehicleWeightKg === 'number' &&
          request.vehicleWeightKg > providerProfile.maxVehicleWeightKg
        ) {
          throw new BadRequestException(
            'This vehicle exceeds your maximum towing capacity',
          );
        }
      }
    }

    // Compute total cost server-side. Towing is priced from distance using the
    // provider's tariff (falling back to the platform tariff) rather than a
    // free-form job quote.
    let parts = Number(dto.partsCost || 0);
    let labour = Number(dto.labourCost || 0);
    let shipping = Number(dto.shippingCost || 0);
    let totalCost = parts + labour + shipping;

    if (request.category === 'TOWING') {
      const baseFee =
        providerProfile?.towingBaseFee != null
          ? Number(providerProfile.towingBaseFee)
          : TOWING_TARIFF.baseFee;
      const perKmFee =
        providerProfile?.towingPerKmFee != null
          ? Number(providerProfile.towingPerKmFee)
          : TOWING_TARIFF.perKmFee;

      totalCost = estimateTowingFare(request.towingDistanceKm ?? 0, {
        baseFee,
        perKmFee,
        minimumFare: TOWING_TARIFF.minimumFare,
      });
      parts = 0;
      labour = totalCost;
      shipping = 0;
    }

    // The unique constraint on (requestId, providerId) is the source of truth for
    // duplicate quotes. Re-check request state inside the transaction so a request
    // accepted concurrently cannot receive a late quote or be downgraded.
    const quote = await this.prisma
      .$transaction(async (tx) => {
        const current = await tx.serviceRequest.findUnique({
          where: { id: requestId },
          select: { status: true, expiresAt: true },
        });

        if (!current) {
          throw new NotFoundException(
            `Service request with ID ${requestId} not found`,
          );
        }

        if (current.status !== 'OPEN' && current.status !== 'QUOTES_RECEIVED') {
          throw new BadRequestException(
            `Cannot submit quotation: request is currently ${current.status}`,
          );
        }

        if (current.expiresAt < new Date()) {
          throw new BadRequestException(
            'Cannot submit quotation: request has expired',
          );
        }

        const created = await tx.quotation.create({
          data: {
            requestId,
            providerId,
            partsCost: parts,
            labourCost: labour,
            shippingCost: shipping,
            totalCost,
            partCondition: (dto.partCondition as any) || 'OEM',
            warrantyDays: dto.warrantyDays || 30,
            etaDescription: dto.etaDescription,
            deliveryMethod: dto.deliveryMethod || 'DOORSTEP_DELIVERY',
            notes: dto.notes,
            status: 'PENDING',
          },
          include: {
            provider: true,
          },
        });

        if (current.status === 'OPEN') {
          await tx.serviceRequest.updateMany({
            where: { id: requestId, status: 'OPEN' },
            data: { status: 'QUOTES_RECEIVED' },
          });
        }

        return created;
      })
      .catch((error) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'You have already submitted a quotation for this request',
          );
        }
        throw error;
      });

    if (request.customer?.userId) {
      const providerLabel =
        quote.provider?.verificationStatus === 'VERIFIED'
          ? 'A verified provider'
          : 'A provider';
      this.notifications
        .sendPushNotification({
          userId: request.customer.userId,
          title: 'New Quote Received',
          body: `${providerLabel} submitted a quotation of ₹${totalCost} for "${request.title}".`,
          data: { requestId, quotationId: quote.id, type: 'new_quote' },
        })
        .catch(() => {});
    }

    return quote;
  }

  async findByRequest(
    requestId: string,
    user: AuthUserPayload,
    cursor?: string,
    limit: number = 20,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${requestId} not found`);
    }

    const isCustomerOwner =
      user.customerProfileId && request.customerId === user.customerProfileId;
    const isAdmin = user.role === 'ADMIN';
    const boundedLimit = Math.min(50, Math.max(1, limit));
    const cursorTuple = cursor ? decodeCursor(cursor) : null;

    // If customer: can see all quotes on their own request
    if (isCustomerOwner || isAdmin) {
      const items = await this.prisma.quotation.findMany({
        where: {
          ...buildCursorWhere(cursorTuple),
          requestId,
        },
        include: { provider: true },
        take: boundedLimit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return {
        items: isAdmin
          ? items
          : items.map((item) => ({
              ...item,
              provider: item.provider
                ? toPublicProvider(item.provider)
                : item.provider,
            })),
        nextCursor:
          items.length === boundedLimit
            ? encodeCursor({
                createdAt: items[items.length - 1].createdAt.toISOString(),
                id: items[items.length - 1].id,
              })
            : null,
      };
    }

    // If provider: can only see their own quote on this request
    if (user.providerProfileId) {
      const items = await this.prisma.quotation.findMany({
        where: {
          ...buildCursorWhere(cursorTuple),
          requestId,
          providerId: user.providerProfileId,
        },
        include: { provider: true },
        take: boundedLimit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return {
        items,
        nextCursor:
          items.length === boundedLimit
            ? encodeCursor({
                createdAt: items[items.length - 1].createdAt.toISOString(),
                id: items[items.length - 1].id,
              })
            : null,
      };
    }

    throw new ForbiddenException('You do not have access to quotations for this request');
  }

  async accept(
    quotationId: string,
    user: AuthUserPayload,
    dto: AcceptQuotationDto,
    _idempotencyKey?: string,
  ) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        request: true,
        provider: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found`);
    }

    const isCustomerOwner =
      user.customerProfileId && quote.request.customerId === user.customerProfileId;
    const isAdmin = user.role === 'ADMIN';

    if (!isCustomerOwner && !isAdmin) {
      throw new ForbiddenException(
        'You can only accept quotations for your own service requests',
      );
    }

    if (quote.request.expiresAt < new Date()) {
      throw new BadRequestException(
        'Cannot accept quotation: service request has expired',
      );
    }

    if (quote.status === 'EXPIRED') {
      throw new BadRequestException('Cannot accept quotation: quotation has expired');
    }

    // Idempotency: return the existing booking only after ownership is verified
    const existingBooking = await this.prisma.booking.findUnique({
      where: { quotationId },
      include: {
        quotation: {
          include: { request: { include: { vehicle: true, media: true } } },
        },
        provider: true,
        customer: true,
        payments: true,
      },
    });

    if (existingBooking) {
      return serializeBooking(existingBooking, user.role);
    }

    // Validate state machine transitions
    validateQuotationTransition(quote.status, 'ACCEPTED', user.role);
    validateServiceRequestTransition(quote.request.status, 'ACCEPTED', user.role);

    // Atomic acceptance transaction with guarded update
    const result = await this.prisma.$transaction(async (tx) => {
      // Suspension after quoting must prevent new work allocation.
      const provider = await tx.providerProfile.findUnique({
        where: { id: quote.providerId },
        select: { verificationStatus: true, deletedAt: true },
      });
      if (
        !provider ||
        provider.deletedAt ||
        provider.verificationStatus !== 'VERIFIED'
      ) {
        throw new ConflictException(
          'This provider is not currently verified for new work',
        );
      }

      // H6: claim the REQUEST first. This conditional update is the single
      // serialization point: when two quotes are accepted at once, exactly one
      // transaction moves the request out of OPEN/QUOTES_RECEIVED; the other
      // sees count 0 and is refused instead of creating a second booking.
      const claimed = await tx.serviceRequest.updateMany({
        where: { id: quote.requestId, status: { in: ['OPEN', 'QUOTES_RECEIVED'] } },
        data: { status: 'ACCEPTED' },
      });
      if (claimed.count === 0) {
        throw new ConflictException(
          'This request has already been accepted by another quotation',
        );
      }

      // Guarded update: ensure quote is still pending. If concurrent accept raced, count will be 0
      const updateResult = await tx.quotation.updateMany({
        where: { id: quotationId, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'Quotation has already been accepted or is no longer in pending status',
        );
      }

      // Reject all other competing quotations for this request
      await tx.quotation.updateMany({
        where: {
          requestId: quote.requestId,
          id: { not: quotationId },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      });

      // Create Booking atomically
      const booking = await tx.booking.create({
        data: {
          quotationId: quote.id,
          requestId: quote.requestId,
          customerId: quote.request.customerId,
          providerId: quote.providerId,
          status: 'CONFIRMED',
          scheduledAt: dto.scheduledDate ? new Date(dto.scheduledDate) : new Date(),
          completionNotes: dto.notes || dto.deliveryAddress,
        },
        include: {
          quotation: {
            include: { request: { include: { vehicle: true, media: true } } },
          },
          provider: true,
          customer: true,
        },
      });

      // Open the customer <-> provider chat for this job. The app has no
      // "start chat" button; its Messages screen says chats open on accept.
      await tx.thread.upsert({
        where: {
          customerId_providerId_requestId: {
            customerId: quote.request.customerId,
            providerId: quote.providerId,
            requestId: quote.requestId,
          },
        },
        create: {
          customerId: quote.request.customerId,
          providerId: quote.providerId,
          requestId: quote.requestId,
        },
        update: {},
      });

      // Create initial Payment record in PENDING
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: quote.totalCost,
          currency: 'INR',
          status: 'PENDING',
          method: 'UPI',
        },
      });

      return booking;
    }, { maxWait: 10_000, timeout: 20_000 });

    // Notify provider of accepted quotation
    try {
      const providerUser = await this.prisma.providerProfile.findUnique({
        where: { id: quote.providerId },
        select: { userId: true },
      });
      if (providerUser?.userId) {
        this.notifications
          .sendPushNotification({
            userId: providerUser.userId,
            title: 'Quotation Accepted!',
            body: `Your quotation for "${quote.request.title}" was accepted. Booking #${result.id.slice(0, 8)} confirmed.`,
            data: {
              type: 'QUOTATION_ACCEPTED',
              bookingId: result.id,
              quotationId: quote.id,
            },
          })
          .catch(() => {});
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return serializeBooking(result, user.role);
  }

  async getMyQuotations(
    user: AuthUserPayload,
    cursor?: string,
    limit: number = 20,
    status?: string,
  ) {
    if (!user.providerProfileId) {
      throw new ForbiddenException('Provider profile required');
    }

    const boundedLimit = Math.min(50, Math.max(1, limit));
    const cursorTuple = cursor ? decodeCursor(cursor) : null;

    const items = await this.prisma.quotation.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        providerId: user.providerProfileId,
        ...(status ? { status: status as any } : {}),
      },
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        request: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            status: true,
            urgency: true,
            address: true,
            createdAt: true,
            vehicleMake: true,
            vehicleModel: true,
            vehicleYear: true,
            vehicle: {
              select: {
                make: true,
                model: true,
                year: true,
                fuelType: true,
                transmission: true,
                color: true,
              },
            },
            media: { select: { url: true } },
          },
        },
        booking: true,
      },
    });

    const masked = items.map((item) => ({
      ...item,
      request: item.request
        ? {
            ...item.request,
            // C4: saved vehicle or the request's free-form make/model/year.
            vehicle: resolveRequestVehicle(item.request),
            address:
              item.status === 'ACCEPTED'
                ? item.request.address
                : this.maskAddress(item.request.address),
          }
        : item.request,
    }));

    return {
      items: masked,
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  async updateQuotation(
    id: string,
    user: AuthUserPayload,
    dto: UpdateQuotationDto,
  ) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id },
      include: { request: true },
    });

    if (!quote) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    const isOwner =
      !!user.providerProfileId && quote.providerId === user.providerProfileId;
    if (!isOwner && user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not own this quotation');
    }
    if (user.role !== 'ADMIN') {
      const provider = await this.prisma.providerProfile.findUnique({
        where: { id: quote.providerId },
        select: { verificationStatus: true, deletedAt: true },
      });
      if (
        !provider ||
        provider.deletedAt ||
        provider.verificationStatus !== 'VERIFIED'
      ) {
        throw new ForbiddenException(
          'Suspended or unverified providers cannot edit quotations',
        );
      }
    }
    if (quote.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending quotations can be edited.',
      );
    }
    if (
      quote.request.status !== 'OPEN' &&
      quote.request.status !== 'QUOTES_RECEIVED'
    ) {
      throw new BadRequestException(
        `Cannot edit quotation: request is currently ${quote.request.status}`,
      );
    }

    let parts = Number(dto.partsCost ?? quote.partsCost);
    let labour = Number(dto.labourCost ?? quote.labourCost);
    let shipping = Number(dto.shippingCost ?? quote.shippingCost ?? 0);
    let totalCost = parts + labour + shipping;

    if (quote.request.category === 'TOWING') {
      const provider = await this.prisma.providerProfile.findUnique({
        where: { id: quote.providerId },
      });
      if (!provider) {
        throw new NotFoundException('Provider profile not found');
      }
      const baseFee =
        provider.towingBaseFee != null
          ? Number(provider.towingBaseFee)
          : TOWING_TARIFF.baseFee;
      const perKmFee =
        provider.towingPerKmFee != null
          ? Number(provider.towingPerKmFee)
          : TOWING_TARIFF.perKmFee;
      totalCost = estimateTowingFare(quote.request.towingDistanceKm ?? 0, {
        baseFee,
        perKmFee,
        minimumFare: TOWING_TARIFF.minimumFare,
      });
      parts = 0;
      labour = totalCost;
      shipping = 0;
    }

    return this.prisma.quotation.update({
      where: { id },
      data: {
        ...(dto.partsCost !== undefined ? { partsCost: parts } : {}),
        ...(dto.labourCost !== undefined ? { labourCost: labour } : {}),
        ...(dto.shippingCost !== undefined
          ? { shippingCost: shipping }
          : {}),
        totalCost,
        ...(dto.partCondition !== undefined
          ? { partCondition: dto.partCondition }
          : {}),
        ...(dto.warrantyDays !== undefined
          ? { warrantyDays: dto.warrantyDays }
          : {}),
        ...(dto.etaDescription !== undefined
          ? { etaDescription: dto.etaDescription }
          : {}),
        ...(dto.deliveryMethod !== undefined
          ? { deliveryMethod: dto.deliveryMethod }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async withdrawQuotation(id: string, user: AuthUserPayload) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!quote) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    const isProviderOwner =
      user.providerProfileId && quote.providerId === user.providerProfileId;
    if (!isProviderOwner && user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not own this quotation');
    }

    validateQuotationTransition(quote.status, 'WITHDRAWN', user.role);

    return this.prisma.quotation.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });
  }

  private maskAddress(address: string): string {
    if (!address) return 'Location shared after acceptance';
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length >= 2
      ? parts[parts.length - 1]
      : 'Location shared after acceptance';
  }
}
