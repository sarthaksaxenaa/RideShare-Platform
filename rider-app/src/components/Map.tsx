import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
}

function Map({ center, zoom = 14, markers = [], className, fullscreen }: MapProps) {
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker, idx) => (
          <Marker
            key={`${marker.type}-${marker.lat}-${marker.lng}-${idx}`}
            position={[marker.lat, marker.lng]}
            icon={createMarkerIcon(marker.type)}
          >
            <Popup>
              <span style={{ fontWeight: 600, color: '#fff' }}>{marker.label}</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default Map;
