import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import { useDriverLocation } from '../hooks/useDriverLocation';
import Map from '../components/Map';
import TripRequest from '../components/TripRequest';
import api from '../lib/api';
import styles from './DriverHome.module.css';
import type { MapMarker } from '../components/Map';

interface TripData {
  tripId: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare: number;
  riderName: string;
}

interface TripRecord {
  _id: string;
  status: string;
  fare: number;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  createdAt: string;
}

function DriverHomePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('Driver');
  const [isOnline, setIsOnline] = useState(false);
  const [incomingTrip, setIncomingTrip] = useState<TripData | null>(null);
  const [completedTrips, setCompletedTrips] = useState<TripRecord[]>([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayTripCount, setTodayTripCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const { socket, isConnected } = useSocket();
  const { currentPosition, error: locationError } = useDriverLocation(socket, isOnline);

  // Load user name from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const user = JSON.parse(raw);
        if (user.name) setUserName(user.name);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Fetch trips and compute earnings
  useEffect(() => {
    async function fetchTrips() {
      try {
        const res = await api.get('/trips');
        const trips: TripRecord[] = res.data.trips || res.data || [];
        const completed = trips.filter((t) => t.status === 'COMPLETED');

        // Compute today's earnings
        const todayStr = new Date().toISOString().slice(0, 10);
        const todaysTrips = completed.filter(
          (t) => t.createdAt && t.createdAt.slice(0, 10) === todayStr
        );
        const earnings = todaysTrips.reduce((sum, t) => sum + (t.fare || 0), 0);

        setCompletedTrips(completed.slice(0, 20)); // last 20
        setTodayEarnings(earnings);
        setTodayTripCount(todaysTrips.length);
      } catch (err) {
        console.error('Failed to fetch trips:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrips();
  }, []);

  // Listen for incoming trip requests
  useEffect(() => {
    if (!socket) return;

    const handleNewRequest = (data: TripData) => {
      console.log('[Home] New trip request:', data);
      setIncomingTrip(data);
    };

    socket.on('trip:new_request', handleNewRequest);

    return () => {
      socket.off('trip:new_request', handleNewRequest);
    };
  }, [socket]);

  const handleGoOnline = useCallback(() => {
    setIsOnline(true);
    if (socket) {
      socket.emit('driver:go_online');
    }
  }, [socket]);

  const handleGoOffline = useCallback(() => {
    setIsOnline(false);
    if (socket) {
      socket.emit('driver:go_offline');
    }
  }, [socket]);

  const toggleOnline = useCallback(() => {
    if (isOnline) {
      handleGoOffline();
    } else {
      handleGoOnline();
    }
  }, [isOnline, handleGoOnline, handleGoOffline]);

  const handleAcceptTrip = useCallback(
    (tripId: string) => {
      if (socket) {
        socket.emit('trip:accept', { tripId });
      }
      setIncomingTrip(null);
      navigate(`/trip/${tripId}`);
    },
    [socket, navigate]
  );

  const handleDeclineTrip = useCallback(() => {
    setIncomingTrip(null);
  }, []);

  const handleLogout = () => {
    if (socket && isOnline) {
      socket.emit('driver:go_offline');
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatFare = (fareInPaise: number) => {
    return `₹${fareInPaise.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <div className={styles.loadingText}>Loading dashboard...</div>
      </div>
    );
  }

  // Build map markers
  const markers: MapMarker[] = [];
  if (currentPosition) {
    markers.push({ lat: currentPosition.lat, lng: currentPosition.lng, label: 'You', type: 'driver' });
  }

  const defaultCenter: [number, number] = currentPosition
    ? [currentPosition.lat, currentPosition.lng]
    : [28.6139, 77.209];

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.brandSection}>
          <span className={styles.brandIcon}>🚗</span>
          <div className={styles.brandText}>
            <span className={styles.brandName}>RideShare</span>
            <span className={styles.greeting}>
              Hello, {userName}
              {isConnected ? '' : ' · Reconnecting...'}
            </span>
          </div>
        </div>
        <div className={styles.topBarActions}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Online/Offline Toggle */}
      <div className={styles.statusSection}>
        <div className={styles.statusInfo}>
          <div
            className={`${styles.statusDot} ${
              isOnline ? styles.statusDotOnline : styles.statusDotOffline
            }`}
          />
          <div>
            <div className={styles.statusLabel}>
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <div className={styles.statusSubtext}>
              {isOnline
                ? 'Accepting ride requests'
                : 'Go online to start earning'}
            </div>
          </div>
        </div>
        <div
          className={`${styles.toggleSwitch} ${
            isOnline ? styles.toggleSwitchOn : ''
          }`}
          onClick={toggleOnline}
          role="switch"
          aria-checked={isOnline}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleOnline();
          }}
        >
          <div
            className={`${styles.toggleKnob} ${
              isOnline ? styles.toggleKnobOn : ''
            }`}
          />
        </div>
      </div>

      {/* Location Error */}
      {locationError && (
        <div className={styles.locationError}>
          <span className={styles.locationErrorIcon}>⚠️</span>
          {locationError}
        </div>
      )}

      {/* Map */}
      <div className={styles.mapSection}>
        {isOnline && currentPosition ? (
          <Map center={defaultCenter} zoom={16} markers={markers} />
        ) : (
          <div className={styles.mapPlaceholder}>
            <div className={styles.mapPlaceholderIcon}>🗺️</div>
            <div className={styles.mapPlaceholderText}>
              {isOnline
                ? 'Acquiring GPS location...'
                : 'Go online to see your location'}
            </div>
          </div>
        )}
      </div>

      {/* Earnings Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Today&apos;s Earnings</div>
          <div className={styles.statValue}>
            ₹{todayEarnings.toFixed(0)}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Trips Today</div>
          <div className={styles.statValue}>
            {todayTripCount}
            <span className={styles.statUnit}> rides</span>
          </div>
        </div>
      </div>

      {/* Trip History */}
      <div className={styles.historySection}>
        <div className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>📋</span>
          Recent Trips
        </div>
        {completedTrips.length > 0 ? (
          <div className={styles.tripList}>
            {completedTrips.map((trip) => (
              <div key={trip._id} className={styles.tripItem}>
                <div className={styles.tripIcon}>✓</div>
                <div className={styles.tripDetails}>
                  <div className={styles.tripRoute}>
                    ({trip.pickupLat.toFixed(3)}, {trip.pickupLng.toFixed(3)}) →
                    ({trip.dropLat.toFixed(3)}, {trip.dropLng.toFixed(3)})
                  </div>
                  <div className={styles.tripTime}>
                    {formatTime(trip.createdAt)}
                  </div>
                </div>
                <div className={styles.tripFare}>
                  {formatFare(trip.fare)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🚕</div>
            <div className={styles.emptyText}>No completed trips yet</div>
            <div className={styles.emptySubtext}>
              Go online and accept rides to get started
            </div>
          </div>
        )}
      </div>

      {/* Incoming Trip Request Overlay */}
      {incomingTrip && (
        <TripRequest
          trip={incomingTrip}
          onAccept={handleAcceptTrip}
          onDecline={handleDeclineTrip}
        />
      )}
    </div>
  );
}

export default DriverHomePage;
