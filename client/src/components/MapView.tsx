import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import AmbulanceMarker from './AmbulanceMarker';
import EmergencyMarker from './EmergencyMarker';
import HeatmapLayer from './HeatmapLayer';
import type { Ambulance, Emergency, Assignment } from '../services/api';

interface Props {
  ambulances: Ambulance[];
  emergencies: Emergency[];
  assignments: Assignment[];
}

import { useState, useEffect } from 'react';
const CITY_CENTER: [number, number] = [18.52, 73.85];
const ZOOM = 12;

function getTrimmedRoute(route: [number, number][], currentLat: number, currentLng: number): [number, number][] {
  if (!route || route.length === 0) return route;

  let closestIndex = 0;
  let minDistance = Infinity;

  // Find the point on the route closest to the ambulance's current location
  for (let i = 0; i < route.length; i++) {
    const p = route[i];
    const dist = Math.pow(p[0] - currentLat, 2) + Math.pow(p[1] - currentLng, 2);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  // Return the path starting from the closest point, plus prepend current exact location
  return [[currentLat, currentLng] as [number, number], ...route.slice(closestIndex)];
}

export default function MapView({ ambulances, emergencies, assignments }: Props) {
  // Build a lookup map: ambulanceId -> ambulance, emergencyId -> emergency
  const ambulanceMap = new Map(ambulances.map((a) => [a.id, a]));
  const emergencyMap = new Map(emergencies.map((e) => [e.id, e]));

  // Cache fetched routes { assignmentId: [[lat, lng], [lat, lng]] }
  const [routesMap, setRoutesMap] = useState<Record<number, [number, number][]>>({});

  // Only draw polylines for active ASSIGNED assignments
  const activeLines = assignments.filter((a) => {
    const amb = ambulanceMap.get(a.ambulance_id);
    const em = emergencyMap.get(a.emergency_id);
    return amb?.status === 'ASSIGNED' && em?.status === 'ASSIGNED';
  });

  useEffect(() => {
    activeLines.forEach((a) => {
      // If we don't have the route cached yet, fetch it
      if (!routesMap[a.id]) {
        const amb = ambulanceMap.get(a.ambulance_id)!;
        const em = emergencyMap.get(a.emergency_id)!;
        // Mark as 'fetching' to prevent duplicate requests
        setRoutesMap((prev) => ({ ...prev, [a.id]: [] }));

        // Fetch directly from OSRM to avoid backend IP rate-limiting which causes straight lines
        const url = `https://router.project-osrm.org/route/v1/driving/${amb.longitude},${amb.latitude};${em.longitude},${em.latitude}?overview=full&geometries=geojson`;
        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            if (data.routes && data.routes.length > 0) {
              const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
              setRoutesMap((prev) => ({ ...prev, [a.id]: coords }));
            }
          })
          .catch((err) => console.error('OSRM route error:', err));
      }
    });
  }, [activeLines, ambulanceMap, emergencyMap, routesMap]);

  const [showHeatmap, setShowHeatmap] = useState(false);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <MapContainer
        center={CITY_CENTER}
        zoom={ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false} /* we can rely on scroll or add custom zoom controls later */
      >
        {/* Dark map tiles from CartoDB */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Heatmap layer */}
        <HeatmapLayer emergencies={emergencies} visible={showHeatmap} />

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
          const route = routesMap[a.id];
          const positions: [number, number][] = route && route.length > 0 
            ? getTrimmedRoute(route, amb.latitude, amb.longitude)
            : [[amb.latitude, amb.longitude], [em.latitude, em.longitude]]; // fallback

          return (
            <Polyline
              key={`line-${a.id}`}
              positions={positions}
              pathOptions={{
                color: 'var(--warning)',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 8',
              }}
            />
          );
        })}
      </MapContainer>

      {/* Heatmap toggle button */}
      <button
        onClick={() => setShowHeatmap(h => !h)}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 13px',
          borderRadius: '8px',
          border: `1px solid ${showHeatmap ? '#ef4444' : '#222'}`,
          background: showHeatmap ? 'rgba(239,68,68,0.15)' : '#111',
          color: showHeatmap ? '#ef4444' : '#888',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
          cursor: 'pointer',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Flame icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
        </svg>
        {showHeatmap ? 'Heatmap On' : 'Heatmap'}
      </button>

      {/* Compact Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 900,
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          gap: 16,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 10,
          fontWeight: 600,
          color: '#aaa',
          letterSpacing: '0.02em',
        }}
      >
        {[
          { color: '#4f46e5', label: 'Medic' },
          { color: '#3b82f6', label: 'Police' },
          { color: '#ef4444', label: 'Fire' },
          { color: '#f59e0b', label: 'Incident' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
