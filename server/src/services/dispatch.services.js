import pool from "../config/db.js";
// completion is now triggered by movement.controller.js after physical arrival

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

    const ambulanceResult = await pool.query(
      `SELECT * FROM ambulances
                WHERE status = 'FREE'
                ORDER BY POWER(latitude - $1, 2) + POWER(longitude - $2, 2) ASC
                LIMIT 1`,
      [emergency.latitude, emergency.longitude],
    );
    if (ambulanceResult.rows.length === 0) return;
    const ambulance = ambulanceResult.rows[0];
    //starting transaction
    const client = await pool.connect();
    try{
        await client.query(`BEGIN`);
        //updating status for ambulance
        await client.query(
            `UPDATE ambulances SET status = 'ASSIGNED' WHERE id = $1`,
            [ambulance.id]
        )
        //marking emergency assigned
        await client.query(
        `UPDATE emergencies 
         SET status = 'ASSIGNED' 
         WHERE id = $1`,
        [emergency.id]
      ) 
      await client.query(
        `INSERT INTO assignments (ambulance_id, emergency_id)
         VALUES ($1, $2)`,
        [ambulance.id, emergency.id]
      )

      await client.query(`COMMIT`)

      console.log(`Assigned Ambulance ${ambulance.id} -> Emergency ${emergency.id}`)
      // movement.controller.js detects arrival and calls completeAssignment()
    }
    catch(err){
        console.log("Error in updating data ",err);
        await client.query(`ROLLBACK`)
    }
    finally{
        if (client) client.release();
    }

  } catch (err) {
    console.log("Error is thrown Check once =>", err);
  }
};
