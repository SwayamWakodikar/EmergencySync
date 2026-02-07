import prisma from "../prisma"
//for testing 
const LAT_MIN = 18.45
const LAT_MAX = 18.65
const LNG_MIN = 73.75
const LNG_MAX = 73.95

function randomBetween(min,max){
    return Math.random()*(max-min)+min;
}

export async function emergencyGenerator(req,res) {
    try{
        const severity=Math.floor(Math.random()*5)+1

        const emergency=await prisma.emergencyu.create({
            data:{
                lat: randomBetween(LAT_MIN,LAT_MAX),
                lng: randomBetween(LNG_MIN,LNG_MAX),
                severity,
                status:'WAITING'
            }
        })
        console.log("Emergency Created ",emergency.id)
        res.status(201);
    }
    catch(err){
        console.log(err);
    }
}
