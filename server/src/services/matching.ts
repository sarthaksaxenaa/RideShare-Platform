/**
 * ────────────────────────────────────────────────────────────
 * Driver Matching Service — Find Nearby Available Drivers
 * ────────────────────────────────────────────────────────────
 *
 * This service is the heart of the ride-matching flow:
 *  1. Rider requests a ride → frontend sends pickup coordinates
 *  2. Server calls `findNearbyDrivers()` with those coordinates
 *  3. Service returns drivers sorted by proximity (nearest first)
 *
 * SCALING STRATEGY (why a full table scan is OK for now):
 * At MVP scale (< 10,000 drivers per city), loading all rows
 * into memory and filtering with the Haversine formula is both
 * simple and fast (~2 ms for 10K rows on modern hardware).
 *
 * When we scale beyond that, the path forward is:
 *  - Add PostGIS extension to PostgreSQL
 *  - Store driver locations as `geography(Point, 4326)` columns
 *  - Use `ST_DWithin(geog, ST_MakePoint(lng, lat)::geography, radius_m)`
 *    which leverages a spatial GiST index and avoids full scans
 *  - Prisma supports raw queries via `prisma.$queryRaw` for this
 *
 * WHY NOT USE A BOUNDING-BOX PRE-FILTER?
 * A common optimisation is to add a SQL WHERE clause that limits
 * lat/lng to a rectangular bounding box before applying Haversine.
 * We skip this for now because:
 *  1. The full scan is fast enough at MVP scale
 *  2. Bounding-box math at extreme latitudes (near poles) requires
 *     special handling
 *  3. When we actually need perf, PostGIS is strictly better
 * ────────────────────────────────────────────────────────────
 */

import { prisma } from "../lib/prisma.js";

// ── Constants ────────────────────────────────────────────────

/** Mean radius of Earth in kilometres (WGS-84 approximation). */
const EARTH_RADIUS_KM = 6371;

// ── Haversine Distance ───────────────────────────────────────

/**
 * Calculate the great-circle distance between two GPS points
 * using the Haversine formula.
 *
 * The Haversine formula determines the shortest path over the
 * Earth's surface (as-the-crow-flies), assuming a perfect sphere.
 * The error vs. the true WGS-84 ellipsoid is < 0.3 %, which is
 * negligible for ride-matching (we're comparing drivers within
 * a few km, not navigating across oceans).
 *
 * Formula breakdown:
 *   a = sin²(Δlat / 2) + cos(lat1) × cos(lat2) × sin²(Δlng / 2)
 *   c = 2 × atan2(√a, √(1 − a))
 *   d = R × c
 *
 * Where R = Earth's mean radius (6371 km).
 *
 * @param lat1 - Latitude of point 1 in decimal degrees
 * @param lng1 - Longitude of point 1 in decimal degrees
 * @param lat2 - Latitude of point 2 in decimal degrees
 * @param lng2 - Longitude of point 2 in decimal degrees
 * @returns Distance in kilometres (always ≥ 0)
 *
 * @example
 * ```ts
 * // Distance between Mumbai and Pune (~150 km)
 * haversineDistance(19.076, 72.8777, 18.5204, 73.8567);
 * ```
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Convert degrees → radians (JavaScript trig functions use radians)
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  // Haversine formula — the intermediate value `a` represents the
  // square of half the chord length between the two points.
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  // `c` is the angular distance in radians (central angle).
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Multiply by Earth's radius to get distance in km.
  return EARTH_RADIUS_KM * c;
}

// ── Nearby Driver Search ─────────────────────────────────────

/**
 * Shape of each entry in the results array.
 * Kept lean — the client only needs enough info to display a
 * marker on the map and show the driver's name.
 */
export interface NearbyDriver {
  driverId: string;
  name: string;
  lat: number;
  lng: number;
  /** How far the driver is from the pickup point, in km. */
  distanceKm: number;
}

/**
 * Find all available drivers within `radiusKm` of a given point.
 *
 * "Available" means:
 *  - The driver has an active location record in `DriverLocation`
 *  - The driver is NOT currently on an active trip (status MATCHED
 *    or STARTED)
 *
 * WHY EXCLUDE MATCHED AND STARTED DRIVERS?
 * A driver with status MATCHED has already been assigned to a
 * rider and is en route to the pickup. A driver with status
 * STARTED is mid-trip. In both cases, the driver is committed
 * and should not receive new ride requests.
 *
 * Drivers become available again when their trip reaches
 * COMPLETED or CANCELLED status.
 *
 * @param lat       - Pickup latitude in decimal degrees
 * @param lng       - Pickup longitude in decimal degrees
 * @param radiusKm  - Search radius in km (default: 5 km, the
 *                    sweet spot for urban areas — wide enough
 *                    to find drivers quickly, narrow enough to
 *                    keep ETAs reasonable)
 * @returns Array of nearby drivers sorted by distance (nearest
 *          first). Returns empty array if none found.
 *
 * @example
 * ```ts
 * const drivers = await findNearbyDrivers(19.076, 72.8777);
 * // → [{ driverId: "...", name: "Amit", distanceKm: 0.8 }, ...]
 * ```
 */
export async function findNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number = 5
): Promise<NearbyDriver[]> {
  // ── 1. Fetch all driver locations with related user data ──
  // We include the `user` relation so we can grab the driver's
  // name without a separate query. At MVP scale this is a single
  // indexed scan on a small table.
  const allDriverLocations = await prisma.driverLocation.findMany({
    include: {
      driver: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // ── 2. Get IDs of drivers who are currently on active trips ─
  // A driver is "busy" if they have ANY trip with status MATCHED
  // or STARTED. We query distinct driverIds to build a Set for
  // O(1) lookup during filtering.
  const busyTrips = await prisma.trip.findMany({
    where: {
      status: { in: ["MATCHED", "STARTED"] },
    },
    select: {
      driverId: true,
    },
  });

  // Use a Set for O(1) exclusion checks (vs. O(n) with .includes())
  const busyDriverIds = new Set(
    busyTrips
      .map((trip) => trip.driverId)
      .filter((id): id is string => id !== null)
  );

  // ── 3. Filter by distance and availability ─────────────────
  const nearbyDrivers: NearbyDriver[] = [];

  for (const loc of allDriverLocations) {
    // Skip drivers who are already on a trip
    if (busyDriverIds.has(loc.driverId)) {
      continue;
    }

    // Calculate distance from rider's pickup to this driver
    const distanceKm = haversineDistance(lat, lng, loc.lat, loc.lng);

    // Only include drivers within the search radius
    if (distanceKm <= radiusKm) {
      nearbyDrivers.push({
        driverId: loc.driverId,
        name: loc.driver.name,
        lat: loc.lat,
        lng: loc.lng,
        distanceKm: Math.round(distanceKm * 100) / 100, // Round to 2 decimal places
      });
    }
  }

  // ── 4. Sort by proximity (nearest first) ───────────────────
  // The rider cares most about the closest driver — shortest ETA.
  nearbyDrivers.sort((a, b) => a.distanceKm - b.distanceKm);

  return nearbyDrivers;
}
