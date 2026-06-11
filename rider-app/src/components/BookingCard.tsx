import { useState, useCallback } from 'react';
import api from '../lib/api';
import styles from './BookingCard.module.css';

// Preset drop-off locations
const PRESET_LOCATIONS = [
  { name: 'Choose a destination...', lat: 0, lng: 0 },
  { name: '✈️  Airport', lat: 12.9941, lng: 80.1709 },
  { name: '🚂  Railway Station', lat: 13.0827, lng: 80.2707 },
  { name: '🛍️  Phoenix Mall', lat: 13.0112, lng: 80.2209 },
  { name: '💻  Tech Park', lat: 12.9716, lng: 80.2437 },
  { name: '🏥  Apollo Hospital', lat: 13.0597, lng: 80.2491 },
  { name: '🎓  University', lat: 13.0108, lng: 80.2354 },
] as const;

interface BookingCardProps {
  onBook: (pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }, fare: number) => void;
  loading?: boolean;
}

interface EstimateData {
  fare: number;
  distance: number;
  eta: number;
}

function BookingCard({ onBook, loading = false }: BookingCardProps) {
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [selectedDrop, setSelectedDrop] = useState(0);
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState('');

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickupLat(position.coords.latitude.toFixed(6));
        setPickupLng(position.coords.longitude.toFixed(6));
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

    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const drop = PRESET_LOCATIONS[selectedDrop];

    if (isNaN(pLat) || isNaN(pLng)) {
      setError('Please set a valid pickup location');
      return;
    }

    if (selectedDrop === 0) {
      setError('Please select a drop-off destination');
      return;
    }

    setEstimating(true);

    try {
      const res = await api.post('/trips/estimate', {
        pickupLat: pLat,
        pickupLng: pLng,
        dropLat: drop.lat,
        dropLng: drop.lng,
      });

      setEstimate({
        fare: res.data.fare ?? res.data.estimatedFare ?? Math.round(80 + Math.random() * 200),
        distance: res.data.distance ?? res.data.estimatedDistance ?? parseFloat((2 + Math.random() * 15).toFixed(1)),
        eta: res.data.eta ?? res.data.estimatedEta ?? Math.round(5 + Math.random() * 25),
      });
    } catch (err: any) {
      // Fallback estimation if API is not available
      const dLat = pLat - drop.lat;
      const dLng = pLng - drop.lng;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
      const distKm = Math.max(1, parseFloat(dist.toFixed(1)));
      setEstimate({
        fare: Math.round(50 + distKm * 12),
        distance: distKm,
        eta: Math.round(distKm * 3 + 5),
      });
    } finally {
      setEstimating(false);
    }
  }, [pickupLat, pickupLng, selectedDrop]);

  const handleBook = useCallback(() => {
    if (!estimate) return;

    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const drop = PRESET_LOCATIONS[selectedDrop];

    onBook(
      { lat: pLat, lng: pLng },
      { lat: drop.lat, lng: drop.lng },
      estimate.fare
    );
  }, [estimate, pickupLat, pickupLng, selectedDrop, onBook]);

  const isPickupSet = pickupLat !== '' && pickupLng !== '' && !isNaN(parseFloat(pickupLat));
  const isDropSet = selectedDrop > 0;
  const canEstimate = isPickupSet && isDropSet;

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
      <div className={styles.inputGroup}>
        <label className={styles.label}>
          <span className={`${styles.labelDot} ${styles.labelDotPickup}`} />
          Pickup Location
        </label>
        <div className={styles.inputRow}>
          <button
            className={styles.locationBtn}
            onClick={handleUseCurrentLocation}
            disabled={gettingLocation}
          >
            {gettingLocation ? (
              <><span className={styles.spinner} /> Getting...</>
            ) : (
              <>📍 Use My Location</>
            )}
          </button>
        </div>
        {isPickupSet && (
          <div className={styles.coordsDisplay}>
            📌 {parseFloat(pickupLat).toFixed(4)}°N, {parseFloat(pickupLng).toFixed(4)}°E
          </div>
        )}
      </div>

      {/* Drop-off Location */}
      <div className={styles.inputGroup}>
        <label className={styles.label}>
          <span className={`${styles.labelDot} ${styles.labelDotDrop}`} />
          Drop-off Location
        </label>
        <select
          className={styles.select}
          value={selectedDrop}
          onChange={(e) => {
            setSelectedDrop(Number(e.target.value));
            setEstimate(null);
          }}
        >
          {PRESET_LOCATIONS.map((loc, idx) => (
            <option key={idx} value={idx}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Estimate Result */}
      {estimate && (
        <div className={styles.estimateResult}>
          <div className={styles.estimateItem}>
            <div className={styles.estimateLabel}>Fare</div>
            <div className={styles.estimateValue}>
              ₹{estimate.fare}
            </div>
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
