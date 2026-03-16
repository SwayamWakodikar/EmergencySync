import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import AmbulanceMarker from './AmbulanceMarker';
import EmergencyMarker from './EmergencyMarker';
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

        const url = `http://router.project-osrm.org/route/v1/driving/${amb.longitude},${amb.latitude};${em.longitude},${em.latitude}?overview=full&geometries=geojson`;
        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            if (data.routes && data.routes.length > 0) {
              const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
              setRoutesMap((prev) => ({ ...prev, [a.id]: coords }));
            }
          })
          .catch((err) => console.error('OSRM route error:', err));
      }
    });
  }, [activeLines, ambulanceMap, emergencyMap, routesMap]);

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

      {/* Map Overlay Legend */}
      <div
        className="glass hidden md:flex"
        style={{
          position: 'absolute',
          bottom: 32,
          left: 24,
          zIndex: 1000,
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 180,
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
          Live Map Legend
        </div>
        {[
          { color: 'var(--accent)', label: 'Ambulance (Free)' },
          { color: 'var(--warning)', label: 'Ambulance (Assigned)' },
          { color: 'var(--danger)', label: 'Emergency (Waiting)' },
          { color: 'var(--warning)', label: 'Emergency (Assigned)' },
          { color: 'var(--success)', label: 'Emergency (Resolved)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}` }} />
            {label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginTop: 4 }}>
          <div style={{ width: 14, height: 3, background: 'var(--warning)', flexShrink: 0 }} />
          Dispatch Route
        </div>
      </div>
    </div>
  );
}
