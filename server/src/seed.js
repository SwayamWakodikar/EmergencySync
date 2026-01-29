// @ts-nocheck
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())


//setting bounds for a particular city Eg:- Pune
const LAT_MIN = 18.45;
const LAT_MAX = 18.65;
const LNG_MIN = 73.75;
const LNG_MAX = 73.95;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

async function seedAmbulances() {
  await prisma.ambulance.deleteMany();

  //pre-defined Ambulances
  //let there be n ambulances
  const n = 10;
  for (let i = 0; i < n; i++) {
    await prisma.ambulance.create({
      data: {
        lat: randomBetween(LAT_MIN, LAT_MAX),
        lng: randomBetween(LNG_MIN, LNG_MAX),
        status:"FREE"
      },
    });
  }
  console.log(`added ${n} Ambulances correctly`)
}
seedAmbulances()
.catch((err)=>{
    console.error(err)
})
.finally(async()=>{
    await prisma.$disconnect();
});
