import { Prisma } from '@prisma/client';

export interface ProviderFeedQueryParams {
  /**
   * The calling provider. Requests this provider has already quoted are
   * excluded so the feed only shows work they can still act on.
   */
  providerId?: string;
  providerLat?: number;
  providerLng?: number;
  radiusKm?: number;
  category?: string;
  /** Categories the provider is eligible for (from PROVIDER_TYPE_CATEGORIES). */
  categories?: string[];
  /** Towing equipment the provider supports; omit when unrestricted. */
  towingVehicleTypes?: string[];
  /** Provider's maximum vehicle weight; omit when unrestricted. */
  maxVehicleWeightKg?: number;
  limit?: number;
  /** Position after which to continue (see encodeFeedCursor). */
  cursor?: FeedCursor;
}

/**
 * M1: the feed is ordered by (urgency rank ASC, createdAt DESC, id DESC), so a
 * page boundary must remember all three. A cursor with only (createdAt, id)
 * skips or repeats rows whenever urgencies are mixed.
 */
export interface FeedCursor {
  /** 1 = EMERGENCY, 2 = URGENT, 3 = everything else (see urgencyRank). */
  urgencyRank: number;
  createdAt: Date;
  id: string;
}

/** Sort rank of an urgency: lower comes first in the feed. */
export function urgencyRank(urgency: string | null | undefined): number {
  switch (urgency) {
    case 'EMERGENCY':
      return 1;
    case 'URGENT':
      return 2;
    default:
      return 3;
  }
}

/** Opaque base64url(JSON) cursor for the last item of a page. */
export function encodeFeedCursor(item: {
  urgency?: string | null;
  createdAt: Date | string;
  id: string;
}): string {
  const createdAt = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
  return Buffer.from(
    JSON.stringify({ r: urgencyRank(item.urgency), c: createdAt.toISOString(), i: item.id }),
  ).toString('base64url');
}

/** Returns null for anything that is not a well-formed feed cursor. */
export function decodeFeedCursor(cursor: string): FeedCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(parsed?.c);
    if (
      ![1, 2, 3].includes(parsed?.r) ||
      typeof parsed?.i !== 'string' ||
      parsed.i.length === 0 ||
      Number.isNaN(createdAt.getTime())
    ) {
      return null;
    }
    return { urgencyRank: parsed.r, createdAt, id: parsed.i };
  } catch {
    return null;
  }
}

const URGENCY_RANK_SQL = Prisma.sql`CASE sr."urgency"
  WHEN 'EMERGENCY' THEN 1
  WHEN 'URGENT' THEN 2
  ELSE 3
END`;

/**
 * Returns incoming service requests for a provider's feed:
 * Uses PostGIS ST_DWithin on the GiST-indexed geography location column.
 * Matches local requests within radius AND all nationwide broadcast requests.
 * Supports cursor-based pagination and category filtering.
 */
