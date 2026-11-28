import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  estimateTowingFare,
  haversineDistanceKm,
  PROVIDER_TYPE_CATEGORIES,
  ROADSIDE_TARIFF,
} from "@weyro/api-contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDamageRequestDto } from "./dto/create-damage-request.dto";
import { AuthUserPayload } from "../../common/types/auth-user-payload.type";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  getBroadcastRecipientsQuery,
  getProviderFeedQuery,
  urgencyRank,
  type FeedCursor,
} from "@weyro/database";
import {
  assertOwnedMediaKeys,
  MEDIA_FOLDERS_BY_USE,
} from "../../common/media/media-key";
import { resolveRequestVehicle } from "../../common/serializers/request-vehicle";
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from "../../common/utils/cursor";
import { toPublicProvider } from "../../common/serializers/public-provider";
import { validateServiceRequestTransition } from "../../common/state-machines/state-machines";
import { OutboxService } from "../notifications/outbox.service";

/** How long a new request takes quotes. Accepting one stays possible until expiresAt (7 days). */
const QUOTE_WINDOW_HOURS = 24;

const CATEGORY_WORD: Record<string, string> = {
  REPAIR: "repair",
  MAINTENANCE: "service",
  INSPECTION: "inspection",
  SPARE_PART: "spare part",
  TOWING: "towing",
  ROADSIDE: "roadside help",
};

/** Provider types that serve a request category: the reverse of PROVIDER_TYPE_CATEGORIES. */
export function providerTypesFor(category: string): string[] {
  return Object.entries(PROVIDER_TYPE_CATEGORIES)
    .filter(([, categories]) => (categories as string[]).includes(category))
    .map(([type]) => type);
}

