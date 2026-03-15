import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Ambulance } from '../services/api';

interface Props {
  ambulance: Ambulance;
}

function statusColor(status: string) {
  if (status === 'FREE') return { color: 'var(--accent)', glow: 'var(--accent-glow)' };
  return { color: 'var(--warning)', glow: 'var(--warning-soft)' };
}

function statusLabel(status: string) {
  if (status === 'FREE')     return 'AVAILABLE';
  if (status === 'ASSIGNED') return 'RESPONDING';
  if (status === 'BUSY')     return 'RESPONDING';
  return status;
}

function createAmbulanceIcon(status: string) {
  const colorHex = status === 'FREE' ? '#4f46e5' : '#f59e0b'; // raw hex for SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="14" fill="${colorHex}" fill-opacity="0.15" stroke="${colorHex}" stroke-width="1.5"/>
      <circle cx="18" cy="18" r="9" fill="${colorHex}" stroke="white" stroke-width="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"/>
      <path d="M12 5v14M5 12h14" stroke="white" stroke-width="3" stroke-linecap="round" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    tooltipAnchor: [18, -4],
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
      <Tooltip direction="top" offset={[0, -10]} permanent={false} className="custom-tooltip">
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '2px 4px' }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
             Unit #{ambulance.id}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11, color }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            {statusLabel(ambulance.status)}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}
