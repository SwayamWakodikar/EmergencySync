import { useRef, useEffect, useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Ambulance } from '../services/api';

// ── Must match POLL_INTERVAL in Dashboard.tsx ──
const LERP_DURATION = 1500;

interface Props {
  ambulance: Ambulance;
}

function statusColor(status: string, type: string) {
  if (status !== 'FREE') return { color: 'var(--warning)', glow: 'var(--warning-soft)' };
  if (type === 'POLICE') return { color: '#3b82f6', glow: 'rgba(59,130,246,0.3)' };
  if (type === 'FIRE') return { color: '#ef4444', glow: 'rgba(239,68,68,0.3)' };
  return { color: 'var(--accent)', glow: 'var(--accent-glow)' };
}

function statusLabel(status: string) {
  if (status === 'FREE')     return 'AVAILABLE';
  if (status === 'ASSIGNED') return 'RESPONDING';
  if (status === 'BUSY')     return 'RESPONDING';
  return status;
}

function createAmbulanceIcon(status: string, type: string) {
  let colorHex = '#4f46e5'; // default AMBULANCE
  if (status !== 'FREE') colorHex = '#f59e0b';
  else if (type === 'POLICE') colorHex = '#3b82f6';
  else if (type === 'FIRE') colorHex = '#ef4444';
  
  const innerIcon = type === 'FIRE' 
    ? `<path d="M18 10c0 0-4 4-4 8a4 4 0 008 0c0-4-4-8-4-8z" stroke="white" stroke-width="2" fill="none" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"/>`
    : type === 'POLICE'
    ? `<path d="M13 14l5-3 5 3v4c0 3-5 5-5 5s-5-2-5-5v-4z" stroke="white" stroke-width="2" fill="none" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"/>`
    : `<path d="M18 14v8M14 18h8" stroke="white" stroke-width="2.5" stroke-linecap="round" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"/>`;

  // Animated pulse ring when ASSIGNED (responding to emergency)
  const pulseRing = status === 'ASSIGNED'
    ? `<circle cx="18" cy="18" r="14" fill="none" stroke="${colorHex}" stroke-width="2" opacity="0.6">
         <animate attributeName="r" values="14;22" dur="1s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.6;0" dur="1s" repeatCount="indefinite"/>
       </circle>
       <circle cx="18" cy="18" r="14" fill="none" stroke="${colorHex}" stroke-width="1" opacity="0.3">
         <animate attributeName="r" values="14;26" dur="1.4s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.3;0" dur="1.4s" repeatCount="indefinite"/>
       </circle>`
    : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      ${pulseRing}
      <circle cx="18" cy="18" r="14" fill="${colorHex}" fill-opacity="0.15" stroke="${colorHex}" stroke-width="1.5"/>
      <circle cx="18" cy="18" r="9" fill="${colorHex}" stroke="white" stroke-width="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"/>
      ${innerIcon}
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
  const icon = useMemo(
    () => createAmbulanceIcon(ambulance.status, ambulance.type),
    [ambulance.status, ambulance.type]
  );
  const { color } = statusColor(ambulance.status, ambulance.type);

  // ── Smooth 60fps interpolation via requestAnimationFrame ──
  const markerRef = useRef<L.Marker>(null);
  const targetPos = useRef<[number, number]>([ambulance.latitude, ambulance.longitude]);
  const startPos = useRef<[number, number]>([ambulance.latitude, ambulance.longitude]);
  const animRef = useRef<number>(0);
  const startTime = useRef<number>(0);
  const initialized = useRef(false);

  // Frozen position — never mutated, prevents react-leaflet from snapping the marker
  const frozenPos = useRef<[number, number]>([ambulance.latitude, ambulance.longitude]);

  useEffect(() => {
    const newLat = ambulance.latitude;
    const newLng = ambulance.longitude;

    // First render — snap immediately, no animation
    if (!initialized.current) {
      initialized.current = true;
      targetPos.current = [newLat, newLng];
      startPos.current = [newLat, newLng];
      return;
    }

    // No movement — skip
    if (newLat === targetPos.current[0] && newLng === targetPos.current[1]) {
      return;
    }

    // Cancel any in-flight animation
    if (animRef.current) cancelAnimationFrame(animRef.current);

    // Lerp from wherever the marker currently is → new target
    const currentLatLng = markerRef.current?.getLatLng();
    startPos.current = currentLatLng
      ? [currentLatLng.lat, currentLatLng.lng]
      : targetPos.current;
    targetPos.current = [newLat, newLng];
    startTime.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime.current;
      const t = Math.min(elapsed / LERP_DURATION, 1);

      // Ease-out cubic — natural deceleration
      const eased = 1 - Math.pow(1 - t, 3);

      const lat = startPos.current[0] + (targetPos.current[0] - startPos.current[0]) * eased;
      const lng = startPos.current[1] + (targetPos.current[1] - startPos.current[1]) * eased;

      // Directly update Leaflet marker — zero React re-renders
      markerRef.current?.setLatLng([lat, lng]);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [ambulance.latitude, ambulance.longitude]);

  return (
    <Marker
      ref={markerRef}
      position={frozenPos.current}
      icon={icon}
    >
      <Tooltip direction="top" offset={[0, -10]} permanent={false} className="custom-tooltip">
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '2px 4px' }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color }}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
             {ambulance.type} #{ambulance.id}
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
