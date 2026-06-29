'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useLocationStore } from '@/stores/location-store';
import { formatCurrency, haversine } from '@/lib/utils';
import type { LocationSuggestion, SelectedLocation } from '@/types/booking';
import type { VehicleEstimate, EstimateResponse } from '@/types/trip';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface BookingCardProps {
  onBook: (pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }, fare: number) => void;
  loading?: boolean;
  onLocationChange?: (pickup: [number, number] | null, dropoff: [number, number] | null) => void;
}

export default function BookingCard({ onBook, loading = false, onLocationChange }: BookingCardProps) {
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

  // GPS-biased search
  const searchLocation = async (query: string): Promise<LocationSuggestion[]> => {
    if (query.trim().length < 2) return [];
    try {
      const params = new URLSearchParams({
        q: query, format: 'json', addressdetails: '1', limit: '8', countrycodes: 'in', dedupe: '1',
      });
      if (userPosition) {
        const d = 0.45;
        params.set('viewbox', `${userPosition.lng - d},${userPosition.lat + d},${userPosition.lng + d},${userPosition.lat - d}`);
        params.set('bounded', '0');
      }
      const res = await fetch(`${NOMINATIM_URL}?${params}`, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (userPosition && Array.isArray(data) && data.length > 1) {
        data.sort((a: LocationSuggestion, b: LocationSuggestion) => {
          const dA = Math.abs(parseFloat(a.lat) - userPosition.lat) + Math.abs(parseFloat(a.lon) - userPosition.lng);
          const dB = Math.abs(parseFloat(b.lat) - userPosition.lat) + Math.abs(parseFloat(b.lon) - userPosition.lng);
          return dA - dB;
        });
      }
      return data;
    } catch { return []; }
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

    // If we have a POI name, lead with it
    if (poiName) {
      const context = [area, city].filter(Boolean).join(', ');
      return context ? `${poiName}, ${context}` : poiName;
    }

    const parts = [road, area, city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : s.display_name.split(',').slice(0, 3).join(', ').trim();
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
    onBook({ lat: selectedPickup.lat, lng: selectedPickup.lng }, { lat: selectedDrop.lat, lng: selectedDrop.lng }, chosen.fare);
  }, [estimates, selectedPickup, selectedDrop, selectedVehicle, onBook]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg shadow-gray-200/60">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h3 className="text-lg font-bold text-gray-900 tracking-tight">Book a Ride</h3>
        <p className="text-sm text-gray-400 mt-0.5">Where would you like to go?</p>
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
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
            <input
              value={pickupQuery}
              onChange={(e) => handlePickupChange(e.target.value)}
              onFocus={() => setPickupFocused(true)}
              placeholder="Pickup location"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 focus:bg-white"
            />
          </div>
          {/* GPS Button */}
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={gettingLocation}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {gettingLocation ? (
              <div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
            )}
            {gettingLocation ? 'Getting precise location...' : 'Use my current location'}
          </button>
          {/* Suggestions */}
          <AnimatePresence>
            {pickupFocused && pickupSuggestions.length > 0 && (
              <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto" style={{ listStyle: 'none' }}>
                {pickupSuggestions.map((s, i) => (
                  <li key={i}><button onClick={() => selectPickup(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors cursor-pointer truncate">
                    {formatAddress(s)}
                  </button></li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* Dropoff */}
        <div ref={dropWrapperRef} className="relative">
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
            <input
              value={dropQuery}
              onChange={(e) => handleDropChange(e.target.value)}
              onFocus={() => setDropFocused(true)}
              placeholder="Where to?"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 focus:bg-white"
            />
          </div>
          <AnimatePresence>
            {dropFocused && dropSuggestions.length > 0 && (
              <motion.ul initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="absolute z-50 left-0 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto" style={{ listStyle: 'none' }}>
                {dropSuggestions.map((s, i) => (
                  <li key={i}><button onClick={() => selectDrop(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors cursor-pointer truncate">
                    {formatAddress(s)}
                  </button></li>
                ))}
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
            <div className="flex items-center gap-4 px-5 py-3 mt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {distance} km
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ~{eta} min
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
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl w-8 text-center">{est.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-gray-900">{est.label}</p>
                    <p className="text-xs text-gray-400">{est.description}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(est.fare)}</span>
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
      <div className="px-5 pb-5 pt-2 flex gap-3">
        {estimates && (
          <>
            <button
              onClick={() => { setEstimates(null); setSelectedVehicle(null); }}
              className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Change
            </button>
            <button
              onClick={handleBook}
              disabled={loading || !selectedVehicle}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Confirm Booking'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
