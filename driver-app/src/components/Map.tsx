import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './Map.module.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom emoji-based marker icons
function createEmojiIcon(emoji: string, size: number = 32): L.DivIcon {
  return L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${emoji}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const MARKER_ICONS = {
  driver: createEmojiIcon('🚗', 32),
  rider: createEmojiIcon('📍', 28),
  pickup: createEmojiIcon('🟢', 26),
  dropoff: createEmojiIcon('🔴', 26),
};

interface Position {
  lat: number;
  lng: number;
}

interface MarkerData {
  position: Position;
  type: 'driver' | 'rider' | 'pickup' | 'dropoff';
}

interface MapProps {
  center: Position;
  zoom?: number;
  markers?: MarkerData[];
}

// Component that dynamically re-centers the map
function ChangeView({ center, zoom }: { center: Position; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [map, center.lat, center.lng, zoom]);

  return null;
}

function MapView({ center, zoom = 15, markers = [] }: MapProps) {
  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ width: '100%', height: '100%' }}
      >
        <ChangeView center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker, index) => (
          <Marker
            key={`${marker.type}-${index}`}
            position={[marker.position.lat, marker.position.lng]}
            icon={MARKER_ICONS[marker.type]}
          />
        ))}
      </MapContainer>
    </div>
  );
}

export default MapView;
export type { Position, MarkerData };
