import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import AmbulanceMarker from './AmbulanceMarker';
import EmergencyMarker from './EmergencyMarker';
import type { Ambulance, Emergency, Assignment } from '../services/api';

interface Props {
  ambulances: Ambulance[];
  emergencies: Emergency[];
  assignments: Assignment[];
}

const CITY_CENTER: [number, number] = [18.52, 73.85];
const ZOOM = 12;

export default function MapView({ ambulances, emergencies, assignments }: Props) {
  // Build a lookup map: ambulanceId -> ambulance, emergencyId -> emergency
  const ambulanceMap = new Map(ambulances.map((a) => [a.id, a]));
  const emergencyMap = new Map(emergencies.map((e) => [e.id, e]));

  // Only draw polylines for active ASSIGNED assignments
  const activeLines = assignments.filter((a) => {
    const amb = ambulanceMap.get(a.ambulance_id);
    const em = emergencyMap.get(a.emergency_id);
    return amb?.status === 'ASSIGNED' && em?.status === 'ASSIGNED';
  });

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
      <MapContainer
        center={CITY_CENTER}
        zoom={ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        {/* Dark map tiles from CartoDB */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Ambulance markers */}
        {ambulances.map((amb) => (
          <AmbulanceMarker key={`amb-${amb.id}`} ambulance={amb} />
        ))}

        {/* Emergency markers */}
        {emergencies.map((em) => (
          <EmergencyMarker key={`em-${em.id}`} emergency={em} />
        ))}

        {/* Dispatch polylines */}
        {activeLines.map((a) => {
          const amb = ambulanceMap.get(a.ambulance_id)!;
          const em = emergencyMap.get(a.emergency_id)!;
          return (
            <Polyline
              key={`line-${a.id}`}
              positions={[
                [amb.latitude, amb.longitude],
                [em.latitude, em.longitude],
              ]}
              pathOptions={{
                color: '#f97316',
                weight: 2.5,
                opacity: 0.75,
                dashArray: '8, 6',
              }}
            />
          );
        })}
      </MapContainer>

      {/* Map overlay legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          right: 16,
          zIndex: 1000,
          background: 'rgba(10,12,18,0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 150,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
          Legend
        </div>
        {[
          { color: '#3b82f6', label: 'Ambulance (Free)' },
          { color: '#f97316', label: 'Ambulance (Assigned)' },
          { color: '#ef4444', label: 'Emergency (Waiting)' },
          { color: '#f97316', label: 'Emergency (Assigned)' },
          { color: '#22c55e', label: 'Emergency (Completed)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}` }} />
            {label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
          <div style={{ width: 18, height: 2, background: '#f97316', flexShrink: 0, backgroundImage: 'repeating-linear-gradient(to right, #f97316 0, #f97316 6px, transparent 6px, transparent 12px)' }} />
          Dispatch Route
        </div>
      </div>
    </div>
  );
}
