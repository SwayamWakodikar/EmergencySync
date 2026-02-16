import prisma from "../prisma.js";
import { assignment } from "../controller/assignment.controller.js";

export async function completion(ambulanceId,emergencyId) {
    setTimeout(async ()=>{
        console.log(`Resolving the emergency ${emergencyId}`);

        await prisma.emergencyu.update({
            where:{id: emergencyId},
            data:{ status: "COMPLETED"},
        })
        await prisma.ambulance.update({
            where:{id:ambulanceId},
            data:{
                status:"FREE"
            },
        })
        const newEmergency=await prisma.emergencyu.findFirst({
            where:{status:"WAITING"},
            orderBy: { createdAt: 'asc' }
        })
        if(newEmergency){
            await assignment(newEmergency.id);
        }
    },10000)
}