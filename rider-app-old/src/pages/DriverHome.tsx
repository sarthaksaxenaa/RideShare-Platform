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
  id: string;
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

  const formatFare = (fare: number) => {
    return `₹${fare.toFixed(0)}`;
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
          <div className={styles.brandIconWrap}>
            <svg className={styles.brandSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>RideShare</span>
            <span className={styles.greeting}>
              Hello, {userName}
              {isConnected ? '' : ' · Reconnecting...'}
            </span>
          </div>
        </div>
        <div className={styles.topBarActions}>
          <button
            className={styles.profileBtn}
            onClick={() => navigate('/profile')}
            title="Profile"
          >
            {userName.charAt(0).toUpperCase()}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {locationError}
        </div>
      )}

      {/* Map */}
      <div className={styles.mapSection}>
        {isOnline && currentPosition ? (
          <Map center={defaultCenter} zoom={16} markers={markers} />
        ) : (
          <div className={styles.mapPlaceholder}>
            <svg className={styles.mapPlaceholderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="48" height="48">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          Recent Trips
        </div>
        {completedTrips.length > 0 ? (
          <div className={styles.tripList}>
            {completedTrips.map((trip) => (
              <div key={trip.id} className={styles.tripItem}>
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
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
              <path d="M16 8h4l3 5v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
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
