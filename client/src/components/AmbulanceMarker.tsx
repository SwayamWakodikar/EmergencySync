import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Ambulance } from '../services/api';

interface Props {
  ambulance: Ambulance;
}

function createAmbulanceIcon(status: Ambulance['status']) {
  const color = status === 'FREE' ? '#3b82f6' : '#f97316';
  const glow = status === 'FREE' ? 'rgba(59,130,246,0.5)' : 'rgba(249,115,22,0.5)';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="14" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
      <circle cx="18" cy="18" r="9" fill="${color}" stroke="white" stroke-width="2" filter="drop-shadow(0 0 6px ${glow})"/>
      <text x="18" y="22.5" text-anchor="middle" font-size="11" fill="white" font-family="Arial" font-weight="bold">🚑</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    tooltipAnchor: [18, -2],
  });
}

export default function AmbulanceMarker({ ambulance }: Props) {
  const icon = createAmbulanceIcon(ambulance.status);

  return (
    <Marker
      key={ambulance.id}
      position={[ambulance.latitude, ambulance.longitude]}
      icon={icon}
    >
      <Tooltip direction="top" offset={[0, -10]} permanent={false}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>🚑 Ambulance #{ambulance.id}</div>
          <div style={{ color: ambulance.status === 'FREE' ? '#3b82f6' : '#f97316', fontWeight: 600, fontSize: 11 }}>
            ● {ambulance.status}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11 }}>
            {ambulance.latitude.toFixed(4)}, {ambulance.longitude.toFixed(4)}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}
