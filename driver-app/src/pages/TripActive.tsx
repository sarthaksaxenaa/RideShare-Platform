import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useLocation } from '../hooks/useLocation';
import MapView from '../components/Map';
import api from '../lib/api';
import styles from './TripActive.module.css';
import type { MarkerData } from '../components/Map';

interface TripDetails {
  _id: string;
  status: string;
  fare: number;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  riderName?: string;
}

function TripActivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { socket } = useSocket();
  const [trip, setTrip] = useState<TripDetails | null>(null);
  const [tripStatus, setTripStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [tripEarnings, setTripEarnings] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep GPS active during the trip
  const { currentPosition } = useLocation(socket, true);

  // Fetch trip details
  useEffect(() => {
    async function fetchTrip() {
      if (!id) return;
      try {
        const res = await api.get(`/trips/${id}`);
        const tripData: TripDetails = res.data.trip || res.data;
        setTrip(tripData);
        setTripStatus(tripData.status);
      } catch (err) {
        console.error('Failed to fetch trip:', err);
        setError('Failed to load trip details');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrip();
  }, [id]);

  // Listen for trip events
  useEffect(() => {
    if (!socket) return;

    const handleTripCompleted = (data: { tripId: string; fare: number }) => {
      if (data.tripId === id) {
        setIsCompleted(true);
        setTripEarnings(data.fare || trip?.fare || 0);
        setTripStatus('COMPLETED');
      }
    };

    const handleTripStarted = (data: { tripId: string }) => {
      if (data.tripId === id) {
        setTripStatus('STARTED');
      }
    };

    socket.on('trip:completed', handleTripCompleted);
    socket.on('trip:started', handleTripStarted);

    return () => {
      socket.off('trip:completed', handleTripCompleted);
      socket.off('trip:started', handleTripStarted);
    };
  }, [socket, id, trip?.fare]);

  const handleArrivedAtPickup = useCallback(() => {
    if (!socket || !id || isSubmitting) return;
    setIsSubmitting(true);
    socket.emit('trip:start', { tripId: id });
    setTripStatus('STARTED');
    setIsSubmitting(false);
  }, [socket, id, isSubmitting]);

  const handleCompleteTrip = useCallback(() => {
    if (!socket || !id || isSubmitting) return;
    setIsSubmitting(true);
    socket.emit('trip:complete', { tripId: id });
    // The completed state will be set by the socket event listener
    // Fallback: set completed after a short delay
    setTimeout(() => {
      setIsCompleted(true);
      setTripEarnings(trip?.fare || 0);
      setTripStatus('COMPLETED');
      setIsSubmitting(false);
    }, 2000);
  }, [socket, id, isSubmitting, trip?.fare]);

  const handleBackToDashboard = () => {
    navigate('/', { replace: true });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <div className={styles.loadingText}>Loading trip details...</div>
      </div>
    );
  }

  // Error state
  if (error || !trip) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <div className={styles.errorText}>{error || 'Trip not found'}</div>
        <button className={styles.errorBtn} onClick={handleBackToDashboard}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // Build map markers
  const markers: MarkerData[] = [];

  if (currentPosition) {
    markers.push({ position: currentPosition, type: 'driver' });
  }

  markers.push({
    position: { lat: trip.pickupLat, lng: trip.pickupLng },
    type: 'pickup',
  });

  markers.push({
    position: { lat: trip.dropLat, lng: trip.dropLng },
    type: 'dropoff',
  });

  // Center on driver position if available, else on pickup
  const mapCenter = currentPosition || {
    lat: trip.pickupLat,
    lng: trip.pickupLng,
  };

  // Determine status display
  const getStatusConfig = () => {
    switch (tripStatus) {
      case 'MATCHED':
        return {
          icon: '📍',
          title: 'Heading to Pickup',
          subtitle: 'Navigate to the rider\'s location',
          bannerClass: styles.statusBannerPickup,
        };
      case 'STARTED':
        return {
          icon: '🚗',
          title: 'Trip in Progress',
          subtitle: 'Heading to the destination',
          bannerClass: styles.statusBannerInProgress,
        };
      case 'COMPLETED':
        return {
          icon: '✅',
          title: 'Trip Completed',
          subtitle: 'Great job!',
          bannerClass: styles.statusBannerCompleted,
        };
      default:
        return {
          icon: '⏳',
          title: 'Trip Active',
          subtitle: `Status: ${tripStatus}`,
          bannerClass: styles.statusBannerPickup,
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={handleBackToDashboard}>
          <span className={styles.backArrow}>←</span>
          Dashboard
        </button>
        <span className={styles.tripIdLabel}>
          Trip #{id?.slice(-6).toUpperCase()}
        </span>
      </header>

      {/* Status Banner */}
      <div className={`${styles.statusBanner} ${statusConfig.bannerClass}`}>
        <span className={styles.statusIcon}>{statusConfig.icon}</span>
        <div className={styles.statusTextGroup}>
          <div className={styles.statusTitle}>{statusConfig.title}</div>
          <div className={styles.statusSubtitle}>{statusConfig.subtitle}</div>
        </div>
      </div>

      {/* Map */}
      <div className={styles.mapSection}>
        <MapView center={mapCenter} zoom={14} markers={markers} />
      </div>

      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <div className={styles.controlCard}>
          {/* Trip Info */}
          <div className={styles.tripInfoGrid}>
            <div className={styles.tripInfoItem}>
              <div className={styles.tripInfoLabel}>Pickup</div>
              <div className={styles.tripInfoValue}>
                {trip.pickupLat.toFixed(4)}, {trip.pickupLng.toFixed(4)}
              </div>
            </div>
            <div className={styles.tripInfoItem}>
              <div className={styles.tripInfoLabel}>Drop-off</div>
              <div className={styles.tripInfoValue}>
                {trip.dropLat.toFixed(4)}, {trip.dropLng.toFixed(4)}
              </div>
            </div>
            <div className={styles.tripInfoItem}>
              <div className={styles.tripInfoLabel}>Fare</div>
              <div className={`${styles.tripInfoValue} ${styles.tripInfoFare}`}>
                ₹{(trip.fare / 100).toFixed(0)}
              </div>
            </div>
            <div className={styles.tripInfoItem}>
              <div className={styles.tripInfoLabel}>Status</div>
              <div className={styles.tripInfoValue}>
                {tripStatus}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {tripStatus === 'MATCHED' && (
            <button
              className={`${styles.actionBtn} ${styles.arrivedBtn}`}
              onClick={handleArrivedAtPickup}
              disabled={isSubmitting}
            >
              🏁 Arrived at Pickup
            </button>
          )}

          {tripStatus === 'STARTED' && (
            <button
              className={`${styles.actionBtn} ${styles.completeBtn}`}
              onClick={handleCompleteTrip}
              disabled={isSubmitting}
            >
              ✅ Complete Trip
            </button>
          )}

          {tripStatus !== 'MATCHED' && tripStatus !== 'STARTED' && tripStatus !== 'COMPLETED' && (
            <button
              className={`${styles.actionBtn} ${styles.arrivedBtn} ${styles.disabledBtn}`}
              disabled
            >
              Waiting...
            </button>
          )}
        </div>
      </div>

      {/* Completed Overlay */}
      {isCompleted && (
        <div className={styles.completedOverlay}>
          <div className={styles.completedCard}>
            <div className={styles.completedEmoji}>🎉</div>
            <div className={styles.completedTitle}>Trip Completed!</div>
            <div className={styles.completedSubtitle}>
              You have successfully completed this ride
            </div>

            <div className={styles.earningsDisplay}>
              <div className={styles.earningsLabel}>You Earned</div>
              <div className={styles.earningsAmount}>
                ₹{(tripEarnings / 100).toFixed(0)}
              </div>
            </div>

            <button
              className={styles.backToDashBtn}
              onClick={handleBackToDashboard}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TripActivePage;
