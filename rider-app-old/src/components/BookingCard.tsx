import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../lib/api';
import styles from './BookingCard.module.css';

// Nominatim API for geocoding (free, no API key needed)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface BookingCardProps {
  onBook: (pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }, fare: number) => void;
  loading?: boolean;
  onLocationChange?: (pickup: [number, number] | null, dropoff: [number, number] | null) => void;
}

interface VehicleEstimate {
  vehicleType: string;
  label: string;
  icon: string;
  description: string;
  fare: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  platformFee: number;
  ratePerKm: number;
  timeCharge: number;
}

interface EstimateResponse {
  estimates: VehicleEstimate[];
  distanceKm: number;
  estimatedDuration: number;
}

interface SelectedLocation {
  name: string;
  lat: number;
  lng: number;
}

function BookingCard({ onBook, loading = false, onLocationChange }: BookingCardProps) {
  // Pickup state
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedPickup, setSelectedPickup] = useState<SelectedLocation | null>(null);
  const [pickupFocused, setPickupFocused] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Drop-off state
  const [dropQuery, setDropQuery] = useState('');
  const [dropSuggestions, setDropSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedDrop, setSelectedDrop] = useState<SelectedLocation | null>(null);
  const [dropFocused, setDropFocused] = useState(false);

  // Estimate state
  const [estimates, setEstimates] = useState<VehicleEstimate[] | null>(null);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');

  // Debounce refs
  const pickupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupWrapperRef = useRef<HTMLDivElement>(null);
  const dropWrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickupWrapperRef.current && !pickupWrapperRef.current.contains(e.target as Node)) {
        setPickupFocused(false);
      }
      if (dropWrapperRef.current && !dropWrapperRef.current.contains(e.target as Node)) {
        setDropFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Store user's current position for biasing search results nearby
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Get user's position once for search biasing
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        },
        () => { /* ignore — search will work without bias */ },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  // Production-grade geocode search: biased to user's location
  const searchLocation = async (query: string): Promise<LocationSuggestion[]> => {
    if (query.trim().length < 2) return [];
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '8',
        countrycodes: 'in',
        dedupe: '1',
      });

      // Bias search results within ~50km of user's current position
      if (userPosRef.current) {
        const { lat, lng } = userPosRef.current;
        const delta = 0.45; // ~50km in degrees
        params.set('viewbox', `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
        params.set('bounded', '0'); // prefer within viewbox but also show outside
      }

      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await res.json();

      // Sort by proximity to user if position available
      if (userPosRef.current && Array.isArray(data) && data.length > 1) {
        const uLat = userPosRef.current.lat;
        const uLng = userPosRef.current.lng;
        data.sort((a: LocationSuggestion, b: LocationSuggestion) => {
          const distA = Math.abs(parseFloat(a.lat) - uLat) + Math.abs(parseFloat(a.lon) - uLng);
          const distB = Math.abs(parseFloat(b.lat) - uLat) + Math.abs(parseFloat(b.lon) - uLng);
          return distA - distB;
        });
      }

      return data;
    } catch {
      return [];
    }
  };

  // Pickup input change with debounce
  const handlePickupChange = (value: string) => {
    setPickupQuery(value);
    setSelectedPickup(null);
    setEstimates(null);
    setSelectedVehicle(null);
    if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
    pickupTimerRef.current = setTimeout(async () => {
      const results = await searchLocation(value);
      setPickupSuggestions(results);
    }, 300);
  };

  // Drop input change with debounce
  const handleDropChange = (value: string) => {
    setDropQuery(value);
    setSelectedDrop(null);
    setEstimates(null);
    setSelectedVehicle(null);
    if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    dropTimerRef.current = setTimeout(async () => {
      const results = await searchLocation(value);
      setDropSuggestions(results);
    }, 300);
  };

  const selectPickup = (suggestion: LocationSuggestion) => {
    const shortName = suggestion.display_name.split(',').slice(0, 3).join(', ');
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    setSelectedPickup({ name: shortName, lat, lng });
    setPickupQuery(shortName);
    setPickupSuggestions([]);
    setPickupFocused(false);
    if (onLocationChange) onLocationChange([lat, lng], selectedDrop ? [selectedDrop.lat, selectedDrop.lng] : null);
  };

  const selectDrop = (suggestion: LocationSuggestion) => {
    const shortName = suggestion.display_name.split(',').slice(0, 3).join(', ');
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    setSelectedDrop({ name: shortName, lat, lng });
    setDropQuery(shortName);
    setDropSuggestions([]);
    setDropFocused(false);
    if (onLocationChange) onLocationChange(selectedPickup ? [selectedPickup.lat, selectedPickup.lng] : null, [lat, lng]);
  };

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setGettingLocation(true);
    setError('');

    // Use watchPosition to get the most precise GPS fix available.
    // The browser refines accuracy over time — we wait for < 50m accuracy
    // or take the best result after 8 seconds.
    let bestPosition: GeolocationPosition | null = null;
    let settled = false;

    const finalize = async (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      try {
        // Use zoom=18 for building-level reverse geocoding precision
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        // Build a precise address: road + neighbourhood + suburb
        const addr = data.address || {};
        const parts = [
          addr.road || addr.pedestrian || addr.footway || '',
          addr.neighbourhood || addr.suburb || addr.hamlet || '',
          addr.city || addr.town || addr.village || addr.county || '',
        ].filter(Boolean);
        const name = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSelectedPickup({ name, lat, lng });
        setPickupQuery(name);
        if (onLocationChange) onLocationChange([lat, lng], selectedDrop ? [selectedDrop.lat, selectedDrop.lng] : null);
      } catch {
        const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSelectedPickup({ name: fallback, lat, lng });
        setPickupQuery(fallback);
        if (onLocationChange) onLocationChange([lat, lng], selectedDrop ? [selectedDrop.lat, selectedDrop.lng] : null);
      }
      setGettingLocation(false);
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy; // meters
        // Keep the most accurate reading
        if (!bestPosition || accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        // If we have good enough accuracy (< 50 meters), finalize immediately
        if (accuracy <= 50) {
          finalize(position);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          // If we have any position at all, use it
          if (bestPosition) {
            finalize(bestPosition);
          } else {
            setError(`Location error: ${err.message}`);
            setGettingLocation(false);
          }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0, // Force fresh GPS reading, never use cache
      }
    );

    // Safety timeout: after 8 seconds, use the best position we have
    const timer = setTimeout(() => {
      if (!settled && bestPosition) {
        finalize(bestPosition);
      }
    }, 8000);
  }, [onLocationChange, selectedDrop]);

  // Haversine helper for client-side fallback
  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleEstimate = useCallback(async () => {
    setError('');
    if (!selectedPickup) {
      setError('Please set a valid pickup location');
      return;
    }
    if (!selectedDrop) {
      setError('Please set a valid drop-off location');
      return;
    }
    setEstimating(true);
    try {
      const res = await api.post('/trips/estimate', {
        pickupLat: selectedPickup.lat,
        pickupLng: selectedPickup.lng,
        dropLat: selectedDrop.lat,
        dropLng: selectedDrop.lng,
      });
      const data: EstimateResponse = res.data;
      setEstimates(data.estimates);
      setDistance(data.distanceKm);
      setEta(data.estimatedDuration);
      setSelectedVehicle('economy'); // default selection
    } catch {
      // Client-side fallback
      const distKm = Math.max(1, Math.round(haversine(selectedPickup.lat, selectedPickup.lng, selectedDrop.lat, selectedDrop.lng) * 1.3 * 10) / 10);
      const durMin = Math.round(distKm * 2 + 5);
      const chargeableKm = Math.max(0, distKm - 2);
      setEstimates([
        { vehicleType: 'bike', label: 'Bike', icon: '🏍️', description: 'Fastest in traffic', fare: Math.round(23 + chargeableKm * 9), baseFare: 23, distanceFare: Math.round(chargeableKm * 9), timeFare: 0, platformFee: 10, ratePerKm: 9, timeCharge: 0 },
        { vehicleType: 'auto', label: 'Auto', icon: '🛺', description: 'No surge pricing', fare: Math.round(35 + chargeableKm * 12 + durMin * 1), baseFare: 35, distanceFare: Math.round(chargeableKm * 12), timeFare: durMin * 1, platformFee: 10, ratePerKm: 12, timeCharge: 1 },
        { vehicleType: 'mini', label: 'Mini', icon: '🚙', description: 'Budget 4-seater', fare: Math.round(42 + chargeableKm * 13 + durMin * 1), baseFare: 42, distanceFare: Math.round(chargeableKm * 13), timeFare: durMin * 1, platformFee: 10, ratePerKm: 13, timeCharge: 1 },
        { vehicleType: 'economy', label: 'Economy', icon: '🚗', description: 'Comfortable & affordable', fare: Math.round(48 + chargeableKm * 14 + durMin * 1), baseFare: 48, distanceFare: Math.round(chargeableKm * 14), timeFare: durMin * 1, platformFee: 10, ratePerKm: 14, timeCharge: 1 },
        { vehicleType: 'sedan', label: 'Sedan', icon: '🚘', description: 'Spacious & smooth', fare: Math.round(65 + chargeableKm * 18 + durMin * 1.5), baseFare: 65, distanceFare: Math.round(chargeableKm * 18), timeFare: Math.round(durMin * 1.5), platformFee: 10, ratePerKm: 18, timeCharge: 1.5 },
        { vehicleType: 'premium', label: 'Premium', icon: '✨', description: 'Luxury experience', fare: Math.round(85 + chargeableKm * 24 + durMin * 2), baseFare: 85, distanceFare: Math.round(chargeableKm * 24), timeFare: durMin * 2, platformFee: 10, ratePerKm: 24, timeCharge: 2 },
      ]);
      setDistance(distKm);
      setEta(durMin);
      setSelectedVehicle('economy');
    } finally {
      setEstimating(false);
    }
  }, [selectedPickup, selectedDrop]);

  // Auto-estimate fare when both locations are set
  useEffect(() => {
    if (selectedPickup && selectedDrop && !estimates && !estimating) {
      handleEstimate();
    }
  }, [selectedPickup, selectedDrop, estimates, estimating, handleEstimate]);

  const handleBook = useCallback(() => {
    if (!estimates || !selectedPickup || !selectedDrop || !selectedVehicle) return;
    const chosen = estimates.find(e => e.vehicleType === selectedVehicle);
    if (!chosen) return;
    onBook(
      { lat: selectedPickup.lat, lng: selectedPickup.lng },
      { lat: selectedDrop.lat, lng: selectedDrop.lng },
      chosen.fare
    );
  }, [estimates, selectedPickup, selectedDrop, selectedVehicle, onBook]);

  return (
    <div className={styles.card}>
      <div className={styles.handle} />

      <div className={styles.title}>
        Book a Ride
      </div>
      <div className={styles.subtitle}>Where would you like to go?</div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {/* Pickup Location */}
      <div className={styles.inputGroup} ref={pickupWrapperRef}>
        <label className={styles.label}>
          <span className={`${styles.labelDot} ${styles.labelDotPickup}`} />
          Pickup Location
        </label>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            type="text"
            placeholder="Search pickup location..."
            value={pickupQuery}
            onChange={(e) => handlePickupChange(e.target.value)}
            onFocus={() => setPickupFocused(true)}
          />
          <button
            className={styles.locationBtn}
            onClick={handleUseCurrentLocation}
            disabled={gettingLocation}
            title="Use my current GPS location"
          >
            {gettingLocation ? (
              <><span className={styles.spinner} /> GPS</>
            ) : (
              <>📍</>
            )}
          </button>
        </div>
        {pickupFocused && pickupSuggestions.length > 0 && (
          <div className={styles.suggestions}>
            {pickupSuggestions.map((s, i) => (
              <button
                key={i}
                className={styles.suggestionItem}
                onClick={() => selectPickup(s)}
              >
                <span className={styles.suggestionIcon}>📍</span>
                <span className={styles.suggestionText}>
                  {s.display_name.split(',').slice(0, 3).join(', ')}
                </span>
              </button>
            ))}
          </div>
        )}
        {selectedPickup && (
          <div className={styles.coordsDisplay}>
            ✓ {selectedPickup.name}
          </div>
        )}
      </div>

      {/* Drop-off Location */}
      <div className={styles.inputGroup} ref={dropWrapperRef}>
        <label className={styles.label}>
          <span className={`${styles.labelDot} ${styles.labelDotDrop}`} />
          Drop-off Location
        </label>
        <input
          className={styles.input}
          type="text"
          placeholder="Search drop-off location..."
          value={dropQuery}
          onChange={(e) => handleDropChange(e.target.value)}
          onFocus={() => setDropFocused(true)}
        />
        {dropFocused && dropSuggestions.length > 0 && (
          <div className={styles.suggestions}>
            {dropSuggestions.map((s, i) => (
              <button
                key={i}
                className={styles.suggestionItem}
                onClick={() => selectDrop(s)}
              >
                <span className={styles.suggestionIcon}>🔴</span>
                <span className={styles.suggestionText}>
                  {s.display_name.split(',').slice(0, 3).join(', ')}
                </span>
              </button>
            ))}
          </div>
        )}
        {selectedDrop && (
          <div className={styles.coordsDisplay}>
            ✓ {selectedDrop.name}
          </div>
        )}
      </div>

      {/* Vehicle Selection Cards */}
      {estimates && (
        <div className={styles.vehicleSection}>
          <div className={styles.vehicleSectionHeader}>
            <span className={styles.vehicleSectionTitle}>Choose your ride</span>
            <span className={styles.vehicleSectionMeta}>
              {distance} km · {eta} min
            </span>
          </div>
          <div className={styles.vehicleGrid}>
            {estimates.map((est) => (
              <button
                key={est.vehicleType}
                className={`${styles.vehicleCard} ${
                  selectedVehicle === est.vehicleType ? styles.vehicleCardActive : ''
                }`}
                onClick={() => setSelectedVehicle(est.vehicleType)}
              >
                <div className={styles.vehicleIcon}>{est.icon}</div>
                <div className={styles.vehicleInfo}>
                  <div className={styles.vehicleName}>{est.label}</div>
                  <div className={styles.vehicleDesc}>{est.description}</div>
                </div>
                <div className={styles.vehiclePrice}>₹{est.fare}</div>
              </button>
            ))}
          </div>

          {/* Fare Breakdown for Selected Vehicle */}
          {selectedVehicle && (
            <div className={styles.fareBreakdown}>
              <div className={styles.fareBreakdownTitle}>Fare Breakdown</div>
              {estimates
                .filter((e) => e.vehicleType === selectedVehicle)
                .map((est) => (
                  <div key="breakdown" className={styles.fareBreakdownList}>
                    <div className={styles.fareBreakdownRow}>
                      <span>Base Fare</span>
                      <span>₹{est.baseFare}</span>
                    </div>
                    <div className={styles.fareBreakdownRow}>
                      <span>Distance Fare ({distance} km)</span>
                      <span>₹{est.distanceFare || 0}</span>
                    </div>
                    <div className={styles.fareBreakdownRow}>
                      <span>Time Fare ({eta} min)</span>
                      <span>₹{est.timeFare || 0}</span>
                    </div>
                    <div className={styles.fareBreakdownRow}>
                      <span>Platform Fee</span>
                      <span>₹{est.platformFee || 10}</span>
                    </div>
                    <div className={`${styles.fareBreakdownRow} ${styles.fareBreakdownTotal}`}>
                      <span>Total Estimated Fare</span>
                      <span>₹{est.fare}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.actions}>
        {estimating && !estimates && (
          <div className={styles.estimatingBar}>
            <span className={styles.spinner} /> Calculating fare...
          </div>
        )}
        {estimates && (
          <>
            <button
              className={styles.estimateBtn}
              onClick={() => { setEstimates(null); setSelectedVehicle(null); }}
            >
              Change Locations
            </button>
            <button
              className={styles.bookBtn}
              onClick={handleBook}
              disabled={loading || !selectedVehicle}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                <>Confirm Booking</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default BookingCard;
