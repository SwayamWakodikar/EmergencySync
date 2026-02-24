// import prisma from "../prisma.js";
import pool from '../config/db.js';
import { assignment } from "../controller/assignment.controller.js";

export async function completion(ambulanceId,emergencyId,distance) {
    const traveltime=Math.max(3000,distance*5000)
    setTimeout(async ()=>{
        try {
            console.log(`Resolving the emergency ${emergencyId}`);

            /*
            await prisma.emergencyu.update({ where: { id: emergencyId }, data: { status: "COMPLETED" } })
            */
            await pool.query(
                `UPDATE emergencies SET status = 'COMPLETED' WHERE id = $1`,
                [emergencyId]
            );

            /*
            await prisma.ambulance.update({ where: { id: ambulanceId }, data: { status: "FREE" } })
            */
            await pool.query(
                `UPDATE ambulances SET status = 'FREE' WHERE id = $1`,
                [ambulanceId]
            );

            /*
            const newEmergency = await prisma.emergencyu.findFirst({ where: { status: "WAITING" }, orderBy: { createdAt: 'asc' } })
            */
            const { rows: newEmergencies } = await pool.query(
                `SELECT id FROM emergencies WHERE status = 'WAITING' ORDER BY created_at ASC LIMIT 1`
            );

            if(newEmergencies.length > 0){
                await assignment(newEmergencies[0].id);
            }
        } catch(err) {
            console.error(err);
        }
    },traveltime)
}