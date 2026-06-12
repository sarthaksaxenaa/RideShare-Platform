import { useEffect, useState, useRef, useCallback } from 'react';
import styles from './TripRequest.module.css';

interface TripData {
  tripId: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare: number;
  riderName: string;
}

interface TripRequestProps {
  trip: TripData;
  onAccept: (tripId: string) => void;
  onDecline: () => void;
}

const COUNTDOWN_SECONDS = 15;

function TripRequest({ trip, onAccept, onDecline }: TripRequestProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasActed = useRef(false);

  const handleDecline = useCallback(() => {
    if (hasActed.current) return;
    hasActed.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    onDecline();
  }, [onDecline]);

  const handleAccept = useCallback(() => {
    if (hasActed.current) return;
    hasActed.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    onAccept(trip.tripId);
  }, [onAccept, trip.tripId]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handleDecline]);

  const progressPercent = (secondsLeft / COUNTDOWN_SECONDS) * 100;
  const fareInRupees = trip.fare.toFixed(2);

  return (
    <div className={styles.overlay}>
      <div className={`${styles.card} ${styles.pulseGlow}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconBadge}>🚕</div>
          <div className={styles.headerText}>
            <div className={styles.title}>New Trip Request</div>
            <div className={styles.subtitle}>from {trip.riderName}</div>
          </div>
        </div>

        {/* Trip Details */}
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.detailIcon}>💰</span>
            <div className={styles.detailContent}>
              <div className={styles.detailLabel}>Estimated Fare</div>
              <div className={`${styles.detailValue} ${styles.fareHighlight}`}>
                ₹{fareInRupees}
              </div>
            </div>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailIcon}>🟢</span>
            <div className={styles.detailContent}>
              <div className={styles.detailLabel}>Pickup</div>
              <div className={styles.detailValue}>
                {trip.pickupLat.toFixed(4)}, {trip.pickupLng.toFixed(4)}
              </div>
            </div>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailIcon}>🔴</span>
            <div className={styles.detailContent}>
              <div className={styles.detailLabel}>Drop-off</div>
              <div className={styles.detailValue}>
                {trip.dropLat.toFixed(4)}, {trip.dropLng.toFixed(4)}
              </div>
            </div>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className={styles.timerText}>
          Auto-declining in {secondsLeft}s
        </div>
        <div className={styles.timerBar}>
          <div
            className={styles.timerProgress}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button className={styles.acceptBtn} onClick={handleAccept}>
            Accept Ride
          </button>
          <button className={styles.declineBtn} onClick={handleDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

export default TripRequest;
