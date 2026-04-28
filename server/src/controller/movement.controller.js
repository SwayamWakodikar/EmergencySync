import pool from '../config/db.js';
import { assignNextEmergency } from '../services/dispatch.services.js';
import log from '../utils/logger.js';

const CITY_WAYPOINTS = [
  { lat: 18.5317, lng: 73.8469 }, // Shivajinagar
  { lat: 18.5196, lng: 73.8364 }, // Deccan Gymkhana
  { lat: 18.5362, lng: 73.8953 }, // Koregaon Park
  { lat: 18.5089, lng: 73.9260 }, // Hadapsar
  { lat: 18.5590, lng: 73.8074 }, // Aundh
  { lat: 18.5074, lng: 73.8077 }, // Kothrud
  { lat: 18.5195, lng: 73.8799 }, // Camp / MG Road
  { lat: 18.5787, lng: 73.9004 }, // Vishrantwadi
  { lat: 18.4529, lng: 73.8597 }, // Katraj
  { lat: 18.5989, lng: 73.7612 }, // Wakad
  { lat: 18.5590, lng: 73.7868 }, // Baner
  { lat: 18.6298, lng: 73.7997 }, // Pimpri
  { lat: 18.4936, lng: 73.8204 }, // Warje
  { lat: 18.5642, lng: 73.7769 }, // Pashan
  { lat: 18.4655, lng: 73.8704 }, // Bibwewadi
  { lat: 18.5508, lng: 73.9323 }, // Viman Nagar
  { lat: 18.5018, lng: 73.9152 }, // Wanowrie
  { lat: 18.6000, lng: 73.8400 }, // Bhosari
];

const ambulanceState = new Map();

const FREE_SPEED       = 0.0008; 
const ASSIGNED_SPEED   = 0.0014; 
const PATROL_ARRIVE    = 0.003;  
const EMERGENCY_ARRIVE = 0.002;  
const SOLVE_MIN        = 2000;   
const SOLVE_MAX        = 3000;   

async function getRoute(lat1, lng1, lat2, lng2) {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'EmergencySyncBackend/1.0 (contact@example.com)' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
    }
  } catch (err) {
    log(`OSRM route fetch failed: ${err.message}`, "ERROR");
  }
  return null;
}

function dist(lat1, lng1, lat2, lng2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}

function stepToward(lat, lng, targetLat, targetLng, speed) {
  const d = dist(lat, lng, targetLat, targetLng);
  if (d < 0.00001) return { lat: targetLat, lng: targetLng };
  const ratio  = Math.min(speed / d, 1);
  return {
    lat: lat + (targetLat - lat) * ratio,
    lng: lng + (targetLng - lng) * ratio,
  };
}

function pickNextWaypoint(currentIndex) {
  let idx, attempts = 0;
  do { idx = Math.floor(Math.random() * CITY_WAYPOINTS.length); attempts++; }
  while (idx === currentIndex && attempts < 10);
  return idx;
}

function stepAlongPath(lat, lng, path, pathIndex, speed) {
  let currentLat = lat;
  let currentLng = lng;
  let remainingSpeed = speed;
  let currIndex = pathIndex;

  while (remainingSpeed > 0.00001 && currIndex < path.length) {
    const target = path[currIndex];
    const d = dist(currentLat, currentLng, target.lat, target.lng);
    
    if (d <= remainingSpeed) {
      remainingSpeed -= d;
      currentLat = target.lat;
      currentLng = target.lng;
      currIndex++;
    } else {
      const ratio = remainingSpeed / d;
      currentLat += (target.lat - currentLat) * ratio;
      currentLng += (target.lng - currentLng) * ratio;
      remainingSpeed = 0;
    }
  }

  return { newLat: currentLat, newLng: currentLng, newPathIndex: currIndex };
}

