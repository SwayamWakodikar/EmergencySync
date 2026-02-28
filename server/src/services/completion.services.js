import pool from '../config/db.js'
import { assignNextEmergency } from './dispatch.services.js'

export async function completion(ambulanceId, emergencyId, distance) {

  const traveltime = Math.max(3000, distance * 5000)

  setTimeout(async () => {
    try {
      console.log(`Resolving emergency ${emergencyId}`)

      await pool.query(
        `UPDATE emergencies 
         SET status = 'COMPLETED' 
         WHERE id = $1`,
        [emergencyId]
      )

      await pool.query(
        `UPDATE ambulances 
         SET status = 'FREE' 
         WHERE id = $1`,
        [ambulanceId]
      )

      console.log(`Emergency ${emergencyId} completed`)
      await assignNextEmergency()

    } catch (err) {
      console.error(err)
    }

  }, traveltime)
}