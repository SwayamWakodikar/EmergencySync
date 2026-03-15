import pool from '../config/db.js';
import { assignNextEmergency } from '../services/dispatch.services.js';

// ─── City waypoints (real Pune landmarks) ────────────────────────────────────
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

// ─── In-memory state per ambulance ───────────────────────────────────────────
// PATROL  → { phase: 'PATROL',  destLat, destLng, waypointIndex }
// TRAVEL  → { phase: 'TRAVEL',  emergencyId, targetLat, targetLng }
// SOLVING → { phase: 'SOLVING', emergencyId, solveAt }
const ambulanceState = new Map();

// ─── Constants ────────────────────────────────────────────────────────────────
const FREE_SPEED       = 0.0008; // ~89 m/s  patrol speed
const ASSIGNED_SPEED   = 0.0014; // ~156 m/s emergency response speed
const PATROL_ARRIVE    = 0.003;  // ~330 m — snap to next patrol waypoint
const EMERGENCY_ARRIVE = 0.002;  // ~220 m — "arrived at scene"
const SOLVE_MIN        = 2000;   // ms minimum on-scene time
const SOLVE_MAX        = 3000;   // ms maximum on-scene time

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dist(lat1, lng1, lat2, lng2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}

function pickNextWaypoint(currentIndex) {
  let idx, attempts = 0;
  do { idx = Math.floor(Math.random() * CITY_WAYPOINTS.length); attempts++; }
  while (idx === currentIndex && attempts < 10);
  return idx;
}

function stepToward(lat, lng, targetLat, targetLng, speed) {
  const d = dist(lat, lng, targetLat, targetLng);
  if (d < 0.00001) return { lat: targetLat, lng: targetLng };
  const ratio  = Math.min(speed / d, 1);
  const wobble = (Math.random() - 0.5) * speed * 0.05;
  return {
    lat: lat + (targetLat - lat) * ratio + wobble,
    lng: lng + (targetLng - lng) * ratio + wobble,
  };
}

// ─── Complete a solved assignment ─────────────────────────────────────────────
async function completeAssignment(ambulanceId, emergencyId) {
  try {
    // Mark the solved emergency COMPLETED
    await pool.query(
      `UPDATE emergencies SET status = 'COMPLETED' WHERE id = $1`,
      [emergencyId]
    );

    // Safety: reset any OTHER stale ASSIGNED emergencies for this ambulance
    // back to WAITING so they re-enter the queue cleanly
    await pool.query(
      `UPDATE emergencies SET status = 'WAITING'
       WHERE status = 'ASSIGNED'
         AND id != $1
         AND id IN (SELECT emergency_id FROM assignments WHERE ambulance_id = $2)`,
      [emergencyId, ambulanceId]
    );

    // Free the ambulance
    await pool.query(
      `UPDATE ambulances SET status = 'FREE' WHERE id = $1`,
      [ambulanceId]
    );

    console.log(`Complete: Ambulance ${ambulanceId} freed, Emergency ${emergencyId} resolved`);
  } catch (err) {
    console.error('completeAssignment error:', err);
  }
}

