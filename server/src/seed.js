import 'dotenv/config'
import prisma from './prisma.js'

const LAT_MIN = 18.45
const LAT_MAX = 18.65
const LNG_MIN = 73.75
const LNG_MAX = 73.95

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

async function seedAmbulances() {
  await prisma.ambulance.deleteMany()
  const n = 10
  for (let i = 0; i < n; i++) {
    await prisma.ambulance.create({
      data: {
        lat: randomBetween(LAT_MIN, LAT_MAX),
        lng: randomBetween(LNG_MIN, LNG_MAX),
        status: 'FREE',
      },
    })
  }
  console.log(`added ${n} Ambulances correctly`)
}

seedAmbulances()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })