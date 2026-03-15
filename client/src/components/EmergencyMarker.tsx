import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Emergency } from '../services/api';

interface Props {
  emergency: Emergency;
}

const STATUS_CONFIG = {
  WAITING: { color: '#ef4444', glow: 'rgba(239,68,68,0.5)', pulse: true },
  ASSIGNED: { color: '#f97316', glow: 'rgba(249,115,22,0.5)', pulse: false },
  COMPLETED: { color: '#22c55e', glow: 'rgba(34,197,94,0.5)', pulse: false },
};

const SEVERITY_LABELS = ['', 'Minor', 'Moderate', 'Serious', 'Severe', 'Critical'];

function createEmergencyIcon(status: Emergency['status'], severity: number) {
  const cfg = STATUS_CONFIG[status];
  // Icon size scales with severity (informational; used in SVG dimensions)
  const pulse = cfg.pulse
    ? `<circle cx="18" cy="18" r="17" fill="none" stroke="${cfg.color}" stroke-width="1.5" opacity="0.4">
         <animate attributeName="r" values="14;22" dur="1.4s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite"/>
       </circle>`
    : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      ${pulse}
      <circle cx="18" cy="18" r="13" fill="${cfg.color}" fill-opacity="0.25" stroke="${cfg.color}" stroke-width="1.5"/>
      <circle cx="18" cy="18" r="8" fill="${cfg.color}" stroke="white" stroke-width="2" filter="drop-shadow(0 0 5px ${cfg.glow})"/>
      <text x="18" y="22" text-anchor="middle" font-size="10" fill="white" font-family="Arial" font-weight="900">${severity}</text>
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

export default function EmergencyMarker({ emergency }: Props) {
  const icon = createEmergencyIcon(emergency.status, emergency.severity);
  const cfg = STATUS_CONFIG[emergency.status];

  return (
    <Marker
      position={[emergency.latitude, emergency.longitude]}
      icon={icon}
    >
      <Tooltip direction="top" offset={[0, -10]} permanent={false}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>🚨 Emergency #{emergency.id}</div>
          <div style={{ color: cfg.color, fontWeight: 600, fontSize: 11 }}>
            ● {emergency.status}
          </div>
          <div style={{ marginTop: 2, fontSize: 11 }}>
            Severity: <span style={{ color: cfg.color, fontWeight: 700 }}>
              {emergency.severity} — {SEVERITY_LABELS[emergency.severity]}
            </span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
            {emergency.latitude.toFixed(4)}, {emergency.longitude.toFixed(4)}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}
