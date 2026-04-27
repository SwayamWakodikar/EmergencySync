import pool from '../config/db.js';
import log from '../utils/logger.js';
// completion is now handled by movement.controller.js (arrival-based, not timer-based)
// simple distance calculation (good enough for city scale)
function distance(a, b) {
  const dx = a.lat - b.lat
  const dy = a.lng - b.lng
  return Math.sqrt(dx * dx + dy * dy)
}

// Map emergency type to vehicle type
function vehicleTypeFor(emergencyType) {
  if (emergencyType === 'FIRE') return 'FIRE';
  if (emergencyType === 'POLICE') return 'POLICE';
  return 'AMBULANCE'; // MEDICAL -> AMBULANCE
}

export async function assignment(emergencyId, typesNeeded) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: emergencies } = await client.query('SELECT id, latitude as lat, longitude as lng, type, status FROM emergencies WHERE id = $1', [emergencyId]);
    const emergency = emergencies[0];

    log(`assignEmergency called with ID: ${emergencyId}, types: [${(typesNeeded || []).join(', ')}]`);

    if (!emergency || emergency.status !== 'WAITING') {
      await client.query('ROLLBACK');
      return null
    }

    // Fallback: if no typesNeeded provided, use the emergency's primary type
    if (!typesNeeded || typesNeeded.length === 0) {
      typesNeeded = [emergency.type || 'MEDICAL'];
    }

    const assignedVehicles = [];

    for (const emergencyType of typesNeeded) {
      const vehicleType = vehicleTypeFor(emergencyType);

      const { rows: vehicles } = await client.query(
        "SELECT id, latitude as lat, longitude as lng, status FROM ambulances WHERE status = 'FREE' AND type = $1",
        [vehicleType]
      );

      if (vehicles.length === 0) {
        log(`⚠️  No free ${vehicleType} vehicle available for emergency ${emergencyId}`, "WARN");
        continue; // Skip this type — other types can still be dispatched
      }

      // Find nearest vehicle of this type
      let nearest = vehicles[0];
      let minDist = distance(nearest, emergency);

      for (const veh of vehicles.slice(1)) {
        const d = distance(veh, emergency);
        if (d < minDist) {
          minDist = d;
          nearest = veh;
        }
      }

      // Mark vehicle as ASSIGNED
      await client.query(
        'UPDATE ambulances SET status = $1 WHERE id = $2',
        ['ASSIGNED', nearest.id]
      );

      // Create assignment record
      await client.query(
        `INSERT INTO assignments (ambulance_id, emergency_id, assigned_at)
         VALUES ($1, $2, NOW())`,
        [nearest.id, emergency.id]
      );

      assignedVehicles.push({ id: nearest.id, type: vehicleType });
      log(`  → Dispatched ${vehicleType} #${nearest.id} → Emergency ${emergencyId}`);
    }

    if (assignedVehicles.length > 0) {
      // Mark emergency as ASSIGNED
      await client.query(
        'UPDATE emergencies SET status = $1 WHERE id = $2',
        ['ASSIGNED', emergency.id]
      );
    }

    await client.query('COMMIT');

    if (assignedVehicles.length > 0) {
      log(`🚨 Multi-dispatch complete: ${assignedVehicles.map(v => `${v.type}#${v.id}`).join(', ')} → Emergency ${emergencyId}`);
    } else {
      log(`⚠️  No vehicles could be assigned to Emergency ${emergencyId}`, "WARN");
    }

    // movement.controller.js will detect arrival and handle COMPLETED transition
    return assignedVehicles;
  } catch (err) {
    await client.query('ROLLBACK');
    log(`assignment error: ${err.message}`, "ERROR");
    throw err;
  } finally {
    client.release();
  }
}
