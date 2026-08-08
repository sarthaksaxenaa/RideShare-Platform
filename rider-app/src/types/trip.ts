// ── Trip types ──────────────────────────────────────────────
// Strict state machine for the trip lifecycle

export type TripState =
  | 'IDLE'
  | 'SEARCHING'
  | 'MATCHED'
  | 'ARRIVED'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TripData {
  tripId: string;
  driverId?: string;
  driverName?: string;
  fare?: number;
  vehicleType?: string;
  vehicleIcon?: string;
  vehicleLabel?: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  rideOtp?: string;
}

export interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp?: number;
}

export interface CompletedTrip {
  tripId: string;
  pickup: string;
  drop: string;
  fare: number;
  completedAt: string;
}

export interface VehicleEstimate {
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
  surgeMultiplier?: number;
  surgeLabel?: string;
}

export interface EstimateResponse {
  estimates: VehicleEstimate[];
  distanceKm: number;
  estimatedDuration: number;
}
