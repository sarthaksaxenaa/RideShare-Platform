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
}

interface VehicleEstimate {
  vehicleType: string;
  label: string;
  icon: string;
  description: string;
  fare: number;
  baseFare: number;
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

function BookingCard({ onBook, loading = false }: BookingCardProps) {
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

  // Geocode search function
  const searchLocation = async (query: string): Promise<LocationSuggestion[]> => {
    if (query.trim().length < 3) return [];
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'in',
      });
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'Accept-Language': 'en' },
      });
      return await res.json();
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
    }, 400);
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
    }, 400);
  };

  const selectPickup = (suggestion: LocationSuggestion) => {
    const shortName = suggestion.display_name.split(',').slice(0, 3).join(', ');
    setSelectedPickup({ name: shortName, lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setPickupQuery(shortName);
    setPickupSuggestions([]);
    setPickupFocused(false);
  };

  const selectDrop = (suggestion: LocationSuggestion) => {
    const shortName = suggestion.display_name.split(',').slice(0, 3).join(', ');
    setSelectedDrop({ name: shortName, lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setDropQuery(shortName);
    setDropSuggestions([]);
    setDropFocused(false);
  };

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setGettingLocation(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const name = data.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setSelectedPickup({ name, lat, lng });
          setPickupQuery(name);
        } catch {
          setSelectedPickup({ name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng });
          setPickupQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setGettingLocation(false);
      },
      (err) => {
        setError(`Location error: ${err.message}`);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

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
        { vehicleType: 'bike', label: 'Bike', icon: '🏍️', description: 'Fastest in traffic', fare: Math.round(23 + chargeableKm * 9), baseFare: 23, ratePerKm: 9, timeCharge: 0 },
        { vehicleType: 'economy', label: 'Economy', icon: '🚗', description: 'Comfortable & affordable', fare: Math.round(48 + chargeableKm * 14 + durMin * 1), baseFare: 48, ratePerKm: 14, timeCharge: 1 },
        { vehicleType: 'premium', label: 'Premium', icon: '✨', description: 'Top-rated drivers & cars', fare: Math.round(78 + chargeableKm * 21 + durMin * 2), baseFare: 78, ratePerKm: 21, timeCharge: 2 },
      ]);
      setDistance(distKm);
      setEta(durMin);
      setSelectedVehicle('economy');
    } finally {
      setEstimating(false);
    }
  }, [selectedPickup, selectedDrop]);

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

  const canEstimate = !!selectedPickup && !!selectedDrop;

  return (
    <div className={styles.card}>
      <div className={styles.handle} />

      <div className={styles.title}>
        <span className={styles.titleIcon}>🚀</span>
        Book a Ride
      </div>
      <div className={styles.subtitle}>Where would you like to go?</div>

      {error && (
        <div className={styles.error}>
          ⚠️ {error}
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
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.actions}>
        {!estimates ? (
          <button
            className={styles.estimateBtn}
            onClick={handleEstimate}
            disabled={!canEstimate || estimating}
          >
            {estimating ? (
              <><span className={styles.spinner} /> Calculating...</>
            ) : (
              <>💰 Estimate Fare</>
            )}
          </button>
        ) : (
          <>
            <button
              className={styles.estimateBtn}
              onClick={() => { setEstimates(null); setSelectedVehicle(null); }}
            >
              ← Change
            </button>
            <button
              className={styles.bookBtn}
              onClick={handleBook}
              disabled={loading || !selectedVehicle}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                <>✨ Confirm Booking</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default BookingCard;
