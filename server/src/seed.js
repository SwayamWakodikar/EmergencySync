import 'dotenv/config'
// import prisma from './prisma.js'
import pool from './config/db.js';

const LAT_MIN = 18.45
const LAT_MAX = 18.65
const LNG_MIN = 73.75
const LNG_MAX = 73.95

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

async function seedAmbulances() {
  await pool.query('DELETE FROM assignments');
  await pool.query('DELETE FROM emergencies');
  await pool.query('DELETE FROM ambulances');

  // Balanced fleet: 5 ambulances, 3 fire trucks, 2 police vehicles
  const fleet = [
    'AMBULANCE', 'AMBULANCE', 'AMBULANCE', 'AMBULANCE', 'AMBULANCE',
    'FIRE', 'FIRE', 'FIRE',
    'POLICE', 'POLICE',
  ];

  for (let i = 0; i < fleet.length; i++) {
    await pool.query(
      `INSERT INTO ambulances (latitude, longitude, status, type) VALUES ($1, $2, $3, $4)`,
      [randomBetween(LAT_MIN, LAT_MAX), randomBetween(LNG_MIN, LNG_MAX), 'FREE', fleet[i]]
    );
  }
  console.log(`Seeded ${fleet.length} vehicles: 5 Ambulances, 3 Fire Trucks, 2 Police`)
}

seedAmbulances()
  .catch(console.error)
  .finally(async () => {
    // await prisma.$disconnect()
    await pool.end();
  })