import { Prisma } from '@prisma/client';

export interface NearbyProviderResult {
  id: string;
  businessName: string;
  providerType: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  avgRating: number;
  totalReviews: number;
  distanceKm: number;
}

export interface ProviderFeedItem {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  isBroadcast: boolean;
  damagePhotos: string[];
  fulfillmentType: string | null;
  address: string;
  latitude: number;
  longitude: number;
  expiresAt: Date;
  createdAt: Date;
  distanceKm: number;
}

/**
 * SQL migration statement to enable PostGIS.
 */
export const ENABLE_POSTGIS_SQL = Prisma.sql`CREATE EXTENSION IF NOT EXISTS postgis;`;

/**
 * Query nearby providers within a given radius (in kilometers) using PostGIS ST_DWithin
 * on the GiST-indexed geography column for sub-millisecond indexed spatial search.
 */
export function getNearbyProvidersQuery(
  lat: number,
  lng: number,
  radiusKm: number = 15,
  providerType?: string,
): Prisma.Sql {
  const radiusMeters = radiusKm * 1000;
  const pointGeog = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

  return Prisma.sql`
    SELECT 
      id,
      "businessName",
      "providerType",
      phone,
      address,
      latitude,
      longitude,
      "serviceRadiusKm",
      "avgRating",
      "totalReviews",
      ROUND(
        (ST_Distance(
          COALESCE(location, ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography),
          ${pointGeog}
        ) / 1000.0)::numeric,
        2
      )::float AS "distanceKm"
    FROM provider_profiles
    WHERE "verificationStatus" = 'VERIFIED'
      AND "isAvailable" = true
      ${providerType ? Prisma.sql`AND "providerType" = ${providerType}::"ProviderType"` : Prisma.empty}
      AND ST_DWithin(
        COALESCE(location, ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography),
        ${pointGeog},
        ${radiusMeters}
      )
    ORDER BY "distanceKm" ASC;
  `;
}

/**
 * Haversine fallback query for standard PostgreSQL without PostGIS extension.
 */
export function getNearbyProvidersHaversineQuery(
  lat: number,
  lng: number,
  radiusKm: number = 15,
  providerType?: string,
): Prisma.Sql {
  return Prisma.sql`
    SELECT 
      id,
      "businessName",
      "providerType",
      phone,
      address,
      latitude,
      longitude,
      "serviceRadiusKm",
      "avgRating",
      "totalReviews",
      ROUND(
        (6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${lat})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(latitude))
          ))
        ))::numeric,
        2
      )::float AS "distanceKm"
    FROM provider_profiles
    WHERE "verificationStatus" = 'VERIFIED'
      AND "isAvailable" = true
      ${providerType ? Prisma.sql`AND "providerType" = ${providerType}::"ProviderType"` : Prisma.empty}
      AND (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(${lat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(latitude))
        ))
      )) <= ${radiusKm}
    ORDER BY "distanceKm" ASC;
  `;
}

export interface ProviderFeedQueryParams {
  providerLat?: number;
  providerLng?: number;
  radiusKm?: number;
  category?: string;
  limit?: number;
  cursorCreatedAt?: Date;
  cursorId?: string;
}

/**
 * Returns incoming service requests for a provider's feed:
 * Uses PostGIS ST_DWithin on the GiST-indexed geography location column.
 * Matches local requests within radius AND all nationwide broadcast requests.
 * Supports cursor-based pagination and category filtering.
 */
export function getProviderFeedQuery(params: ProviderFeedQueryParams): Prisma.Sql {
  const {
    providerLat,
    providerLng,
    radiusKm = 25,
    category,
    limit = 20,
    cursorCreatedAt,
    cursorId,
  } = params;

  const boundedLimit = Math.min(50, Math.max(1, limit));
  const hasCoordinates = typeof providerLat === 'number' && typeof providerLng === 'number';
  const radiusMeters = radiusKm * 1000;
  const pointGeog = hasCoordinates
    ? Prisma.sql`ST_SetSRID(ST_MakePoint(${providerLng}, ${providerLat}), 4326)::geography`
    : null;

  return Prisma.sql`
    SELECT 
      sr.id,
      sr.title,
      sr.description,
      sr.category,
      sr.urgency,
      sr.status,
      sr."isBroadcast",
      (SELECT COALESCE(array_agg(rm.url), ARRAY[]::text[]) FROM request_media rm WHERE rm."requestId" = sr.id) AS "damagePhotos",
      sr."fulfillmentType",
      sr.address,
      sr.latitude,
      sr.longitude,
      sr."expiresAt",
      sr."createdAt",
      ${
        hasCoordinates && pointGeog
          ? Prisma.sql`ROUND(
              (ST_Distance(
                COALESCE(sr.location, ST_SetSRID(ST_MakePoint(sr.longitude, sr.latitude), 4326)::geography),
                ${pointGeog}
              ) / 1000.0)::numeric,
              2
            )::float`
          : Prisma.sql`0.0::float`
      } AS "distanceKm"
    FROM service_requests sr
    WHERE sr.status = 'OPEN'
      AND sr."expiresAt" > NOW()
      ${category ? Prisma.sql`AND sr.category = ${category}::"ServiceCategory"` : Prisma.empty}
      ${
        hasCoordinates && pointGeog
          ? Prisma.sql`AND (
              sr."isBroadcast" = true
              OR ST_DWithin(
                COALESCE(sr.location, ST_SetSRID(ST_MakePoint(sr.longitude, sr.latitude), 4326)::geography),
                ${pointGeog},
                ${radiusMeters}
              )
            )`
          : Prisma.empty
      }
      ${
        cursorCreatedAt && cursorId
          ? Prisma.sql`AND (
              sr."createdAt" < ${cursorCreatedAt}
              OR (sr."createdAt" = ${cursorCreatedAt} AND sr.id < ${cursorId})
            )`
          : Prisma.empty
      }
    ORDER BY 
      CASE sr."urgency"
        WHEN 'EMERGENCY' THEN 1
        WHEN 'URGENT' THEN 2
        ELSE 3
      END ASC,
      sr."createdAt" DESC,
      sr.id DESC
    LIMIT ${boundedLimit};
  `;
}
