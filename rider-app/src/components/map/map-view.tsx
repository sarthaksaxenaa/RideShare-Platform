'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  center: [number, number];
  zoom?: number;
  pickup?: [number, number] | null;
  dropoff?: [number, number] | null;
  driverLocation?: { lat: number; lng: number } | null;
  nearbyDrivers?: { lat: number; lng: number }[];
  className?: string;
}

// Custom icons
const createIcon = (color: string, size: number = 12) =>
  L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: '',
  });

const driverIcon = L.divIcon({
  html: `<div style="width:32px;height:32px;background:#111827;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.25);border:2px solid white;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><path d="M16 8h4l3 5v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: '',
});

const nearbyDriverIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;background:#374151;border-radius:6px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:1.5px solid white;opacity:0.7;">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><path d="M16 8h4l3 5v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: '',
});

export default function MapView({
  center,
  zoom = 15,
  pickup,
  dropoff,
  driverLocation,
  nearbyDrivers = [],
  className = '',
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView(center, mapRef.current.getZoom(), { animate: true });
    }
  }, [center]);

  // Update markers
  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    // User location (blue pulse)
    if (center) {
      const userIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#6366f1;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(99,102,241,0.25), 0 2px 8px rgba(0,0,0,0.15);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: '',
      });
      L.marker(center, { icon: userIcon }).addTo(markersRef.current);
    }

    // Pickup
    if (pickup) {
      L.marker(pickup, { icon: createIcon('#22c55e', 14) })
        .bindPopup('<strong style="font-family:Inter,sans-serif;font-size:12px;">Pickup</strong>')
        .addTo(markersRef.current);
    }

    // Dropoff
    if (dropoff) {
      L.marker(dropoff, { icon: createIcon('#ef4444', 14) })
        .bindPopup('<strong style="font-family:Inter,sans-serif;font-size:12px;">Drop-off</strong>')
        .addTo(markersRef.current);
    }

    // Route line
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (pickup && dropoff && mapRef.current) {
      routeRef.current = L.polyline([pickup, dropoff], {
        color: '#6366f1',
        weight: 3,
        opacity: 0.6,
        dashArray: '8, 8',
      }).addTo(mapRef.current);

      // Fit bounds to show both markers
      const bounds = L.latLngBounds([pickup, dropoff]);
      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
    }

    // Driver marker
    if (driverLocation) {
      L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
        .bindPopup('<strong style="font-family:Inter,sans-serif;font-size:12px;">Your Driver</strong>')
        .addTo(markersRef.current);
    }

    // Nearby drivers
    nearbyDrivers.forEach((d) => {
      L.marker([d.lat, d.lng], { icon: nearbyDriverIcon }).addTo(markersRef.current!);
    });
  }, [center, pickup, dropoff, driverLocation, nearbyDrivers]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-2xl overflow-hidden ${className}`}
    />
  );
}
