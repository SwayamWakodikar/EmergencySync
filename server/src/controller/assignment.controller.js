import pool from '../config/db.js';
import log from '../utils/logger.js';
// completion is now handled by movement.controller.js (arrival-based, not timer-based)
// simple distance calculation (good enough for city scale)
function distance(a, b) {
  const dx = a.lat - b.lat
  const dy = a.lng - b.lng
  return Math.sqrt(dx * dx + dy * dy)
}

export async function assignment(emergencyId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /*
    const emergency = await tx.emergencyu.findUnique({ where: { id: emergencyId } })
    */
    const { rows: emergencies } = await client.query('SELECT id, latitude as lat, longitude as lng, type, status FROM emergencies WHERE id = $1', [emergencyId]);
    const emergency = emergencies[0];

    log(`assignEmergency called with ID: ${emergencyId}`);

    if (!emergency || emergency.status !== 'WAITING') {
      await client.query('ROLLBACK');
      return null
    }

    /*
    const ambulances = await tx.ambulance.findMany({ where: { status: 'FREE' } })
    */
    let requiredType = 'AMBULANCE';
    if (emergency.type === 'FIRE') requiredType = 'FIRE';
    if (emergency.type === 'POLICE') requiredType = 'POLICE';

    const { rows: ambulances } = await client.query("SELECT id, latitude as lat, longitude as lng, status FROM ambulances WHERE status = 'FREE' AND type = $1", [requiredType]);

    if (ambulances.length === 0) {
      await client.query('ROLLBACK');
      return null
    }

    let nearest = ambulances[0]
    let minDist = distance(nearest, emergency)

    for (const amb of ambulances.slice(1)) {
      const d = distance(amb, emergency)
      if (d < minDist) {
        minDist = d
        nearest = amb
      }
    }

    /*
    await tx.ambulance.update({ where: { id: nearest.id }, data: { status: 'ASSIGNED' } })
    */
    await client.query(
      'UPDATE ambulances SET status = $1 WHERE id = $2',
      ['ASSIGNED', nearest.id]
    );

    /*
    await tx.emergencyu.update({ where: { id: emergency.id }, data: { status: 'ASSIGNED' } })
    */
    await client.query(
      'UPDATE emergencies SET status = $1 WHERE id = $2',
      ['ASSIGNED', emergency.id]
    );

    /*
    const assignment = await tx.assignment.create({ data: { ambulanceId: nearest.id, emergencyId: emergency.id } })
    */
    const { rows: assignmentRows } = await client.query(
      `INSERT INTO assignments (ambulance_id, emergency_id, assigned_at)
       VALUES ($1, $2, NOW()) RETURNING *`,
      [nearest.id, emergency.id]
    );
    const assignment = assignmentRows[0];

    await client.query('COMMIT');

    // movement.controller.js will detect arrival and handle COMPLETED transition
    log(`Assigned ambulance ${nearest.id} -> emergency ${emergency.id}`);
    // await assignNextEmergency();
    return assignment;
  } catch (err) {
    await client.query('ROLLBACK');
    log(`assignment error: ${err.message}`, "ERROR");
    throw err;
  } finally {
    client.release();
  }
}
