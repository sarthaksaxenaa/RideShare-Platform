'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useLocationStore } from '@/stores/location-store';
import { formatCurrency, haversine } from '@/lib/utils';
import PaymentSelector from '@/components/booking/payment-selector';
import type { PaymentMethod } from '@/components/booking/payment-selector';
import type { LocationSuggestion, SelectedLocation } from '@/types/booking';
import type { VehicleEstimate, EstimateResponse } from '@/types/trip';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface BookingCardProps {
  onBook: (pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }, fare: number, paymentMethod: string, vehicle: { type: string; icon: string; label: string }) => void;
  loading?: boolean;
  onLocationChange?: (pickup: [number, number] | null, dropoff: [number, number] | null) => void;
  onCancelBooking?: (reason: string) => void;
  onLocateOnMap?: (mode: 'pickup' | 'drop') => void;
  mapPickedLocation?: { mode: 'pickup' | 'drop'; lat: number; lng: number } | null;
  initialPromoCode?: string;
}

export default function BookingCard({ onBook, loading = false, onLocationChange, onCancelBooking, onLocateOnMap, mapPickedLocation, initialPromoCode }: BookingCardProps) {
  const userPosition = useLocationStore((s) => s.userPosition);
  const isLocating = useLocationStore((s) => s.isLocating);
  const acquirePreciseLocation = useLocationStore((s) => s.acquirePreciseLocation);

  // Location search state
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedPickup, setSelectedPickup] = useState<SelectedLocation | null>(null);
  const [pickupFocused, setPickupFocused] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [dropQuery, setDropQuery] = useState('');
  const [dropSuggestions, setDropSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedDrop, setSelectedDrop] = useState<SelectedLocation | null>(null);
  const [dropFocused, setDropFocused] = useState(false);

  // Estimate state
  const [estimates, setEstimates] = useState<VehicleEstimate[] | null>(null);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');

  // Promo code state
  const [promoCode, setPromoCode] = useState(initialPromoCode || '');
  
  useEffect(() => {
    if (initialPromoCode) {
      setPromoCode(initialPromoCode);
    }
  }, [initialPromoCode]);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoDescription, setPromoDescription] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const CANCEL_REASONS = [
    'Booked by mistake',
    'Wait time is too long',
    'Driver is too far',
    'Price is too high',
    'Change of plans',
    'Other'
  ];

  // Refs
  const pickupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupWrapperRef = useRef<HTMLDivElement>(null);
  const dropWrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickupWrapperRef.current && !pickupWrapperRef.current.contains(e.target as Node))
        setPickupFocused(false);
      if (dropWrapperRef.current && !dropWrapperRef.current.contains(e.target as Node))
        setDropFocused(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reverse-geocoded city name for context-aware search
  const [userCity, setUserCity] = useState('');

  // Detect user's city from GPS for query enrichment
  useEffect(() => {
    if (userPosition && !userCity) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${userPosition.lat}&lon=${userPosition.lng}&format=json&zoom=10&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
        .then((r) => r.json())
        .then((d) => {
          const city = d.address?.city || d.address?.town || d.address?.county || d.address?.state_district || '';
          if (city) setUserCity(city);
        })
        .catch(() => {});
    }
  }, [userPosition, userCity]);

  // Handle location picked from map
  useEffect(() => {
    if (!mapPickedLocation) return;
    const { mode, lat, lng } = mapPickedLocation;

    // Reverse geocode the coordinates
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' },
    })
      .then((r) => r.json())
      .then((data) => {
        const name = [
          data.display_name?.split(',')[0],
          data.address?.suburb || data.address?.neighbourhood || data.address?.village || '',
          data.address?.city || data.address?.town || data.address?.county || '',
        ].filter(Boolean).join(', ');

        if (mode === 'pickup') {
          setSelectedPickup({ name, lat, lng });
          setPickupQuery(name);
          setPickupSuggestions([]);
          if (onLocationChange) onLocationChange([lat, lng], selectedDrop ? [selectedDrop.lat, selectedDrop.lng] : null);
        } else {
          setSelectedDrop({ name, lat, lng });
          setDropQuery(name);
          setDropSuggestions([]);
          if (onLocationChange) onLocationChange(selectedPickup ? [selectedPickup.lat, selectedPickup.lng] : null, [lat, lng]);
        }
      })
      .catch(() => {
        // Fallback: use raw coordinates
        const name = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        if (mode === 'pickup') {
          setSelectedPickup({ name, lat, lng });
          setPickupQuery(name);
          if (onLocationChange) onLocationChange([lat, lng], selectedDrop ? [selectedDrop.lat, selectedDrop.lng] : null);
        } else {
          setSelectedDrop({ name, lat, lng });
          setDropQuery(name);
          if (onLocationChange) onLocationChange(selectedPickup ? [selectedPickup.lat, selectedPickup.lng] : null, [lat, lng]);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPickedLocation]);

  // Smart multi-source search: queries Nominatim (plain + context) + Photon in parallel
  const searchLocation = async (query: string): Promise<LocationSuggestion[]> => {
    if (query.trim().length < 2) return [];

    const buildNominatimParams = (q: string) => {
      const params = new URLSearchParams({
        q, format: 'json', addressdetails: '1', limit: '15', countrycodes: 'in', dedupe: '1',
      });
      if (userPosition) {
        const d = 1.2; // wider viewbox for more results
        params.set('viewbox', `${userPosition.lng - d},${userPosition.lat + d},${userPosition.lng + d},${userPosition.lat - d}`);
        params.set('bounded', '0');
      }
      return params;
    };

    try {
      // Run three queries in parallel for maximum coverage:
      // 1. Nominatim plain query
      // 2. Nominatim context-enriched query (with city name)
      // 3. Photon API (better fuzzy matching, more POIs)
      const plainParams = buildNominatimParams(query);
      const contextQuery = userCity && !query.toLowerCase().includes(userCity.toLowerCase())
        ? `${query} ${userCity}`
        : '';
      const contextParams = contextQuery ? buildNominatimParams(contextQuery) : null;

      const fetches: Promise<LocationSuggestion[]>[] = [
        fetch(`${NOMINATIM_URL}?${plainParams}`, { headers: { 'Accept-Language': 'en' } })
          .then((r) => r.json())
          .catch(() => []),
      ];

      if (contextParams) {
        fetches.push(
          fetch(`${NOMINATIM_URL}?${contextParams}`, { headers: { 'Accept-Language': 'en' } })
            .then((r) => r.json())
            .catch(() => [])
        );
      }

      // Photon API — uses Elasticsearch, better fuzzy search and more POIs
      const photonParams = new URLSearchParams({ q: query, limit: '10', lang: 'en' });
      if (userPosition) {
        photonParams.set('lat', String(userPosition.lat));
        photonParams.set('lon', String(userPosition.lng));
      }
      fetches.push(
        fetch(`https://photon.komoot.io/api/?${photonParams}`)
          .then((r) => r.json())
          .then((data) => {
            // Convert Photon GeoJSON format → Nominatim-compatible format
            if (!data?.features) return [];
            return data.features
              .filter((f: { properties?: { country?: string } }) => !f.properties?.country || f.properties.country === 'India')
              .map((f: { geometry: { coordinates: number[] }; properties: { name?: string; street?: string; city?: string; state?: string; postcode?: string; county?: string; district?: string; housenumber?: string; osm_key?: string; osm_value?: string } }) => ({
                lat: String(f.geometry.coordinates[1]),
                lon: String(f.geometry.coordinates[0]),
                display_name: [
                  f.properties.name,
                  f.properties.housenumber ? `${f.properties.housenumber} ${f.properties.street || ''}`.trim() : f.properties.street,
                  f.properties.district || f.properties.county,
                  f.properties.city,
                  f.properties.state,
                  f.properties.postcode,
                ].filter(Boolean).join(', '),
                address: {
                  road: f.properties.street,
                  city: f.properties.city,
                  state: f.properties.state,
                  postcode: f.properties.postcode,
                  county: f.properties.county || f.properties.district,
                },
                type: f.properties.osm_value || f.properties.osm_key || 'place',
              }));
          })
          .catch(() => [])
      );

      const results = await Promise.all(fetches);

      // Merge and deduplicate by rounding coordinates to ~100m precision
      const seen = new Set<string>();
      const merged: LocationSuggestion[] = [];

      const addResults = (items: LocationSuggestion[]) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
          const key = `${parseFloat(item.lat).toFixed(4)},${parseFloat(item.lon).toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        }
      };

      // Merge all sources — context results first (most relevant), then plain, then photon
      for (const resultSet of results.reverse()) {
        addResults(resultSet || []);
      }

      // Sort by distance from user
      if (userPosition && merged.length > 1) {
        merged.sort((a, b) => {
          const dA = Math.abs(parseFloat(a.lat) - userPosition.lat) + Math.abs(parseFloat(a.lon) - userPosition.lng);
          const dB = Math.abs(parseFloat(b.lat) - userPosition.lat) + Math.abs(parseFloat(b.lon) - userPosition.lng);
          return dA - dB;
        });
      }

      return merged.slice(0, 12);
    } catch {
      return [];
    }
  };

  const handlePickupChange = (value: string) => {
    setPickupQuery(value);
    setSelectedPickup(null);
    setEstimates(null);
    setSelectedVehicle(null);
    if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
    pickupTimerRef.current = setTimeout(async () => {
      const results = await searchLocation(value);
      setPickupSuggestions(results);
    }, 300);
  };

  const handleDropChange = (value: string) => {
    setDropQuery(value);
    setSelectedDrop(null);
    setEstimates(null);
    setSelectedVehicle(null);
    if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    dropTimerRef.current = setTimeout(async () => {
      const results = await searchLocation(value);
      setDropSuggestions(results);
    }, 300);
  };

  const formatAddress = (s: LocationSuggestion) => {
    const addr = (s.address || {}) as Record<string, string>;
    // Prioritize building/amenity/POI name for precise results
    const poiName = addr.amenity || addr.building || addr.college || addr.university
      || addr.school || addr.hospital || addr.office || addr.shop || addr.mall
      || addr.tourism || addr.leisure || addr.aeroway || '';
    const road = addr.road || addr.pedestrian || addr.highway || '';
    const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || '';
    const city = addr.city || addr.town || addr.county || '';

    // The first part of display_name is usually the actual place name
    const placeName = s.display_name?.split(',')[0]?.trim() || '';

    // If we have a POI name, lead with it
    if (poiName) {
      const context = [area, city].filter(Boolean).join(', ');
      return context ? `${poiName}, ${context}` : poiName;
    }

    // Build from address parts, but always include the place name
    const parts = [road, area, city].filter(Boolean);
    if (parts.length > 0) {
      // If the place name is different from road/area/city, prepend it
      const result = parts.join(', ');
      if (placeName && !result.toLowerCase().includes(placeName.toLowerCase())) {
        return `${placeName}, ${result}`;
      }
      return result;
    }

    // Fallback: use first 3 parts of display_name
    return s.display_name.split(',').slice(0, 3).join(', ').trim();
  };

  /** Returns two lines for richer dropdown display */
  const formatSuggestionLines = (s: LocationSuggestion): { primary: string; secondary: string } => {
    const addr = (s.address || {}) as Record<string, string>;
    const poiName = addr.amenity || addr.building || addr.college || addr.university
      || addr.school || addr.hospital || addr.office || addr.shop || addr.mall
      || addr.tourism || addr.leisure || addr.aeroway || '';
    const road = addr.road || addr.pedestrian || addr.highway || '';
    const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || '';
    const city = addr.city || addr.town || addr.county || '';
    const state = addr.state || '';

    if (poiName) {
      const secondary = [road, area, city, state].filter(Boolean).join(', ');
      return { primary: poiName, secondary };
    }

    // Use display_name to extract a good primary
    const displayParts = s.display_name.split(',').map((p: string) => p.trim());
    const primary = displayParts[0] || road || area;
    const secondary = [road, area, city, state].filter((v) => v && v !== primary).join(', ')
      || displayParts.slice(1, 4).join(', ');

    return { primary: primary || s.display_name.split(',')[0], secondary };
  };

  const selectPickup = (s: LocationSuggestion) => {
    const name = formatAddress(s);
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setSelectedPickup({ name, lat, lng });
    setPickupQuery(name);
    setPickupSuggestions([]);
    setPickupFocused(false);
    if (onLocationChange) onLocationChange([lat, lng], selectedDrop ? [selectedDrop.lat, selectedDrop.lng] : null);
  };

  const selectDrop = (s: LocationSuggestion) => {
    const name = formatAddress(s);
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setSelectedDrop({ name, lat, lng });
    setDropQuery(name);
    setDropSuggestions([]);
    setDropFocused(false);
    if (onLocationChange) onLocationChange(selectedPickup ? [selectedPickup.lat, selectedPickup.lng] : null, [lat, lng]);
  };

  // Use current GPS location
  const handleUseCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setGettingLocation(true);
    setError('');

    let bestPosition: GeolocationPosition | null = null;
    let settled = false;

    const finalize = async (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      try {
        // Use zoom=19 for building-level precision + namedetails for POI names
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=19&addressdetails=1&namedetails=1&extratags=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const addr = data.address || {};
        // Prioritize POI/building name (e.g. "NIET College") over road
        const poiName = addr.amenity || addr.building || addr.college || addr.university
          || addr.school || addr.hospital || addr.office || addr.shop || addr.mall
          || (data.namedetails?.name) || '';
        const road = addr.road || addr.pedestrian || '';
        const area = addr.neighbourhood || addr.suburb || '';
        const city = addr.city || addr.town || '';
        let name = '';
        if (poiName && typeof poiName === 'string') {
          const context = [area, city].filter(Boolean).join(', ');
          name = context ? `${poiName}, ${context}` : poiName;
        } else {
          const parts = [road, area, city].filter(Boolean);
          name = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
        setSelectedPickup({ name, lat, lng });
        setPickupQuery(name);
        if (onLocationChange) onLocationChange([lat, lng], selectedDrop ? [selectedDrop.lat, selectedDrop.lng] : null);
      } catch {
        const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSelectedPickup({ name: fallback, lat, lng });
        setPickupQuery(fallback);
        if (onLocationChange) onLocationChange([lat, lng], selectedDrop ? [selectedDrop.lat, selectedDrop.lng] : null);
      }
      setGettingLocation(false);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) bestPosition = pos;
        if (pos.coords.accuracy <= 50) finalize(pos);
      },
      (err) => { if (!settled) { settled = true; clearTimeout(timer); if (bestPosition) finalize(bestPosition); else { setError(err.message); setGettingLocation(false); } } },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    const timer = setTimeout(() => { if (!settled && bestPosition) finalize(bestPosition); }, 8000);
  }, [onLocationChange, selectedDrop]);

  // Auto-estimate
  const handleEstimate = useCallback(async () => {
    if (!selectedPickup || !selectedDrop) return;
    setError('');
    setEstimating(true);
    try {
      const res = await api.post('/trips/estimate', {
        pickupLat: selectedPickup.lat, pickupLng: selectedPickup.lng,
        dropLat: selectedDrop.lat, dropLng: selectedDrop.lng,
      });
      const data: EstimateResponse = res.data;
      setEstimates(data.estimates);
      setDistance(data.distanceKm);
      setEta(data.estimatedDuration);
      setSelectedVehicle('economy');
    } catch {
      const distKm = Math.max(1, Math.round(haversine(selectedPickup.lat, selectedPickup.lng, selectedDrop.lat, selectedDrop.lng) * 1.3 * 10) / 10);
      const durMin = Math.round(distKm * 2 + 5);
      const ckm = Math.max(0, distKm - 2);
      setEstimates([
        { vehicleType: 'bike', label: 'Bike', icon: '🏍️', description: 'Fastest in traffic', fare: Math.round(23 + ckm * 9), baseFare: 23, distanceFare: Math.round(ckm * 9), timeFare: 0, platformFee: 10, ratePerKm: 9, timeCharge: 0 },
        { vehicleType: 'auto', label: 'Auto', icon: '🛺', description: 'No surge pricing', fare: Math.round(35 + ckm * 12 + durMin), baseFare: 35, distanceFare: Math.round(ckm * 12), timeFare: durMin, platformFee: 10, ratePerKm: 12, timeCharge: 1 },
        { vehicleType: 'economy', label: 'Economy', icon: '🚗', description: 'Comfortable & affordable', fare: Math.round(48 + ckm * 14 + durMin), baseFare: 48, distanceFare: Math.round(ckm * 14), timeFare: durMin, platformFee: 10, ratePerKm: 14, timeCharge: 1 },
        { vehicleType: 'sedan', label: 'Sedan', icon: '🚘', description: 'Spacious & smooth', fare: Math.round(65 + ckm * 18 + Math.round(durMin * 1.5)), baseFare: 65, distanceFare: Math.round(ckm * 18), timeFare: Math.round(durMin * 1.5), platformFee: 10, ratePerKm: 18, timeCharge: 1.5 },
        { vehicleType: 'premium', label: 'Premium', icon: '✨', description: 'Luxury experience', fare: Math.round(85 + ckm * 24 + durMin * 2), baseFare: 85, distanceFare: Math.round(ckm * 24), timeFare: durMin * 2, platformFee: 10, ratePerKm: 24, timeCharge: 2 },
      ]);
      setDistance(distKm);
      setEta(durMin);
      setSelectedVehicle('economy');
    } finally {
      setEstimating(false);
    }
  }, [selectedPickup, selectedDrop]);

  // Auto-trigger estimate
  useEffect(() => {
    if (selectedPickup && selectedDrop && !estimates && !estimating) {
      handleEstimate();
    }
  }, [selectedPickup, selectedDrop, estimates, estimating, handleEstimate]);

  const handleBook = useCallback(() => {
    if (!estimates || !selectedPickup || !selectedDrop || !selectedVehicle) return;
    const chosen = estimates.find((e) => e.vehicleType === selectedVehicle);
    if (!chosen) return;
    const finalFare = promoApplied ? Math.max(0, chosen.fare - promoDiscount) : chosen.fare;
    onBook(
      { lat: selectedPickup.lat, lng: selectedPickup.lng },
      { lat: selectedDrop.lat, lng: selectedDrop.lng },
      finalFare,
      paymentMethod,
      { type: chosen.vehicleType, icon: chosen.icon, label: chosen.label }
    );
  }, [estimates, selectedPickup, selectedDrop, selectedVehicle, onBook, paymentMethod, promoApplied, promoDiscount]);

  // Promo code validation
  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    setPromoError('');
    try {
      const chosenFare = estimates?.find((e) => e.vehicleType === selectedVehicle)?.fare || 0;
      const res = await api.post('/trips/validate-promo', { code: promoCode, fare: chosenFare });
      setPromoDiscount(res.data.discount);
      setPromoDescription(res.data.description);
      setPromoApplied(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setPromoError(axiosErr?.response?.data?.message || 'Invalid promo code');
      setPromoApplied(false);
      setPromoDiscount(0);
    } finally {
      setValidatingPromo(false);
    }
  }, [promoCode, estimates, selectedVehicle]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Book a Ride</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Where would you like to go?</p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-5 mb-3 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 overflow-hidden">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Inputs */}
      <div className="px-5 flex flex-col gap-3">
        {/* Pickup */}
        <div ref={pickupWrapperRef} className="relative">
          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1"><span>📍</span> Pickup</p>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
            <input
              value={pickupQuery}
              onChange={(e) => handlePickupChange(e.target.value)}
              onFocus={() => setPickupFocused(true)}
              placeholder="Pickup location"
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
            />
          </div>
          {/* GPS & Map buttons */}
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={gettingLocation}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {gettingLocation ? (
                <div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
              )}
              {gettingLocation ? 'Getting location...' : 'Use current location'}
            </button>
            {onLocateOnMap && (
              <button
                type="button"
                onClick={() => onLocateOnMap('pickup')}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Locate on map
              </button>
            )}
          </div>
          {/* Suggestions */}
          <AnimatePresence>
            {pickupFocused && pickupSuggestions.length > 0 && (
              <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto" style={{ listStyle: 'none' }}>
                {pickupSuggestions.map((s, i) => {
                  const { primary, secondary } = formatSuggestionLines(s);
                  return (
                    <li key={i}><button onClick={() => selectPickup(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors cursor-pointer">
                      <div className="flex items-start gap-2.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{primary}</p>
                          {secondary && <p className="text-xs text-gray-400 truncate mt-0.5">{secondary}</p>}
                        </div>
                      </div>
                    </button></li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* Dropoff */}
        <div ref={dropWrapperRef} className="relative">
          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1"><span>📍</span> Destination</p>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
            <input
              value={dropQuery}
              onChange={(e) => handleDropChange(e.target.value)}
              onFocus={() => setDropFocused(true)}
              placeholder="Where to?"
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
            />
          </div>
          {/* Locate on map for dropoff */}
          {onLocateOnMap && (
            <button
              type="button"
              onClick={() => onLocateOnMap('drop')}
              className="mt-1 flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Locate on map
            </button>
          )}
          <AnimatePresence>
            {dropFocused && dropSuggestions.length > 0 && (
              <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto" style={{ listStyle: 'none' }}>
                {dropSuggestions.map((s, i) => {
                  const { primary, secondary } = formatSuggestionLines(s);
                  return (
                    <li key={i}><button onClick={() => selectDrop(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors cursor-pointer">
                      <div className="flex items-start gap-2.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{primary}</p>
                          {secondary && <p className="text-xs text-gray-400 truncate mt-0.5">{secondary}</p>}
                        </div>
                      </div>
                    </button></li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Estimating bar */}
      {estimating && !estimates && (
        <div className="mx-5 mt-4 flex items-center justify-center gap-2.5 py-3.5 bg-gray-50 rounded-xl text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          Calculating fare...
        </div>
      )}

      {/* Vehicle Estimates */}
      <AnimatePresence>
        {estimates && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            {/* Trip info */}
            <div className="flex items-center gap-2 px-5 py-3 mt-3 border-t border-gray-100 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {distance} km
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ~{eta} min
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full text-xs font-medium text-green-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                No surge
              </div>
            </div>

            {/* Vehicle list */}
            <div className="px-5 flex flex-col gap-1.5 pb-2">
              {estimates.map((est) => (
                <button
                  key={est.vehicleType}
                  onClick={() => setSelectedVehicle(est.vehicleType)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedVehicle === est.vehicleType
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                      : 'border-gray-100 hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200'
                  }`}
                >
                  <span className="text-xl w-8 text-center">{est.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-gray-900">{est.label}</p>
                    <p className="text-xs text-gray-400">{est.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(est.fare)}</p>
                    <p className="text-[10px] text-gray-400">estimated</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Fare Breakdown */}
            {selectedVehicle && estimates.filter((e) => e.vehicleType === selectedVehicle).map((est) => (
              <div key="breakdown" className="mx-5 mb-3 p-3.5 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 mb-2">Fare Breakdown</p>
                {[
                  ['Base Fare', est.baseFare],
                  [`Distance (${distance} km)`, est.distanceFare],
                  [`Time (~${eta} min)`, est.timeFare],
                  ['Platform Fee', est.platformFee],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between text-xs text-gray-500 py-1">
                    <span>{String(label)}</span>
                    <span>{formatCurrency(Number(val))}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 mt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatCurrency(est.fare)}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Action Buttons */}
      {estimates && (
        <PaymentSelector selected={paymentMethod} onChange={setPaymentMethod} />
      )}

      {/* Promo Code */}
      {estimates && selectedVehicle && !loading && (
        <div className="px-5 pb-3">
          {!promoApplied ? (
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                placeholder="Promo code"
                className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 placeholder:text-gray-400 uppercase"
              />
              <button
                onClick={handleApplyPromo}
                disabled={!promoCode.trim() || validatingPromo}
                className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                {validatingPromo ? '...' : 'Apply'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-green-600 text-sm">✅</span>
                <div>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">{promoCode} applied!</p>
                  <p className="text-[10px] text-green-600/70">{promoDescription} (−₹{promoDiscount})</p>
                </div>
              </div>
              <button
                onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(''); }}
                className="text-xs text-green-600 hover:text-red-500 cursor-pointer font-medium"
              >
                Remove
              </button>
            </div>
          )}
          {promoError && <p className="text-xs text-red-500 mt-1.5 px-1">{promoError}</p>}
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-5 pb-5 pt-2 flex gap-3">
        {estimates && !loading && (
          <>
            <button
              onClick={() => { setEstimates(null); setSelectedVehicle(null); }}
              className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Change
            </button>
            <button
              onClick={handleBook}
              disabled={!selectedVehicle}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {selectedVehicle ? `Book ${estimates?.find(e => e.vehicleType === selectedVehicle)?.label || selectedVehicle}` : 'Select a ride'}
            </button>
          </>
        )}

        {loading && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-semibold hover:bg-red-100 transition-colors cursor-pointer"
          >
            Cancel Booking
          </button>
        )}
      </div>

      {/* Cancellation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel Booking?</h3>
              <p className="text-sm text-gray-500 mb-4">Please let us know why you are cancelling.</p>
              
              <div className="flex flex-col gap-2 mb-6">
                {CANCEL_REASONS.map((reason) => (
                  <label key={reason} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 transition-all">
                    <input 
                      type="radio" 
                      name="cancel_reason" 
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600"
                    />
                    <span className="text-sm text-gray-700 font-medium">{reason}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Keep Booking
                </button>
                <button
                  onClick={() => {
                    if (!cancelReason) {
                      toast.error('Please select a reason');
                      return;
                    }
                    onCancelBooking?.(cancelReason);
                    setShowCancelModal(false);
                    setCancelReason('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/25"
                >
                  Cancel Ride
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
