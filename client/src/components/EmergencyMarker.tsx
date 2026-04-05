import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Emergency } from '../services/api';

interface Props {
  emergency: Emergency;
}

const STATUS_CONFIG = {
  WAITING: { hex: '#f43f5e', color: 'var(--danger)', pulse: true },
  ASSIGNED: { hex: '#f59e0b', color: 'var(--warning)', pulse: false },
  COMPLETED: { hex: '#10b981', color: 'var(--success)', pulse: false },
};

const SEVERITY_LABELS = ['', 'Minor', 'Moderate', 'Serious', 'Severe', 'Critical'];

function createEmergencyIcon(status: Emergency['status'], severity: number) {
  const cfg = STATUS_CONFIG[status];
  const pulse = cfg.pulse
    ? `<circle cx="18" cy="18" r="17" fill="none" stroke="${cfg.hex}" stroke-width="1.5" opacity="0.4">
         <animate attributeName="r" values="14;22" dur="1.2s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.6;0" dur="1.2s" repeatCount="indefinite"/>
       </circle>`
    : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      ${pulse}
      <circle cx="18" cy="18" r="13" fill="${cfg.hex}" fill-opacity="0.15" stroke="${cfg.hex}" stroke-width="1.5"/>
      <circle cx="18" cy="18" r="8" fill="${cfg.hex}" stroke="white" stroke-width="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"/>
      <text x="18" y="22" text-anchor="middle" font-size="10" fill="white" font-family="Arial" font-weight="900">${severity}</text>
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

export default function EmergencyMarker({ emergency }: Props) {
  const icon = createEmergencyIcon(emergency.status, emergency.severity);
  const cfg = STATUS_CONFIG[emergency.status];

  return (
    <Marker
      position={[emergency.latitude, emergency.longitude]}
      icon={icon}
    >
      <Tooltip direction="top" offset={[0, -10]} permanent={false} className="custom-tooltip">
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '2px 4px' }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: cfg.color }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            Incident #{emergency.id}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 11 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Type</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{emergency.type}</span>

            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Status</span>
            <span style={{ color: cfg.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
               <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
               {emergency.status}
            </span>

            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Severity</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
              {emergency.severity} — {SEVERITY_LABELS[emergency.severity]}
            </span>
          </div>
          
          <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 6, fontFamily: 'monospace' }}>
            LOC: {emergency.latitude.toFixed(4)}, {emergency.longitude.toFixed(4)}
          </div>
          
          {emergency.description && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-primary)', maxWidth: 220, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4, fontWeight: 500 }}>
              {emergency.description}
            </div>
          )}
        </div>
      </Tooltip>
    </Marker>
  );
}
