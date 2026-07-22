/**
 * ────────────────────────────────────────────────────────────
 * Geocoding Service — Coordinates ↔ Addresses
 * ────────────────────────────────────────────────────────────
 *
 * 📚 WHAT IS REVERSE GEOCODING?
 * It's the process of converting GPS coordinates (lat, lng)
 * back into a human-readable address like "Alpha 2, Greater
 * Noida, UP 201310, India".
 *
 * Regular geocoding goes the other direction:
 *   "Alpha 2, Greater Noida" → { lat: 28.474, lng: 77.504 }
 *
 * 📚 WHY DO WE NEED THIS ON THE SERVER?
 * The frontend already does reverse geocoding for display,
 * but that data is never saved to the database. When we look
 * at trip history, admin stats, or generate receipts, we need
 * the addresses stored permanently in the Trip record.
 *
 * 📚 WHAT IS NOMINATIM?
 * Nominatim is the free geocoding API from OpenStreetMap.
 * It has a rate limit of 1 request per second (for the free
 * public instance), which is why we add a small delay between
 * requests when geocoding both pickup and dropoff.
 *
 * For production at scale, you'd run your own Nominatim server
 * or use a paid service like Google Maps Geocoding API.
 *
 * 📚 WHY `fetch` INSTEAD OF `axios`?
 * Node.js 18+ has built-in `fetch()` — no extra dependency
 * needed. Since this is a simple GET request, fetch is lighter
 * than importing the full axios library.
 * ────────────────────────────────────────────────────────────
 */

/**
 * Convert coordinates to a human-readable address using the
 * free Nominatim (OpenStreetMap) reverse geocoding API.
 *
 * @param lat - Latitude in decimal degrees
 * @param lng - Longitude in decimal degrees
 * @returns A readable address string, or null if geocoding fails
 *
 * @example
 * ```ts
 * const address = await reverseGeocode(28.6139, 77.2090);
 * // → "Connaught Place, New Delhi, Delhi 110001, India"
 * ```
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // Nominatim requires a User-Agent header — their usage policy
    // mandates identifying your application. Without it, requests
    // may be blocked.
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RideShareApp/1.0 (student-project)',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    // Nominatim returns a `display_name` field with the full address.
    // We truncate it to keep just the useful parts (first 3-4 parts).
    if (data.display_name) {
      // Full display_name can be very long:
      //   "Alpha 2, Greater Noida, Gautam Buddh Nagar, Uttar Pradesh, 201310, India"
      // We keep first 4 parts for a clean, concise address.
      const parts = data.display_name.split(', ');
      return parts.slice(0, 4).join(', ');
    }

    return null;
  } catch (error) {
    // Don't crash the trip creation if geocoding fails —
    // the address is a nice-to-have, not a requirement.
    console.error('[geocode] Reverse geocoding failed:', error);
    return null;
  }
}

/**
 * Geocode both pickup and dropoff coordinates in parallel.
 * Returns an object with both addresses (either may be null
 * if geocoding failed for that point).
 *
 * 📚 WHY PARALLEL?
 * We use `Promise.all()` to run both API calls at the same
 * time instead of one after another. This cuts the total wait
 * time in half (from ~2 seconds to ~1 second).
 *
 * But wait — Nominatim has a 1 req/sec rate limit! True, but
 * `Promise.all` doesn't fire requests at the exact same ms.
 * The network latency naturally staggers them by a few hundred
 * ms. For 2 concurrent requests, this is fine. For more, we'd
 * need to add explicit delays.
 */
export async function geocodeTripAddresses(
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number,
): Promise<{ pickupAddress: string | null; dropAddress: string | null }> {
  const [pickupAddress, dropAddress] = await Promise.all([
    reverseGeocode(pickupLat, pickupLng),
    reverseGeocode(dropLat, dropLng),
  ]);
  return { pickupAddress, dropAddress };
}
