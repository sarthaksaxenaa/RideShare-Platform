import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './Map.module.css';

// Fix Leaflet default icon issue with bundlers
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icons using emoji-based divIcon
function createMarkerIcon(type: 'rider' | 'driver' | 'pickup' | 'dropoff'): L.DivIcon {
  const emojiMap: Record<string, string> = {
    rider: '📍',
    driver: '🚗',
    pickup: '🟢',
    dropoff: '🔴',
  };

  const sizeMap: Record<string, number> = {
    rider: 28,
    driver: 32,
    pickup: 22,
    dropoff: 22,
  };

  return L.divIcon({
    html: `<span style="font-size:${sizeMap[type]}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));display:flex;align-items:center;justify-content:center;">${emojiMap[type]}</span>`,
    className: styles.markerIcon,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

// Inner component to update map view when center changes
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [center[0], center[1], zoom, map]);

  return null;
}

// OSRM Route Fetcher Component
function RouteRenderer({ pickup, dropoff }: { pickup: [number, number], dropoff: [number, number] }) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const map = useMap();

  useEffect(() => {
    async function fetchRoute() {
      try {
        // OSRM requires lng,lat
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickup[1]},${pickup[0]};${dropoff[1]},${dropoff[0]}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates;
          // OSRM returns [lng, lat], leaflet needs [lat, lng]
          const latLngs = coords.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          setRoute(latLngs);

          // Fit bounds to route
          const bounds = L.latLngBounds(latLngs);
          map.fitBounds(bounds, { padding: [50, 50], animate: true });
        }
      } catch (err) {
        console.error("Failed to fetch OSRM route:", err);
      }
    }
    fetchRoute();
  }, [pickup[0], pickup[1], dropoff[0], dropoff[1], map]);

  if (route.length === 0) return null;

  return (
    <Polyline
      positions={route}
      color="var(--accent, #E8A838)"
      weight={5}
      opacity={0.8}
      dashArray="10, 15"
      className={styles.routeLine}
    />
  );
}

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  type: 'rider' | 'driver' | 'pickup' | 'dropoff';
}

interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  className?: string;
  fullscreen?: boolean;
  pickup?: [number, number];
  dropoff?: [number, number];
}

function Map({ center, zoom = 14, markers = [], className, fullscreen, pickup, dropoff }: MapProps) {
  return (
    <div
      className={`${styles.mapWrapper} ${fullscreen ? styles.fullscreen : ''} ${className || ''}`}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ width: '100%', height: '100%' }}
      >
        <ChangeView center={center} zoom={zoom} />
        {pickup && dropoff && <RouteRenderer pickup={pickup} dropoff={dropoff} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {markers.map((marker, idx) => (
          <Marker
            key={`${marker.type}-${marker.lat}-${marker.lng}-${idx}`}
            position={[marker.lat, marker.lng]}
            icon={createMarkerIcon(marker.type)}
          >
            <Popup>
              <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{marker.label}</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default Map;
