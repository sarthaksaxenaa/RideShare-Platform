import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import useTrip from '../hooks/useTrip';
import Map, { type MapMarker } from '../components/Map';
import BookingCard from '../components/BookingCard';
import PaymentForm from '../components/PaymentForm';
import api from '../lib/api';
import styles from './Home.module.css';

// Default center: Chennai, India
const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707];

/**
 * Booking flow states:
 *  idle → booking → paying → searching → matched → navigate to /trip/:id
 *
 * - idle: Show BookingCard overlay
 * - booking: BookingCard submitted, calling POST /api/trips/book
 * - paying: PaymentForm overlay (Stripe Elements)
 * - searching: "Finding your driver..." overlay (after card authorized)
 * - matched: Auto-navigate to /trip/:id
 */
type BookingFlow = 'idle' | 'booking' | 'paying' | 'searching';

interface PaymentData {
  tripId: string;
  clientSecret: string;
  fare: number;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

function HomePage() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { tripState, tripData, requestTrip, cancelTrip, resetTrip } = useTrip(socket);

  const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [nearbyDrivers, setNearbyDrivers] = useState<Array<{ lat: number; lng: number; id: string }>>([]);
  const [bookingFlow, setBookingFlow] = useState<BookingFlow>('idle');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Get rider's current location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setRiderLocation(DEFAULT_CENTER);
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRiderLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationLoading(false);
      },
      () => {
        setRiderLocation(DEFAULT_CENTER);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Listen for nearby driver locations
  useEffect(() => {
    if (!socket) return;

    const handleDriverLocations = (data: any) => {
      if (Array.isArray(data)) {
        setNearbyDrivers(data.map((d: any) => ({ lat: d.lat, lng: d.lng, id: d.driverId || d.id })));
      } else if (data?.lat && data?.lng) {
        setNearbyDrivers((prev) => {
          const id = data.driverId || data.id || 'unknown';
          const exists = prev.findIndex((d) => d.id === id);
          if (exists >= 0) {
            const updated = [...prev];
            updated[exists] = { lat: data.lat, lng: data.lng, id };
            return updated;
          }
          return [...prev, { lat: data.lat, lng: data.lng, id }];
        });
      }
    };

    socket.on('drivers:nearby', handleDriverLocations);
    socket.on('driver:location', handleDriverLocations);

    if (riderLocation) {
      socket.emit('drivers:request', { lat: riderLocation[0], lng: riderLocation[1] });
    }

    return () => {
      socket.off('drivers:nearby', handleDriverLocations);
      socket.off('driver:location', handleDriverLocations);
    };
  }, [socket, riderLocation]);

  // Navigate to trip page when matched
  useEffect(() => {
    if (tripState === 'matched' && tripData?.tripId) {
      navigate(`/trip/${tripData.tripId}`);
    }
  }, [tripState, tripData, navigate]);

  /**
   * Step 1: User confirms booking → create trip + PaymentIntent
   */
  const handleBook = useCallback(
    async (pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }, fare: number) => {
      setBookingFlow('booking');
      setBookingError(null);

      try {
        const res = await api.post('/trips/book', {
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropLat: drop.lat,
          dropLng: drop.lng,
          fare,
        });

        setPaymentData({
          tripId: res.data.tripId,
          clientSecret: res.data.clientSecret,
          fare,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropLat: drop.lat,
          dropLng: drop.lng,
        });
        setBookingFlow('paying');
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Failed to create booking. Please try again.';
        setBookingError(msg);
        setBookingFlow('idle');
      }
    },
    []
  );

  /**
   * Step 2: Card authorized → emit trip:request to start driver matching
   */
  const handlePaymentSuccess = useCallback(() => {
    if (!paymentData) return;
    setBookingFlow('searching');
    requestTrip(
      paymentData.pickupLat,
      paymentData.pickupLng,
      paymentData.dropLat,
      paymentData.dropLng,
      paymentData.fare
    );
  }, [paymentData, requestTrip]);

  /**
   * Cancel payment → go back to idle
   */
  const handlePaymentCancel = useCallback(() => {
    setBookingFlow('idle');
    setPaymentData(null);
  }, []);

  const handleCancelSearch = useCallback(() => {
    if (tripData?.tripId) {
      cancelTrip(tripData.tripId, 'Rider cancelled search');
    }
    resetTrip();
    setBookingFlow('idle');
    setPaymentData(null);
  }, [tripData, cancelTrip, resetTrip]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  }, [navigate]);

  // Build markers array
  const markers: MapMarker[] = [];

  if (riderLocation) {
    markers.push({
      lat: riderLocation[0],
      lng: riderLocation[1],
      label: 'You are here',
      type: 'rider',
    });
  }

  nearbyDrivers.forEach((driver) => {
    markers.push({
      lat: driver.lat,
      lng: driver.lng,
      label: 'Available Driver',
      type: 'driver',
    });
  });

  // Loading state
  if (locationLoading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingSpinner} />
        <div className={styles.loadingText}>Getting your location...</div>
      </div>
    );
  }

  const center = riderLocation || DEFAULT_CENTER;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>🚀</span>
          <span className={styles.brandText}>RideShare</span>
        </div>
        <div className={styles.headerRight}>
          <div
            className={`${styles.connectionDot} ${
              isConnected ? styles.connected : styles.disconnected
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
          <button className={styles.logoutBtn} onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Full-Screen Map */}
      <div className={styles.mapContainer}>
        <Map center={center} zoom={14} markers={markers} fullscreen />
      </div>

      {/* Booking Error Toast */}
      {bookingError && (
        <div className={styles.errorToast}>
          <span>⚠️ {bookingError}</span>
          <button onClick={() => setBookingError(null)}>✕</button>
        </div>
      )}

      {/* Payment Form Overlay */}
      {bookingFlow === 'paying' && paymentData && (
        <PaymentForm
          clientSecret={paymentData.clientSecret}
          amount={paymentData.fare}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}

      {/* Searching Overlay */}
      {bookingFlow === 'searching' || tripState === 'requesting' ? (
        <div className={styles.searchingOverlay}>
          <div className={styles.searchingContent}>
            <div className={styles.searchingPulse}>
              <span className={styles.searchingIcon}>🔍</span>
            </div>
            <div className={styles.searchingTitle}>Finding your driver...</div>
            <div className={styles.searchingSubtitle}>
              Payment authorized! Matching you with the best available driver nearby
            </div>
            <div className={styles.searchingDots}>
              <div className={styles.dot} />
              <div className={styles.dot} />
              <div className={styles.dot} />
            </div>
            <button className={styles.cancelSearchBtn} onClick={handleCancelSearch}>
              ✕ Cancel Search
            </button>
          </div>
        </div>
      ) : bookingFlow === 'idle' || bookingFlow === 'booking' ? (
        <div className={styles.bookingOverlay}>
          <BookingCard onBook={handleBook} loading={bookingFlow === 'booking'} />
        </div>
      ) : null}
    </div>
  );
}

export default HomePage;