async function completeAssignment(ambulanceId, emergencyId) {
  try {
    // Free this specific vehicle
    await pool.query(
      `UPDATE ambulances SET status = 'FREE' WHERE id = $1`,
      [ambulanceId]
    );

    log(`Vehicle ${ambulanceId} finished at Emergency ${emergencyId}`);

    // Check if ALL vehicles assigned to this emergency are now free (none still ASSIGNED)
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS still_active FROM assignments asn
       JOIN ambulances a ON asn.ambulance_id = a.id
       WHERE asn.emergency_id = $1 AND a.status = 'ASSIGNED'`,
      [emergencyId]
    );

    const stillActive = parseInt(rows[0].still_active);

    if (stillActive === 0) {
      // All vehicles have completed — mark emergency as resolved
      await pool.query(
        `UPDATE emergencies SET status = 'COMPLETED' WHERE id = $1`,
        [emergencyId]
      );
      log(`✅ All vehicles done — Emergency ${emergencyId} COMPLETED`);
    } else {
      log(`⏳ Emergency ${emergencyId}: ${stillActive} vehicle(s) still responding`);
    }

    // Reset any orphaned emergencies
    await pool.query(
      `UPDATE emergencies SET status = 'WAITING'
       WHERE status = 'ASSIGNED'
         AND id != $1
         AND id IN (SELECT emergency_id FROM assignments WHERE ambulance_id = $2)`,
      [emergencyId, ambulanceId]
    );
  } catch (err) {
    log(`completeAssignment error: ${err.message}`, "ERROR");
  }
}

export async function moveAmbulance() {
  try {
    const now = Date.now();

    for (const [ambulanceId, state] of ambulanceState.entries()) {
      if (state.phase !== 'SOLVING') continue;
      if (now >= state.solveAt) {
        ambulanceState.delete(ambulanceId);
        await completeAssignment(ambulanceId, state.emergencyId);
      }
    }

    const { rows: orphans } = await pool.query(`
      UPDATE ambulances SET status = 'FREE'
      WHERE status = 'ASSIGNED'
        AND id NOT IN (
          SELECT DISTINCT asn.ambulance_id
          FROM assignments asn
          JOIN emergencies e ON asn.emergency_id = e.id
          WHERE e.status = 'ASSIGNED'
        )
      RETURNING id
    `);
    if (orphans.length > 0) {
      const ids = orphans.map(r => r.id);
      ids.forEach(id => ambulanceState.delete(id));
      log(`Orphan sweep: freed ambulance(s) ${ids.join(', ')} — will be re-dispatched`);
    }

    // ── Retry WAITING emergencies that weren't assigned (vehicles were busy) ──
    const { rows: waitingEmergencies } = await pool.query(
      `SELECT id, types_needed FROM emergencies WHERE status = 'WAITING' ORDER BY created_at ASC`
    );
    if (waitingEmergencies.length > 0) {
      const { assignment } = await import('./assignment.controller.js');
      for (const em of waitingEmergencies) {
        let typesNeeded;
        try { typesNeeded = typeof em.types_needed === 'string' ? JSON.parse(em.types_needed) : em.types_needed; }
        catch { typesNeeded = ['MEDICAL']; }
        try {
          const result = await assignment(em.id, typesNeeded || ['MEDICAL']);
          if (result && result.length > 0) {
            log(`🔄 Retry dispatch succeeded: Emergency #${em.id} → ${result.map(v => `${v.type}#${v.id}`).join(', ')}`);
          }
        } catch (err) {
          log(`Retry dispatch failed for Emergency #${em.id}: ${err.message}`, "WARN");
        }
      }
    }

    const solvingIds = new Set(
      [...ambulanceState.entries()]
        .filter(([, s]) => s.phase === 'SOLVING')
        .map(([id]) => id)
    );

    const { rows: freeAmbs } = await pool.query(
      `SELECT id, latitude AS lat, longitude AS lng FROM ambulances WHERE status = 'FREE'`
    );

    for (const amb of freeAmbs) {
      let state = ambulanceState.get(amb.id);

      if (!state || state.phase !== 'PATROL' || dist(amb.lat, amb.lng, state.destLat, state.destLng) < PATROL_ARRIVE || (!state.isFetching && state.path && state.pathIndex >= state.path.length)) {
        const idx = pickNextWaypoint(state ? state.waypointIndex : undefined);
        const wp  = CITY_WAYPOINTS[idx];
        
        state = { phase: 'PATROL', destLat: wp.lat, destLng: wp.lng, waypointIndex: idx, path: [], isFetching: true, pathIndex: 0 };
        ambulanceState.set(amb.id, state);

        getRoute(amb.lat, amb.lng, wp.lat, wp.lng).then(route => {
          if (route) {
            state.path = route;
          } else {
             state.path = [{ lat: wp.lat, lng: wp.lng }];
          }
          state.isFetching = false;
        });
      }

      if (state && !state.isFetching && state.path && state.pathIndex < state.path.length) {
        const { newLat, newLng, newPathIndex } = stepAlongPath(amb.lat, amb.lng, state.path, state.pathIndex, FREE_SPEED);
        state.pathIndex = newPathIndex;

        await pool.query(
          'UPDATE ambulances SET latitude = $1, longitude = $2 WHERE id = $3',
          [newLat, newLng, amb.id]
        );
      }
    }

    const { rows: assignedAmbs } = await pool.query(`
      SELECT DISTINCT ON (a.id)
             a.id,
             a.latitude  AS lat,
             a.longitude AS lng,
             e.id        AS emergency_id,
             e.latitude  AS target_lat,
             e.longitude AS target_lng
      FROM ambulances a
      JOIN assignments asn ON asn.ambulance_id = a.id
      JOIN emergencies e   ON asn.emergency_id  = e.id
      WHERE a.status = 'ASSIGNED'
        AND e.status = 'ASSIGNED'
      ORDER BY a.id, asn.assigned_at DESC
    `);

    for (const amb of assignedAmbs) {
      if (solvingIds.has(amb.id)) continue;

      const d = dist(amb.lat, amb.lng, amb.target_lat, amb.target_lng);

      if (d < EMERGENCY_ARRIVE) {
        const solveDelay = SOLVE_MIN + Math.random() * (SOLVE_MAX - SOLVE_MIN);
        ambulanceState.set(amb.id, {
          phase:       'SOLVING',
          emergencyId: amb.emergency_id,
          solveAt:     now + solveDelay,
        });
        log(`Ambulance ${amb.id} on-scene at Emergency ${amb.emergency_id}, solving`);
      } else {
        let state = ambulanceState.get(amb.id);
        if (!state || state.phase !== 'TRAVEL' || state.emergencyId !== amb.emergency_id) {
          state = {
            phase: 'TRAVEL',
            emergencyId: amb.emergency_id,
            targetLat: amb.target_lat,
            targetLng: amb.target_lng,
            path: [],
            pathIndex: 0,
            isFetching: true
          };
          ambulanceState.set(amb.id, state);

          getRoute(amb.lat, amb.lng, amb.target_lat, amb.target_lng).then(route => {
            if (route) {
              state.path = route;
            } else {
              state.path = [{ lat: amb.target_lat, lng: amb.target_lng }];
            }
            state.isFetching = false;
          });
        }

        if (state && !state.isFetching && state.path) {
          if (state.pathIndex < state.path.length) {
            const { newLat, newLng, newPathIndex } = stepAlongPath(amb.lat, amb.lng, state.path, state.pathIndex, ASSIGNED_SPEED);
            state.pathIndex = newPathIndex;

            await pool.query(
              'UPDATE ambulances SET latitude = $1, longitude = $2 WHERE id = $3',
              [newLat, newLng, amb.id]
            );
          } else {
            const { lat: newLat, lng: newLng } = stepToward(
              amb.lat, amb.lng, amb.target_lat, amb.target_lng, ASSIGNED_SPEED
            );
            await pool.query(
              'UPDATE ambulances SET latitude = $1, longitude = $2 WHERE id = $3',
              [newLat, newLng, amb.id]
            );
          }
        }
      }
    }

    const { rows: counts } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM ambulances  WHERE status = 'FREE')    AS free_count,
        (SELECT COUNT(*) FROM emergencies WHERE status = 'WAITING') AS waiting_count
    `);
    const freeCount    = parseInt(counts[0].free_count);
    const waitingCount = parseInt(counts[0].waiting_count);

    if (freeCount > 0 && waitingCount > 0) {
      const pairs = Math.min(freeCount, waitingCount);
      for (let i = 0; i < pairs; i++) {
        await assignNextEmergency();
      }
      log(`Dispatched ${pairs} ambulance(s) to waiting emergencies`);
    }

    const patrolCount  = freeAmbs.length;
    const travelCount  = assignedAmbs.filter(a => !solvingIds.has(a.id)).length;
    const solvingCount = solvingIds.size;
    if (patrolCount + travelCount + solvingCount > 0) {
      log(`Ambulances — Patrolling: ${patrolCount}, Responding: ${travelCount}, On-scene: ${solvingCount}`);
    }

  } catch (err) {
    log(`moveAmbulance error: ${err.stack || err}`, "ERROR");
  }
}