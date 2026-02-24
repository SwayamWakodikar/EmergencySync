// import prisma from "../prisma.js";
import pool from '../config/db.js';

function randomDelta(){
    return (Math.random()-0.5)*0.001;
}

export async function moveAmbulance() {
    try{
        /*
        const ambulance=await prisma.ambulance.findMany({
            where:{ status:"FREE" }
        });
        */
        const { rows: ambulances } = await pool.query("SELECT id, latitude as lat, longitude as lng, status FROM ambulances WHERE status = 'FREE'");
        
        for(const amb of ambulances){
            /*
            await prisma.ambulance.update({
                where:{id:amb.id},
                data: { lat: amb.lat+randomDelta(), lng: amb.lng+randomDelta() },
            })
            */
            await pool.query(
                'UPDATE ambulances SET latitude = $1, longitude = $2 WHERE id = $3',
                [amb.lat + randomDelta(), amb.lng + randomDelta(), amb.id]
            );
        }
        console.log(`Moved Ambulance by ${ambulances.length} `)
    }
    catch(err){
        console.log(err);
    }
}