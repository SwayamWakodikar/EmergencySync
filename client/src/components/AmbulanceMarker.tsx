import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Ambulance } from '../services/api';

interface Props {
  ambulance: Ambulance;
}

// Treat FREE=blue, anything active (ASSIGNED/BUSY/ON-SCENE) = orange
function statusColor(status: string) {
  if (status === 'FREE') return { color: '#3b82f6', glow: 'rgba(59,130,246,0.5)' };
  return { color: '#f97316', glow: 'rgba(249,115,22,0.5)' };
}

function statusLabel(status: string) {
  if (status === 'FREE')     return 'FREE';
  if (status === 'ASSIGNED') return 'RESPONDING';
  if (status === 'BUSY')     return 'RESPONDING';  // legacy — treated same as ASSIGNED
  return status;
}

function createAmbulanceIcon(status: string) {
  const { color, glow } = statusColor(status);
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
  const { color } = statusColor(ambulance.status);

  return (
    <Marker
      position={[ambulance.latitude, ambulance.longitude]}
      icon={icon}
    >
      <Tooltip direction="top" offset={[0, -10]} permanent={false}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>🚑 Ambulance #{ambulance.id}</div>
          <div style={{ color, fontWeight: 600, fontSize: 11 }}>
            ● {statusLabel(ambulance.status)}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11 }}>
            {ambulance.latitude.toFixed(4)}, {ambulance.longitude.toFixed(4)}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}
