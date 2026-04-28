import pool from "../config/db.js";
import log from "../utils/logger.js";
// completion is now triggered by movement.controller.js after physical arrival

// Map emergency type to vehicle type
function vehicleTypeFor(emergencyType) {
  if (emergencyType === 'FIRE') return 'FIRE';
  if (emergencyType === 'POLICE') return 'POLICE';
  return 'AMBULANCE'; // MEDICAL -> AMBULANCE
}

export const assignNextEmergency = async () => {
  try {
    const emergencyResult = await pool.query(`
                SELECT * FROM emergencies
                WHERE status = 'WAITING'
                ORDER BY severity DESC, created_at ASC
                LIMIT 1
            `);
    if (emergencyResult.rows.length === 0) return;
    const emergency = emergencyResult.rows[0];

    // Parse types_needed — supports multi-vehicle dispatch
    let typesNeeded = [];
    try {
      typesNeeded = JSON.parse(emergency.types_needed || '[]');
    } catch { /* ignore parse errors */ }
    if (!Array.isArray(typesNeeded) || typesNeeded.length === 0) {
      typesNeeded = [emergency.type || 'MEDICAL'];
    }

    // Check which types still need vehicles (some may already be assigned from partial earlier dispatch)
    const { rows: existingAssignments } = await pool.query(
      `SELECT a.type FROM assignments asn JOIN ambulances a ON asn.ambulance_id = a.id WHERE asn.emergency_id = $1`,
      [emergency.id]
    );
    const alreadyAssignedTypes = new Set(existingAssignments.map(r => {
      // Map vehicle type back to emergency type for comparison
      if (r.type === 'AMBULANCE') return 'MEDICAL';
      return r.type;
    }));
    const remainingTypes = typesNeeded.filter(t => !alreadyAssignedTypes.has(t));

    if (remainingTypes.length === 0) return; // All types already have vehicles

    const client = await pool.connect();
    let assignedAny = false;

    try {
      await client.query(`BEGIN`);

      for (const emergencyType of remainingTypes) {
        const requiredVehicleType = vehicleTypeFor(emergencyType);

        const ambulanceResult = await client.query(
          `SELECT * FROM ambulances
                    WHERE status = 'FREE' AND type = $3
                    ORDER BY POWER(latitude - $1, 2) + POWER(longitude - $2, 2) ASC
                    LIMIT 1`,
          [emergency.latitude, emergency.longitude, requiredVehicleType],
        );
        if (ambulanceResult.rows.length === 0) {
          log(`  ⚠️  No free ${requiredVehicleType} for re-dispatch to Emergency ${emergency.id}`, "WARN");
          continue; // Skip — try other types
        }
        const ambulance = ambulanceResult.rows[0];

        // Update vehicle status
        await client.query(
          `UPDATE ambulances SET status = 'ASSIGNED' WHERE id = $1`,
          [ambulance.id]
        );

        // Create assignment
        await client.query(
          `INSERT INTO assignments (ambulance_id, emergency_id)
           VALUES ($1, $2)`,
          [ambulance.id, emergency.id]
        );

        log(`  → Re-dispatched ${requiredVehicleType} #${ambulance.id} → Emergency ${emergency.id}`);
        assignedAny = true;
      }

      if (assignedAny) {
        // Mark emergency as ASSIGNED
        await client.query(
          `UPDATE emergencies 
           SET status = 'ASSIGNED' 
           WHERE id = $1`,
          [emergency.id]
        );
      }

      await client.query(`COMMIT`);
    } catch (err) {
      log(`Error in dispatch update: ${err.message}`, "ERROR");
      await client.query(`ROLLBACK`);
    } finally {
      if (client) client.release();
    }

  } catch (err) {
    log(`Error in assignNextEmergency: ${err.message}`, "ERROR");
  }
};
