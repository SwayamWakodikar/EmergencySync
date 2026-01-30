import prisma from "../prisma.js";

function randomDelta(){
    return (Math.random()-0.5)*0.001;
}

export async function moveAmbulance() {
    try{
        const ambulance=await prisma.ambulance.findMany({
            where:{
                status:"FREE"
            }
        });
        for( const amb of ambulance){
            await prisma.ambulance.update({
                where:{id:amb.id},
                data:
                {
                    lat: amb.lat+randomDelta(),
                    lng: amb.lng+randomDelta()
                },

            })
        }
        console.log(`Moved Ambulance by ${(await ambulance).length} `)
    }
    catch(err){
        console.log(err);
    }
}