// ─── Main movement tick ───────────────────────────────────────────────────────
export async function moveAmbulance() {
  try {
    const now = Date.now();

    // ── Step 1a: Resolve SOLVING ambulances whose timer has expired ───────────
    for (const [ambulanceId, state] of ambulanceState.entries()) {
      if (state.phase !== 'SOLVING') continue;
      if (now >= state.solveAt) {
        ambulanceState.delete(ambulanceId);
        await completeAssignment(ambulanceId, state.emergencyId);
      }
      // else: still solving — ambulance stays still, skip all movement for it
    }

    // ── Step 1b: Live orphan sweep ────────────────────────────────────────────
    // Catches ambulances stuck as ASSIGNED mid-session when their linked
    // emergency is no longer ASSIGNED (completed, re-queued, or state drift).
    // These ambulances fall into a "dead zone": skipped by patrol (not FREE)
    // and skipped by travel (no JOIN match). This sweep rescues them every tick.
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
      ids.forEach(id => ambulanceState.delete(id)); // clear any stale in-memory state
      console.log(`Orphan sweep: freed ambulance(s) ${ids.join(', ')} — will be re-dispatched`);
    }

    // IDs currently in SOLVING phase (should not be moved this tick)
    const solvingIds = new Set(
      [...ambulanceState.entries()]
        .filter(([, s]) => s.phase === 'SOLVING')
        .map(([id]) => id)
    );

    // ── Step 2: Move FREE ambulances (patrol between city waypoints) ──────────
    const { rows: freeAmbs } = await pool.query(
      `SELECT id, latitude AS lat, longitude AS lng FROM ambulances WHERE status = 'FREE'`
    );

    for (const amb of freeAmbs) {
      let state = ambulanceState.get(amb.id);

      // First time FREE (just became free): assign patrol waypoint
      if (!state || state.phase !== 'PATROL') {
        const idx = Math.floor(Math.random() * CITY_WAYPOINTS.length);
        const wp  = CITY_WAYPOINTS[idx];
        state = { phase: 'PATROL', destLat: wp.lat, destLng: wp.lng, waypointIndex: idx };
        ambulanceState.set(amb.id, state);
      }

      // Reached waypoint? Pick next one
      if (dist(amb.lat, amb.lng, state.destLat, state.destLng) < PATROL_ARRIVE) {
        const idx = pickNextWaypoint(state.waypointIndex);
        const wp  = CITY_WAYPOINTS[idx];
        state.destLat = wp.lat; state.destLng = wp.lng; state.waypointIndex = idx;
      }

      const { lat: newLat, lng: newLng } = stepToward(
        amb.lat, amb.lng, state.destLat, state.destLng, FREE_SPEED
      );
      await pool.query(
        'UPDATE ambulances SET latitude = $1, longitude = $2 WHERE id = $3',
        [newLat, newLng, amb.id]
      );
    }

    // ── Step 3: Move ASSIGNED ambulances toward their emergency ───────────────
    // DISTINCT ON (a.id) guarantees each ambulance only targets ONE emergency
    // (the most recently assigned one), even if old stale rows exist in assignments.
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
      // Skip ambulances already in SOLVING phase
      if (solvingIds.has(amb.id)) continue;

      const d = dist(amb.lat, amb.lng, amb.target_lat, amb.target_lng);

      if (d < EMERGENCY_ARRIVE) {
        // Arrived at scene — enter SOLVING phase
        const solveDelay = SOLVE_MIN + Math.random() * (SOLVE_MAX - SOLVE_MIN);
        ambulanceState.set(amb.id, {
          phase:       'SOLVING',
          emergencyId: amb.emergency_id,
          solveAt:     now + solveDelay,
        });
        console.log(`Ambulance ${amb.id} on-scene at Emergency ${amb.emergency_id}, solving for ${(solveDelay / 1000).toFixed(1)}s`);
      } else {
        // Still travelling — update in-memory state and move
        ambulanceState.set(amb.id, {
          phase:       'TRAVEL',
          emergencyId: amb.emergency_id,
          targetLat:   amb.target_lat,
          targetLng:   amb.target_lng,
        });

        const { lat: newLat, lng: newLng } = stepToward(
          amb.lat, amb.lng, amb.target_lat, amb.target_lng, ASSIGNED_SPEED
        );
        await pool.query(
          'UPDATE ambulances SET latitude = $1, longitude = $2 WHERE id = $3',
          [newLat, newLng, amb.id]
        );
      }
    }

    // ── Step 4: PROACTIVE DISPATCH ────────────────────────────────────────────
    // Every tick, pair unmatched FREE ambulances with WAITING emergencies.
    // This is the key step: without it, free ambulances patrol indefinitely
    // while waiting emergencies pile up with no trigger to dispatch them.
    const { rows: counts } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM ambulances  WHERE status = 'FREE')    AS free_count,
        (SELECT COUNT(*) FROM emergencies WHERE status = 'WAITING') AS waiting_count
    `);
    const freeCount    = parseInt(counts[0].free_count);
    const waitingCount = parseInt(counts[0].waiting_count);

    if (freeCount > 0 && waitingCount > 0) {
      // Dispatch as many pairs as possible this tick
      const pairs = Math.min(freeCount, waitingCount);
      for (let i = 0; i < pairs; i++) {
        await assignNextEmergency();
      }
      console.log(`Dispatched ${pairs} ambulance(s) to waiting emergencies`);
    }

    // ── Logging ──────────────────────────────────────────────────────────────
    const patrolCount  = freeAmbs.length;
    const travelCount  = assignedAmbs.filter(a => !solvingIds.has(a.id)).length;
    const solvingCount = solvingIds.size;
    if (patrolCount + travelCount + solvingCount > 0) {
      console.log(`Ambulances — Patrolling: ${patrolCount}, Responding: ${travelCount}, On-scene: ${solvingCount}`);
    }

  } catch (err) {
    console.error('moveAmbulance error:', err);
  }
}