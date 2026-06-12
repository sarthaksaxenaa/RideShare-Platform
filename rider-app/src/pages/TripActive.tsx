import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import useTrip, { type TripState } from '../hooks/useTrip';
import Map, { type MapMarker } from '../components/Map';
import api from '../lib/api';
import styles from './TripActive.module.css';

interface TripDetails {
  _id: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare?: number;
  driverId?: string;
  driverName?: string;
  distance?: number;
  eta?: number;
}

function TripActivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { tripState, tripData, driverLocation, driverDisconnected, cancelTrip, resetTrip } =
    useTrip(socket);

  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null);
  const [loading, setLoading] = useState(true);
  // Error state removed as it is not displayed

  // Fetch trip details on mount
  useEffect(() => {
    if (!id) return;

    const fetchTrip = async () => {
      try {
        const res = await api.get(`/trips/${id}`);
        const data = res.data.trip || res.data;
        setTripDetails({
          _id: data._id || id,
          status: data.status || 'MATCHED',
          pickupLat: data.pickupLat || data.pickup?.lat || 0,
          pickupLng: data.pickupLng || data.pickup?.lng || 0,
          dropLat: data.dropLat || data.drop?.lat || 0,
          dropLng: data.dropLng || data.drop?.lng || 0,
          fare: data.fare || data.estimatedFare,
          driverId: data.driverId || data.driver?._id,
          driverName: data.driverName || data.driver?.name || 'Your Driver',
          distance: data.distance,
          eta: data.eta,
        });
      } catch (err: any) {
        console.error('Failed to fetch trip details:', err);
        // Error state removed
        // Use data from useTrip hook if available
        if (tripData) {
          setTripDetails({
            _id: id,
            status: tripState === 'idle' ? 'MATCHED' : tripState.toUpperCase(),
            pickupLat: tripData.pickupLat,
            pickupLng: tripData.pickupLng,
            dropLat: tripData.dropLat,
            dropLng: tripData.dropLng,
            fare: tripData.fare,
            driverId: tripData.driverId,
            driverName: tripData.driverName || 'Your Driver',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [id]);

  // Join trip room via socket
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('trip:join', { tripId: id });
  }, [socket, id]);

  // Determine effective status from socket events or fetched data
  const getEffectiveStatus = useCallback((): TripState => {
    if (tripState !== 'idle') return tripState;
    if (tripDetails?.status) {
      const s = tripDetails.status.toLowerCase();
      if (s === 'matched' || s === 'accepted') return 'matched';
      if (s === 'started' || s === 'in_progress') return 'started';
      if (s === 'completed') return 'completed';
      if (s === 'cancelled') return 'cancelled';
    }
    return 'matched';
  }, [tripState, tripDetails]);

  const effectiveStatus = getEffectiveStatus();

  // Navigate home on completion after user clicks Done
  const handleDone = useCallback(() => {
    resetTrip();
    navigate('/', { replace: true });
  }, [resetTrip, navigate]);

  const handleCancel = useCallback(() => {
    if (id) {
      cancelTrip(id, 'Rider cancelled trip');
    }
    resetTrip();
    navigate('/', { replace: true });
  }, [id, cancelTrip, resetTrip, navigate]);

  // Build markers
  const markers: MapMarker[] = [];

  const pickupLat = tripDetails?.pickupLat || tripData?.pickupLat || 0;
  const pickupLng = tripDetails?.pickupLng || tripData?.pickupLng || 0;
  const dropLat = tripDetails?.dropLat || tripData?.dropLat || 0;
  const dropLng = tripDetails?.dropLng || tripData?.dropLng || 0;

  if (pickupLat && pickupLng) {
    markers.push({ lat: pickupLat, lng: pickupLng, label: 'Pickup', type: 'pickup' });
  }

  if (dropLat && dropLng) {
    markers.push({ lat: dropLat, lng: dropLng, label: 'Drop-off', type: 'dropoff' });
  }

  if (driverLocation) {
    markers.push({
      lat: driverLocation.lat,
      lng: driverLocation.lng,
      label: tripDetails?.driverName || tripData?.driverName || 'Driver',
      type: 'driver',
    });
  }

  // Map center: driver location if available, else pickup
  const mapCenter: [number, number] = driverLocation
    ? [driverLocation.lat, driverLocation.lng]
    : pickupLat && pickupLng
    ? [pickupLat, pickupLng]
    : [13.0827, 80.2707];

  const driverName = tripDetails?.driverName || tripData?.driverName || 'Your Driver';
  const fare = tripDetails?.fare || tripData?.fare;
  const distance = tripDetails?.distance;
  const eta = tripDetails?.eta;

  // Loading state
  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingSpinner} />
        <div className={styles.loadingText}>Loading trip details...</div>
      </div>
    );
  }

  // Progress steps
  const progressSteps = ['matched', 'started', 'completed'] as const;
  const currentStepIndex = progressSteps.indexOf(
    effectiveStatus as (typeof progressSteps)[number]
  );

  return (
    <div className={styles.page}>
      {/* Driver Disconnected Banner */}
      {driverDisconnected && (
        <div className={styles.disconnectBanner}>
          <div className={styles.disconnectPulse} />
          Driver reconnecting... Please wait
        </div>
      )}

      {/* Back / Cancel button (only before trip starts) */}
      {effectiveStatus === 'matched' && (
        <button className={styles.backBtn} onClick={handleCancel}>
          ✕ Cancel Ride
        </button>
      )}

      {/* Full-Screen Map */}
      <div className={styles.mapContainer}>
        <Map center={mapCenter} zoom={14} markers={markers} fullscreen />
      </div>

      {/* Status Panel */}
      <div className={styles.statusPanel}>
        <div className={styles.statusCard}>
          <div className={styles.handle} />

          {/* Progress Bar */}
          <div className={styles.progressBar}>
            {progressSteps.map((step, idx) => (
              <div
                key={step}
                className={`${styles.progressStep} ${
                  idx <= currentStepIndex
                    ? styles.progressStepActive
                    : styles.progressStepPending
                }`}
              />
            ))}
          </div>

          {/* Status-dependent content */}
          {effectiveStatus === 'matched' && (
            <>
              <div className={styles.statusHeader}>
                <div className={`${styles.statusIconWrapper} ${styles.statusIconMatched}`}>
                  🚗
                </div>
                <div className={styles.statusInfo}>
                  <div className={styles.statusTitle}>Driver is on the way</div>
                  <div className={styles.statusSubtitle}>Your driver is heading to pick you up</div>
                </div>
              </div>

              <div className={styles.driverInfo}>
                <div className={styles.driverAvatar}>
                  {driverName.charAt(0).toUpperCase()}
                </div>
                <div className={styles.driverDetails}>
                  <div className={styles.driverName}>{driverName}</div>
                  <div className={styles.driverRole}>Your Driver</div>
                </div>
              </div>

              {(fare || distance || eta) && (
                <div className={styles.tripDetails}>
                  {fare && (
                    <div className={styles.tripDetailItem}>
                      <div className={styles.tripDetailLabel}>Fare</div>
                      <div className={styles.tripDetailValue}>₹{fare}</div>
                    </div>
                  )}
                  {eta && (
                    <div className={styles.tripDetailItem}>
                      <div className={styles.tripDetailLabel}>ETA</div>
                      <div className={styles.tripDetailValue}>
                        {eta}<span className={styles.tripDetailUnit}> min</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button className={styles.cancelBtn} onClick={handleCancel}>
                Cancel Ride
              </button>
            </>
          )}

          {effectiveStatus === 'started' && (
            <>
              <div className={styles.statusHeader}>
                <div className={`${styles.statusIconWrapper} ${styles.statusIconStarted}`}>
                  🛣️
                </div>
                <div className={styles.statusInfo}>
                  <div className={styles.statusTitle}>Trip in Progress</div>
                  <div className={styles.statusSubtitle}>Enjoy your ride!</div>
                </div>
              </div>

              <div className={styles.driverInfo}>
                <div className={styles.driverAvatar}>
                  {driverName.charAt(0).toUpperCase()}
                </div>
                <div className={styles.driverDetails}>
                  <div className={styles.driverName}>{driverName}</div>
                  <div className={styles.driverRole}>Your Driver</div>
                </div>
              </div>

              {(fare || distance) && (
                <div className={styles.tripDetails}>
                  {fare && (
                    <div className={styles.tripDetailItem}>
                      <div className={styles.tripDetailLabel}>Fare</div>
                      <div className={styles.tripDetailValue}>₹{fare}</div>
                    </div>
                  )}
                  {distance && (
                    <div className={styles.tripDetailItem}>
                      <div className={styles.tripDetailLabel}>Distance</div>
                      <div className={styles.tripDetailValue}>
                        {distance}<span className={styles.tripDetailUnit}> km</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {effectiveStatus === 'completed' && (
            <>
              <div className={styles.statusHeader}>
                <div className={`${styles.statusIconWrapper} ${styles.statusIconCompleted}`}>
                  ✅
                </div>
                <div className={styles.statusInfo}>
                  <div className={styles.statusTitle}>Trip Completed!</div>
                  <div className={styles.statusSubtitle}>Thank you for riding with us</div>
                </div>
              </div>

              <div className={styles.fareSummary}>
                <div className={styles.fareTitle}>Total Fare</div>
                <div className={styles.fareAmount}>₹{fare || 0}</div>
                <div className={styles.fareMessage}>
                  Thanks for riding with {driverName}
                </div>
              </div>

              <button className={styles.doneBtn} onClick={handleDone}>
                ✨ Done — Back to Home
              </button>
            </>
          )}

          {effectiveStatus === 'cancelled' && (
            <>
              <div className={styles.statusHeader}>
                <div className={`${styles.statusIconWrapper} ${styles.statusIconMatched}`}>
                  ❌
                </div>
                <div className={styles.statusInfo}>
                  <div className={styles.statusTitle}>Trip Cancelled</div>
                  <div className={styles.statusSubtitle}>This trip has been cancelled</div>
                </div>
              </div>

              <button className={styles.doneBtn} onClick={handleDone}>
                Back to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TripActivePage;
