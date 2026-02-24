// import prisma from "../prisma.js"
import pool from '../config/db.js';
import { assignment } from "./assignment.controller.js"
const LAT_MIN = 18.45
const LAT_MAX = 18.65
const LNG_MIN = 73.75
const LNG_MAX = 73.95

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

export async function emergencyGenerator(req, res) {
  try {
    const severity = Math.floor(Math.random() * 5) + 1

    /*
    const emergency = await prisma.emergencyu.create({
      data: { lat: randomBetween(LAT_MIN, LAT_MAX), lng: randomBetween(LNG_MIN, LNG_MAX), severity, status: 'WAITING' },
    })
    */
    const { rows } = await pool.query(
      `INSERT INTO emergencies (latitude, longitude, severity, status, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [randomBetween(LAT_MIN, LAT_MAX), randomBetween(LNG_MIN, LNG_MAX), severity, 'WAITING']
    );
    const emergencyId = rows[0].id;

    await assignment(emergencyId),

    console.log("Emergency Created", emergencyId)
  } catch (err) {
    console.error(err) 
  }
}