@Injectable()
export class DamageRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  private formatRequest(req: any) {
    if (!req) return req;
    const damagePhotos = req.media
      ? req.media.map((m: any) => m.url)
      : req.damagePhotos || [];
    return {
      ...req,
      ...("vehicle" in req ? { vehicle: resolveRequestVehicle(req) } : {}),
      damagePhotos,
      quotationsCount: Array.isArray(req.quotations)
        ? req.quotations.length
        : 0,
    };
  }

  async create(
    customerId: string,
    dto: CreateDamageRequestDto,
    ownerUserId?: string,
  ) {
    // H4: photos must be finalized uploads owned by the caller.
    const photoKeys = await assertOwnedMediaKeys(
      this.prisma,
      ownerUserId ?? customerId,
      dto.mediaUrls?.length ? dto.mediaUrls : (dto.damagePhotos ?? []),
      MEDIA_FOLDERS_BY_USE.damage,
    );
    let vehicleId = dto.vehicleId;
    if (vehicleId) {
      const owned = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId, customerId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) {
        throw new NotFoundException("Vehicle not found");
      }
      vehicleId = owned.id;
    }
    // C4: no placeholder vehicles. Without a saved vehicle, the request keeps
    // the free-form make/model/year the customer typed.
    const freeForm = vehicleId
      ? {}
      : {
          vehicleMake: dto.vehicleMake?.trim() || undefined,
          vehicleModel: dto.vehicleModel?.trim() || undefined,
          vehicleYear: dto.vehicleYear || undefined,
        };

    const rawCategory = (dto.category as any) || "REPAIR";
    const category =
      rawCategory === "MECHANICAL" || rawCategory === "BODYWORK"
        ? "REPAIR"
        : rawCategory;

    const isTowing = category === "TOWING";
    const towingDistanceKm =
      isTowing &&
      typeof dto.dropoffLatitude === "number" &&
      typeof dto.dropoffLongitude === "number"
        ? haversineDistanceKm(
            { latitude: dto.latitude, longitude: dto.longitude },
            {
              latitude: dto.dropoffLatitude,
              longitude: dto.dropoffLongitude,
            },
          )
        : undefined;
    const towingEstimatedFare =
      towingDistanceKm !== undefined
        ? estimateTowingFare(towingDistanceKm)
        : undefined;

    // Roadside assist: flat-rate estimate from the shared tariff
    const isRoadside = category === "ROADSIDE";
    const roadsideKind = isRoadside ? dto.roadsideKind : undefined;
    const estimatedFare =
      isRoadside && roadsideKind ? ROADSIDE_TARIFF[roadsideKind] : undefined;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || 7));

    const quotesUntil = new Date(Date.now() + QUOTE_WINDOW_HOURS * 3_600_000);
    // One transaction: the request and the outbox pings commit together,
    // so a garage is never pinged about a request that didn't save.
    const { created, notifiedProviders } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceRequest.create({
        data: {
          customerId,
          vehicleId,
          ...freeForm,
          category,
          title: dto.title,
          description: dto.description,
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
          urgency: dto.urgency || "URGENT",
          status: "OPEN",
          isBroadcast: true,
          fulfillmentType:
            dto.fulfillmentType ||
            (isTowing ? "TOW_TO_GARAGE" : "PARTS_SHIPPING"),
          dropoffAddress: isTowing ? dto.dropoffAddress : undefined,
          dropoffLatitude: isTowing ? dto.dropoffLatitude : undefined,
          dropoffLongitude: isTowing ? dto.dropoffLongitude : undefined,
          towingVehicleType: isTowing ? dto.towingVehicleType : undefined,
          vehicleWeightKg: isTowing ? dto.vehicleWeightKg : undefined,
          towingDistanceKm,
          towingEstimatedFare,
          roadsideKind,
          estimatedFare,
          expiresAt,
          quotesUntil: quotesUntil < expiresAt ? quotesUntil : expiresAt,
          media: photoKeys.length
            ? {
                // C3: persist object keys only; URLs are signed when read.
                create: photoKeys.map((key) => ({
                  url: key,
                  fileType: "image/jpeg",
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

      const notifiedProviders = await this.broadcastNewRequest(tx, created, ownerUserId);
      return { created, notifiedProviders };
    });

    // 0 tells the app no provider covers this location, so it can say so.
    return { ...this.formatRequest(created), notifiedProviders };
  }

  async findMine(
    user: AuthUserPayload,
    cursor?: string,
    limit: number = 20,
    status?: string,
  ) {
    const customerId = user.customerProfileId;
    if (!customerId) {
      return { items: [], nextCursor: null };
    }

    const boundedLimit = Math.min(50, Math.max(1, limit));
    const cursorTuple = cursor ? decodeCursor(cursor) : null;

    const items = await this.prisma.serviceRequest.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        customerId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        media: true,
        vehicle: true,
        quotations: {
          include: { provider: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: boundedLimit,
    });

    return {
      items: items.map((item) =>
        this.formatRequest({
          ...item,
          quotations: item.quotations.map((quotation) => ({
            ...quotation,
            provider: toPublicProvider(quotation.provider),
          })),
        }),
      ),
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  /**
   * M1: resolve the page position. New cursors are base64url JSON
   * (urgency rank, createdAt, id). A bare request id from an older app build is
   * still honoured by looking the row up once.
   */
  private async resolveFeedCursor(
    raw?: string,
  ): Promise<FeedCursor | undefined> {
    if (!raw) return undefined;
    const decoded = decodeFeedCursor(raw);
    if (decoded) return decoded;

    const legacy = await this.prisma.serviceRequest.findUnique({
      where: { id: raw },
      select: { id: true, urgency: true, createdAt: true },
    });
    if (!legacy) throw new BadRequestException("Invalid cursor");
    return {
      urgencyRank: urgencyRank(legacy.urgency),
      createdAt: legacy.createdAt,
      id: legacy.id,
    };
  }

  /**
   * Prisma form of the SQL tuple comparison: rows strictly AFTER the cursor in
   * (urgency rank ASC, createdAt DESC, id DESC) order. The enum is declared
   * NORMAL < URGENT < EMERGENCY, so "lower severity" = later in the feed.
   */
  private feedCursorWhere(cursor: FeedCursor) {
    const bySeverity = ["EMERGENCY", "URGENT", "NORMAL"] as const; // rank 1, 2, 3
    const same = bySeverity[cursor.urgencyRank - 1];
    const later = bySeverity.slice(cursor.urgencyRank);
    return {
      OR: [
        ...(later.length ? [{ urgency: { in: [...later] } }] : []),
        { urgency: same, createdAt: { lt: cursor.createdAt } },
        { urgency: same, createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    };
  }

  async cancel(id: string, user: AuthUserPayload) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Service request with ID ${id} not found`);
    }

    const isOwner =
      user.customerProfileId && request.customerId === user.customerProfileId;
    if (!isOwner && user.role !== "ADMIN") {
      throw new ForbiddenException(
        "You can only cancel your own service requests",
      );
    }

    validateServiceRequestTransition(request.status, "CANCELLED", user.role);

    // M2: compare-and-set — if the request was accepted (or cancelled) while we
    // were validating, cancel nothing and tell the caller to refresh.
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.serviceRequest.updateMany({
        where: { id, status: request.status },
        data: { status: "CANCELLED" },
      });
      if (claimed.count === 0) {
        throw new ConflictException("Request changed, refresh and try again");
      }
      await tx.quotation.updateMany({
        where: { requestId: id, status: "PENDING" },
        data: { status: "WITHDRAWN" },
      });
      return tx.serviceRequest.findUniqueOrThrow({ where: { id } });
    });

    return this.formatRequest(updated);
  }

  /**
   * Ping every provider who should quote: verified, switched on, matching type, and whose own
   * service area covers the customer (nearest 50). Delivered by the outbox worker with retries.
   */
  private async broadcastNewRequest(
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    request: {
      id: string;
      title: string;
      category: string;
      latitude: number;
      longitude: number;
      towingVehicleType: string | null;
      vehicleWeightKg: number | null;
    },
    ownerUserId?: string,
  ) {
    const providerTypes = providerTypesFor(request.category);
    if (providerTypes.length === 0) return 0;
    const recipients = await tx.$queryRaw<
      { providerId: string; userId: string; distanceKm: number }[]
    >(
      getBroadcastRecipientsQuery({
        latitude: request.latitude,
        longitude: request.longitude,
        providerTypes,
        towingVehicleType: request.towingVehicleType,
        vehicleWeightKg: request.vehicleWeightKg,
      }),
    );
    const word = CATEGORY_WORD[request.category] ?? "service";
    let sent = 0;
    for (const r of recipients) {
      if (r.userId === ownerUserId) continue; // a provider posting their own request
      const km = Number(r.distanceKm);
      await this.outbox.enqueue(tx as never, "request.new", {
        userId: r.userId,
        title: `New ${word} request near you`,
        body: `${request.title}, ${km < 1 ? "under 1" : km.toFixed(1)} km away. Send your price and time.`,
        data: { type: "new_request", requestId: request.id },
      });
      sent += 1;
    }
    return sent;
  }

  async getBroadcastFeed(params: {
    providerId?: string;
    providerLat?: number;
    providerLng?: number;
    radiusKm?: number;
    category?: string;
    cursor?: string;
    limit?: number;
  }) {
    const boundedLimit = Math.min(50, Math.max(1, params.limit || 20));

    // Match requests to what this provider can actually service.
    const provider = params.providerId
      ? await this.prisma.providerProfile.findUnique({
          where: { id: params.providerId },
          select: {
            providerType: true,
            latitude: true,
            longitude: true,
            towingVehicleTypes: true,
            maxVehicleWeightKg: true,
          },
        })
      : null;

    const allowedCategories = provider
      ? PROVIDER_TYPE_CATEGORIES[provider.providerType]
      : undefined;

    let categories: string[] | undefined;
    if (allowedCategories) {
      categories = params.category
        ? allowedCategories.filter((c) => c === params.category)
        : [...allowedCategories];
      if (categories.length === 0) {
        return { items: [], nextCursor: null };
      }
    } else if (params.category) {
      categories = [params.category];
    }

    const towingVehicleTypes =
      provider?.towingVehicleTypes?.length &&
      !provider.towingVehicleTypes.includes("ANY")
        ? provider.towingVehicleTypes
        : undefined;
    const maxVehicleWeightKg = provider?.maxVehicleWeightKg ?? undefined;

    const feedCursor = await this.resolveFeedCursor(params.cursor);

    // Never trust caller-supplied coordinates: use the provider's registered
    // location so a provider cannot scan another city's targeted requests.
    const providerLat = provider?.latitude ?? params.providerLat;
    const providerLng = provider?.longitude ?? params.providerLng;

    if (typeof providerLat === "number" && typeof providerLng === "number") {
      const query = getProviderFeedQuery({
        providerId: params.providerId,
        providerLat,
        providerLng,
        radiusKm: params.radiusKm || 25,
        categories,
        towingVehicleTypes,
        maxVehicleWeightKg,
        limit: boundedLimit,
        cursor: feedCursor,
      });

      const rawResults = await this.prisma.$queryRaw<any[]>(query);
      const items = rawResults.map((req) => {
        const {
          latitude: _latitude,
          longitude: _longitude,
          dropoffLatitude: _dropoffLatitude,
          dropoffLongitude: _dropoffLongitude,
          ...safe
        } = req;
        return {
          ...safe,
          address: this.maskAddress(req.address),
        };
      });

      return {
        items,
        nextCursor:
          items.length === boundedLimit
            ? encodeFeedCursor(items[items.length - 1])
            : null,
      };
    }

    const where: any = {
      // C2: a request stays visible to other providers after the first quote.
      status: { in: ["OPEN", "QUOTES_RECEIVED"] },
      isBroadcast: true,
      expiresAt: { gt: new Date() },
    };
    // Hide requests this provider has already quoted.
    if (params.providerId) {
      where.quotations = { none: { providerId: params.providerId } };
    }
    if (categories) {
      where.category = { in: categories };
    }
    if (towingVehicleTypes) {
      where.OR = [
        { towingVehicleType: null },
        { towingVehicleType: "ANY" },
        { towingVehicleType: { in: towingVehicleTypes } },
      ];
    }
    // Stop showing a request once it has stopped taking quotes.
    const and: any[] = [{ OR: [{ quotesUntil: null }, { quotesUntil: { gt: new Date() } }] }];
    if (typeof maxVehicleWeightKg === "number") {
      and.push({
        OR: [
          { vehicleWeightKg: null },
          { vehicleWeightKg: { lte: maxVehicleWeightKg } },
        ],
      });
    }
    if (feedCursor) and.push(this.feedCursorWhere(feedCursor));
    if (and.length > 0) where.AND = and;

    const requests = await this.prisma.serviceRequest.findMany({
      where,
      include: {
        media: true,
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
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: boundedLimit,
    });

    const items = requests.map((req) => {
      const formatted = this.formatRequest(req);
      const {
        latitude: _latitude,
        longitude: _longitude,
        dropoffLatitude: _dropoffLatitude,
        dropoffLongitude: _dropoffLongitude,
        ...safe
      } = formatted;
      return {
        ...safe,
        address: this.maskAddress(req.address),
      };
    });

    return {
      items,
      nextCursor:
        items.length === boundedLimit
          ? encodeFeedCursor(items[items.length - 1])
          : null,
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
    const isAdmin = user.role === "ADMIN";

    // Check if provider has an accepted booking on this request
    const acceptedQuotationForProvider = found.quotations.find(
      (q) =>
        q.providerId === user.providerProfileId &&
        q.status === "ACCEPTED" &&
        q.booking !== null,
    );

    const hasAcceptedBooking = Boolean(acceptedQuotationForProvider);

    // Providers can only open requests that match their service category.
    if (user.providerProfileId && !isCustomerOwner && !isAdmin) {
      const provider = await this.prisma.providerProfile.findUnique({
        where: { id: user.providerProfileId },
        select: { providerType: true, verificationStatus: true },
      });
      if (!provider || provider.verificationStatus !== "VERIFIED") {
        throw new ForbiddenException(
          "Only verified providers can open service requests",
        );
      }
      const eligible = PROVIDER_TYPE_CATEGORIES[provider.providerType];
      if (eligible && !eligible.includes(found.category)) {
        throw new ForbiddenException(
          "This request does not match your provider service category",
        );
      }
    }

    // If caller is customer: must be the owner
    if (user.role === "CUSTOMER" && !isCustomerOwner && !isAdmin) {
      throw new ForbiddenException("You can only access your own requests");
    }

    // A provider with no relationship to the request may only open an open
    // broadcast. Targeted, cancelled and expired requests stay private.
    if (
      user.providerProfileId &&
      !isCustomerOwner &&
      !isAdmin &&
      !hasAcceptedBooking
    ) {
      const hasOwnQuotation = found.quotations.some(
        (q) => q.providerId === user.providerProfileId,
      );
      if (!found.isBroadcast || found.status !== "OPEN") {
        if (!hasOwnQuotation) {
          throw new NotFoundException(`Request with ID ${id} not found`);
        }
      }
    }

    // Privacy protection: never expose competitors' quotations to providers
    const isOwnerOrAdmin = Boolean(isCustomerOwner) || isAdmin;
    const visibleQuotations = isOwnerOrAdmin
      ? found.quotations
      : found.quotations.filter((q) => q.providerId === user.providerProfileId);

    // Provider rows carry phone, exact address and KYC documents; only admins
    // get the full record. Everyone else gets the public provider projection.
    const quotations = isAdmin
      ? visibleQuotations
      : visibleQuotations.map((quotation) => ({
          ...quotation,
          provider: quotation.provider
            ? toPublicProvider(quotation.provider)
            : quotation.provider,
        }));

    const sanitizedCustomer = {
      id: found.customer.id,
      firstName: found.customer.firstName,
      lastName: found.customer.lastName,
      avatarUrl: found.customer.avatarUrl,
    };
    // C4: saved vehicle or the request's own free-form make/model/year.
    const resolvedVehicle = resolveRequestVehicle(found);
    const sanitizedVehicle = resolvedVehicle
      ? {
          make: resolvedVehicle.make,
          model: resolvedVehicle.model,
          year: resolvedVehicle.year,
          fuelType: resolvedVehicle.fuelType,
          transmission: resolvedVehicle.transmission,
          color: resolvedVehicle.color,
        }
      : null;

    if (!isOwnerOrAdmin && !hasAcceptedBooking) {
      const {
        latitude: _latitude,
        longitude: _longitude,
        dropoffLatitude: _dropoffLatitude,
        dropoffLongitude: _dropoffLongitude,
        ...rest
      } = found;
      return {
        ...rest,
        address: this.maskDetailAddress(found.address),
        dropoffAddress: found.dropoffAddress
          ? this.maskDetailAddress(found.dropoffAddress)
          : found.dropoffAddress,
        vehicle: sanitizedVehicle,
        customer: sanitizedCustomer,
        quotations,
      };
    }

    if (!isOwnerOrAdmin && hasAcceptedBooking) {
      // The assigned provider needs the route, not the customer's account
      // contact details or vehicle identity numbers.
      return {
        ...found,
        vehicle: sanitizedVehicle,
        customer: sanitizedCustomer,
        quotations,
      };
    }

    return { ...found, vehicle: resolvedVehicle, quotations };
  }

  private maskDetailAddress(fullAddress: string): string {
    if (!fullAddress) return "Location shared after acceptance";
    const parts = fullAddress
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1];
    return "Location shared after acceptance";
  }

  private maskAddress(fullAddress: string): string {
    if (!fullAddress) return "Location specified upon booking";
    const parts = fullAddress.split(",");
    if (parts.length >= 2) {
      return parts
        .slice(-2)
        .map((part) => part.trim())
        .join(", ");
    }
    return fullAddress.replace(/^\d+[\w\s]+,\s*/, "").trim();
  }
}
