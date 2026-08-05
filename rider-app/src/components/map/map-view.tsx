'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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
  pickMode?: 'pickup' | 'drop' | null;
  onMapClick?: (lat: number, lng: number) => void;
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
  html: `<div style="display:flex;flex-direction:column;align-items:center;">
    <div style="padding:3px 8px;background:#22c55e;border-radius:12px;font-size:10px;font-weight:700;color:white;font-family:Inter,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(34,197,94,0.4);margin-bottom:4px;">Pickup</div>
    <div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>
  </div>`,
  iconSize: [60, 36],
  iconAnchor: [30, 36],
  className: '',
});

const dropoffIcon = L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;">
    <div style="padding:3px 8px;background:#ef4444;border-radius:12px;font-size:10px;font-weight:700;color:white;font-family:Inter,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(239,68,68,0.4);margin-bottom:4px;">Drop</div>
    <div style="width:14px;height:14px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>
  </div>`,
  iconSize: [60, 36],
  iconAnchor: [30, 36],
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
  pickMode = null,
  onMapClick,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchRoute = useCallback(async (
    from: [number, number],
    to: [number, number],
    signal?: AbortSignal
  ): Promise<[number, number][] | null> => {
    try {
      const url = `${OSRM_URL}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&alternatives=false&steps=false`;
      const res = await fetch(url, { signal });
      const data = await res.json();

      if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
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

  // Ref for user location marker (separate from route markers)
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Update user location dot (separate effect to avoid route re-fetching)
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    // Remove old user marker
    if (userMarkerRef.current) {
      markersRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (center) {
      const userIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#6366f1;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(99,102,241,0.25), 0 2px 8px rgba(0,0,0,0.15);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: '',
      });
      userMarkerRef.current = L.marker(center, { icon: userIcon }).addTo(markersRef.current);
    }
  }, [center]);

  // Update route, pickup/drop markers, and driver markers
  // NOTE: Does NOT depend on `center` — GPS refinements won't reset the route
  useEffect(() => {
    if (!markersRef.current || !routeLayerRef.current) return;

    // Clear route + location markers (but NOT the user dot — that's separate)
    routeLayerRef.current.clearLayers();

    // Remove all non-user markers from markersRef
    markersRef.current.eachLayer((layer) => {
      if (layer !== userMarkerRef.current) {
        markersRef.current!.removeLayer(layer);
      }
    });

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

    const abortCtrl = new AbortController();

    // Fetch and draw real road route
    if (pickup && dropoff && mapRef.current) {
      const map = mapRef.current;
      const routeLayer = routeLayerRef.current;

      fetchRoute(pickup, dropoff, abortCtrl.signal).then((routeCoords) => {
        if (!routeCoords || !routeLayer) return;

        L.polyline(routeCoords, {
          color: '#6366f1',
          weight: 5,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '15, 15',
          className: 'animated-route-path',
        }).addTo(routeLayer);

        const bounds = L.latLngBounds(routeCoords);
        map.fitBounds(bounds, { padding: [70, 70], animate: true });
      });
    }

    if (driverLocation && pickup && mapRef.current) {
      const routeLayer = routeLayerRef.current;
      fetchRoute([driverLocation.lat, driverLocation.lng], pickup, abortCtrl.signal).then((driverRouteCoords) => {
        if (!driverRouteCoords || !routeLayer) return;
        L.polyline(driverRouteCoords, {
          color: '#9ca3af',
          weight: 4,
          opacity: 0.7,
          dashArray: '5, 10',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeLayer);
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

    return () => abortCtrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, dropoff, driverLocation, nearbyDrivers, fetchRoute]);

  // Handle map click for pick mode
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (pickMode) {
      map.getContainer().style.cursor = 'crosshair';
      const handler = (e: L.LeafletMouseEvent) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      };
      map.on('click', handler);
      return () => {
        map.off('click', handler);
        map.getContainer().style.cursor = '';
      };
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [pickMode]);

  return (
    <div className="relative w-full h-full">
      <style>{`
        .animated-route-path {
          animation: dash-flow 1s linear infinite;
        }
        @keyframes dash-flow {
          to { stroke-dashoffset: -30; }
        }
      `}</style>
      <div
        ref={containerRef}
        className={`w-full h-full rounded-2xl overflow-hidden ${className}`}
      />
      {/* Pick mode banner */}
      {pickMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${pickMode === 'pickup' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-gray-800">
            Tap map to set {pickMode === 'pickup' ? 'pickup' : 'drop-off'} location
          </span>
        </div>
      )}
    </div>
  );
}
