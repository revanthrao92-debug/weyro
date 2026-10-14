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

/**
 * SQL migration statement to enable PostGIS on Supabase PostgreSQL.
 */
export const ENABLE_POSTGIS_SQL = Prisma.sql`CREATE EXTENSION IF NOT EXISTS postgis;`;

/**
 * Query nearby providers within a given radius (in kilometers) using PostGIS ST_DWithin
 * on geography points for sub-millisecond indexed spatial search.
 */
export function getNearbyProvidersQuery(
  lat: number,
  lng: number,
  radiusKm: number = 15
): Prisma.Sql {
  const radiusMeters = radiusKm * 1000;

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
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) / 1000.0)::numeric,
        2
      )::float AS "distanceKm"
    FROM provider_profiles
    WHERE "verificationStatus" = 'VERIFIED'
      AND "isAvailable" = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY "distanceKm" ASC;
  `;
}

/**
 * Haversine fallback query for standard PostgreSQL without PostGIS extension.
 * Clamps the acos() input with LEAST(1.0, GREATEST(-1.0, ...)) to prevent out-of-range errors
 * on identical or extremely close coordinates.
 */
export function getNearbyProvidersHaversineQuery(
  lat: number,
  lng: number,
  radiusKm: number = 15
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

/**
 * Returns incoming service requests for a provider's feed:
 * Matches local requests within radius AND all broadcast requests (e.g. car damage with photos, rare parts)
 * irrespective of distance.
 * Includes floating-point clamping on acos() to avoid range crashes.
 */
export function getProviderFeedQuery(
  providerLat: number,
  providerLng: number,
  radiusKm: number = 15
): Prisma.Sql {
  return Prisma.sql`
    SELECT 
      sr.id,
      sr.title,
      sr.description,
      sr.category,
      sr.urgency,
      sr.status,
      sr."isBroadcast",
      sr."damagePhotos",
      sr."fulfillmentType",
      sr.address,
      sr.latitude,
      sr.longitude,
      sr."expiresAt",
      sr."createdAt",
      ROUND(
        (6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${providerLat})) * cos(radians(sr.latitude)) *
            cos(radians(sr.longitude) - radians(${providerLng})) +
            sin(radians(${providerLat})) * sin(radians(sr.latitude))
          ))
        ))::numeric,
        2
      )::float AS "distanceKm"
    FROM service_requests sr
    WHERE sr.status = 'OPEN'
      AND (
        sr."isBroadcast" = true
        OR (6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${providerLat})) * cos(radians(sr.latitude)) *
            cos(radians(sr.longitude) - radians(${providerLng})) +
            sin(radians(${providerLat})) * sin(radians(sr.latitude))
          ))
        )) <= ${radiusKm}
      )
    ORDER BY 
      sr."urgency" DESC,
      sr."createdAt" DESC;
  `;
}