export function getProviderFeedQuery(params: ProviderFeedQueryParams): Prisma.Sql {
  const {
    providerId,
    providerLat,
    providerLng,
    radiusKm = 25,
    category,
    categories,
    towingVehicleTypes,
    maxVehicleWeightKg,
    limit = 20,
    cursor,
  } = params;

  const boundedLimit = Math.min(50, Math.max(1, limit));
  const hasCoordinates = typeof providerLat === 'number' && typeof providerLng === 'number';
  const radiusMeters = radiusKm * 1000;
  const pointGeog = hasCoordinates
    ? Prisma.sql`ST_SetSRID(ST_MakePoint(${providerLng}, ${providerLat}), 4326)::geography`
    : null;

  const categorySql = categories?.length
    ? Prisma.sql`AND sr.category IN (${Prisma.join(
        categories.map((c) => Prisma.sql`${c}::"ServiceCategory"`),
      )})`
    : category
      ? Prisma.sql`AND sr.category = ${category}::"ServiceCategory"`
      : Prisma.empty;

  const towingSql =
    towingVehicleTypes?.length
      ? Prisma.sql`AND (
          sr.category <> 'TOWING'
          OR sr."towingVehicleType" IS NULL
          OR sr."towingVehicleType" = 'ANY'
          OR sr."towingVehicleType" IN (${Prisma.join(
            towingVehicleTypes.map((t) => Prisma.sql`${t}::"TowingVehicleType"`),
          )})
        )`
      : Prisma.empty;

  const weightSql =
    typeof maxVehicleWeightKg === 'number'
      ? Prisma.sql`AND (
          sr.category <> 'TOWING'
          OR sr."vehicleWeightKg" IS NULL
          OR sr."vehicleWeightKg" <= ${maxVehicleWeightKg}
        )`
      : Prisma.empty;

  return Prisma.sql`
    SELECT 
      sr.id,
      sr.ref,
      sr.title,
      sr.description,
      sr.category,
      sr.urgency,
      sr.status,
      sr."isBroadcast",
      (SELECT COALESCE(array_agg(rm.url), ARRAY[]::text[]) FROM request_media rm WHERE rm."requestId" = sr.id) AS "damagePhotos",
      sr."fulfillmentType",
      sr."dropoffAddress",
      sr."dropoffLatitude",
      sr."dropoffLongitude",
      sr."towingVehicleType",
      sr."vehicleWeightKg",
      sr."towingDistanceKm",
      sr."towingEstimatedFare",
      sr.address,
      sr.latitude,
      sr.longitude,
      sr."expiresAt",
      sr."quotesUntil",
      sr."createdAt",
      -- The car: a saved vehicle, or what the customer typed.
      sr."vehicleMake",
      sr."vehicleModel",
      sr."vehicleYear",
      (SELECT json_build_object('make', v.make, 'model', v.model, 'year', v.year)
         FROM vehicles v WHERE v.id = sr."vehicleId") AS vehicle,
      -- How many providers have already quoted (competition at a glance).
      (SELECT COUNT(*)::int FROM quotations q
         WHERE q."requestId" = sr.id AND q."deletedAt" IS NULL) AS "quotationsCount",
      ${
        hasCoordinates && pointGeog
          ? Prisma.sql`ROUND(
              (ST_Distance(
                sr.location,
                ${pointGeog}
              ) / 1000.0)::numeric,
              2
            )::float`
          : Prisma.sql`0.0::float`
      } AS "distanceKm"
    FROM service_requests sr
    WHERE sr.status IN ('OPEN', 'QUOTES_RECEIVED')
      AND sr."isBroadcast" = true
      AND sr."deletedAt" IS NULL
      AND COALESCE(sr."quotesUntil", sr."expiresAt") > NOW()
      ${
        providerId
          ? Prisma.sql`AND NOT EXISTS (
              SELECT 1 FROM quotations q
              WHERE q."requestId" = sr.id AND q."providerId" = ${providerId}
            )`
          : Prisma.empty
      }
      ${categorySql}
      ${towingSql}
      ${weightSql}
      ${
        hasCoordinates && pointGeog
          ? Prisma.sql`AND ST_DWithin(
              sr.location,
              ${pointGeog},
              ${radiusMeters}
            )`
          : Prisma.empty
      }
      ${
        // Row-value comparison matching ORDER BY (rank ASC, createdAt DESC, id DESC):
        // a row comes AFTER the cursor when its rank is higher, or the rank ties
        // and (createdAt, id) is lower.
        cursor
          ? Prisma.sql`AND (
              ${URGENCY_RANK_SQL} > ${cursor.urgencyRank}
              OR (${URGENCY_RANK_SQL} = ${cursor.urgencyRank} AND sr."createdAt" < ${cursor.createdAt})
              OR (
                ${URGENCY_RANK_SQL} = ${cursor.urgencyRank}
                AND sr."createdAt" = ${cursor.createdAt}
                AND sr.id < ${cursor.id}
              )
            )`
          : Prisma.empty
      }
    ORDER BY
      ${URGENCY_RANK_SQL} ASC,
      sr."createdAt" DESC,
      sr.id DESC
    LIMIT ${boundedLimit};
  `;
}

export interface BroadcastRecipientsParams {
  latitude: number;
  longitude: number;
  /** Provider types that serve the request's category (from PROVIDER_TYPE_CATEGORIES). */
  providerTypes: string[];
  towingVehicleType?: string | null;
  vehicleWeightKg?: number | null;
  limit?: number;
}

/**
 * Who to ping about a new request: verified, switched-on providers of a matching type whose OWN
 * service radius covers the customer, nearest first. Towing also needs the right truck and capacity.
 */
export function getBroadcastRecipientsQuery(params: BroadcastRecipientsParams): Prisma.Sql {
  const { latitude, longitude, providerTypes, towingVehicleType, vehicleWeightKg, limit = 50 } = params;
  const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
  const providerPoint = Prisma.sql`pp.location`;
  const towingSql =
    towingVehicleType && towingVehicleType !== 'ANY'
      ? Prisma.sql`AND (
          cardinality(pp."towingVehicleTypes") = 0
          OR 'ANY'::"TowingVehicleType" = ANY(pp."towingVehicleTypes")
          OR ${towingVehicleType}::"TowingVehicleType" = ANY(pp."towingVehicleTypes")
        )`
      : Prisma.empty;
  const weightSql =
    typeof vehicleWeightKg === 'number'
      ? Prisma.sql`AND (pp."maxVehicleWeightKg" IS NULL OR pp."maxVehicleWeightKg" >= ${vehicleWeightKg})`
      : Prisma.empty;
  return Prisma.sql`
    SELECT pp.id AS "providerId", pp."userId" AS "userId",
           ST_Distance(${providerPoint}, ${point}) / 1000 AS "distanceKm"
    FROM provider_profiles pp
    JOIN users u ON u.id = pp."userId"
    WHERE pp."deletedAt" IS NULL
      AND u."isActive" = true
      AND pp."verificationStatus" = 'VERIFIED'
      AND pp."isAvailable" = true
      AND pp."providerType"::text IN (${Prisma.join(providerTypes)})
      AND ST_DWithin(${providerPoint}, ${point}, pp."serviceRadiusKm" * 1000)
      ${towingSql}
      ${weightSql}
    ORDER BY "distanceKm" ASC
    LIMIT ${Math.min(50, Math.max(1, limit))}
  `;
}
