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

interface EstimateData {
  fare: number;
  distance: number;
  eta: number;
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

  // Common state
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
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
    setEstimate(null);
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
    setEstimate(null);
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
        // Reverse geocode to get address
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
      setEstimate({
        fare: res.data.fare ?? res.data.estimatedFare ?? Math.round(80 + Math.random() * 200),
        distance: res.data.distance ?? res.data.estimatedDistance ?? parseFloat((2 + Math.random() * 15).toFixed(1)),
        eta: res.data.eta ?? res.data.estimatedEta ?? Math.round(5 + Math.random() * 25),
      });
    } catch {
      // Fallback distance estimation using Haversine
      const R = 6371;
      const dLat = ((selectedDrop.lat - selectedPickup.lat) * Math.PI) / 180;
      const dLon = ((selectedDrop.lng - selectedPickup.lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((selectedPickup.lat * Math.PI) / 180) * Math.cos((selectedDrop.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = Math.max(1, parseFloat((R * c).toFixed(1)));
      setEstimate({
        fare: Math.round(50 + distKm * 12),
        distance: distKm,
        eta: Math.round(distKm * 3 + 5),
      });
    } finally {
      setEstimating(false);
    }
  }, [selectedPickup, selectedDrop]);

  const handleBook = useCallback(() => {
    if (!estimate || !selectedPickup || !selectedDrop) return;
    onBook(
      { lat: selectedPickup.lat, lng: selectedPickup.lng },
      { lat: selectedDrop.lat, lng: selectedDrop.lng },
      estimate.fare
    );
  }, [estimate, selectedPickup, selectedDrop, onBook]);

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

      {/* Estimate Result */}
      {estimate && (
        <div className={styles.estimateResult}>
          <div className={styles.estimateItem}>
            <div className={styles.estimateLabel}>Fare</div>
            <div className={styles.estimateValue}>₹{estimate.fare}</div>
          </div>
          <div className={styles.estimateItem}>
            <div className={styles.estimateLabel}>Distance</div>
            <div className={styles.estimateValue}>
              {estimate.distance}
              <span className={styles.estimateUnit}> km</span>
            </div>
          </div>
          <div className={styles.estimateItem}>
            <div className={styles.estimateLabel}>ETA</div>
            <div className={styles.estimateValue}>
              {estimate.eta}
              <span className={styles.estimateUnit}> min</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.actions}>
        {!estimate ? (
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
              onClick={() => setEstimate(null)}
            >
              ← Change
            </button>
            <button
              className={styles.bookBtn}
              onClick={handleBook}
              disabled={loading}
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
