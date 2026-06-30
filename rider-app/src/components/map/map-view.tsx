'use client';

import { useEffect, useRef, useCallback } from 'react';
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

// OSRM public routing API (uses Contraction Hierarchies — a Dijkstra optimization)
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

// Custom icons
const createIcon = (color: string, size: number = 12) =>
  L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: '',
  });

const pickupIcon = L.divIcon({
  html: `<div style="width:28px;height:28px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.2);border:2px solid #22c55e;">
    <div style="width:10px;height:10px;background:#22c55e;border-radius:50%;"></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
});

const dropoffIcon = L.divIcon({
  html: `<div style="width:28px;height:28px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.2);border:2px solid #ef4444;">
    <div style="width:10px;height:10px;background:#ef4444;border-radius:50%;"></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
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
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch real road route from OSRM
  const fetchRoute = useCallback(async (
    from: [number, number],
    to: [number, number]
  ): Promise<[number, number][] | null> => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      // OSRM expects lon,lat (not lat,lon)
      const url = `${OSRM_URL}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&alternatives=false&steps=false`;
      const res = await fetch(url, { signal: abortRef.current.signal });
      const data = await res.json();

      if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
        // GeoJSON coordinates are [lon, lat] — convert to [lat, lon] for Leaflet
        return data.routes[0].geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
        );
      }
      return null;
    } catch {
      return null;
    }
  }, []);

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
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (abortRef.current) abortRef.current.abort();
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

  // Update markers and route
  useEffect(() => {
    if (!markersRef.current || !routeLayerRef.current) return;
    markersRef.current.clearLayers();
    routeLayerRef.current.clearLayers();

    // User location (indigo pulse)
    if (center) {
      const userIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#6366f1;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(99,102,241,0.25), 0 2px 8px rgba(0,0,0,0.15);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: '',
      });
      L.marker(center, { icon: userIcon }).addTo(markersRef.current);
    }

    // Pickup marker
    if (pickup) {
      L.marker(pickup, { icon: pickupIcon })
        .bindPopup('<strong style="font-family:Inter,sans-serif;font-size:12px;">Pickup</strong>')
        .addTo(markersRef.current);
    }

    // Dropoff marker
    if (dropoff) {
      L.marker(dropoff, { icon: dropoffIcon })
        .bindPopup('<strong style="font-family:Inter,sans-serif;font-size:12px;">Drop-off</strong>')
        .addTo(markersRef.current);
    }

    // Fetch and draw real road route
    if (pickup && dropoff && mapRef.current) {
      const map = mapRef.current;
      const routeLayer = routeLayerRef.current;

      fetchRoute(pickup, dropoff).then((routeCoords) => {
        if (!routeCoords || !routeLayer) return;

        // Shadow / outline polyline for depth effect
        L.polyline(routeCoords, {
          color: '#4338ca',
          weight: 7,
          opacity: 0.15,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeLayer);

        // Main route polyline
        L.polyline(routeCoords, {
          color: '#6366f1',
          weight: 4,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeLayer);

        // Fit map to route bounds
        const bounds = L.latLngBounds(routeCoords);
        map.fitBounds(bounds, { padding: [60, 60], animate: true });
      });
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
  }, [center, pickup, dropoff, driverLocation, nearbyDrivers, fetchRoute]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-2xl overflow-hidden ${className}`}
    />
  );
}
