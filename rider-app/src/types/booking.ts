// ── Booking & Location types ────────────────────────────────

export interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    neighbourhood?: string;
    suburb?: string;
    hamlet?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
  };
}

export interface SelectedLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface BookingPayload {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare: number;
}
