// import prisma from "../prisma.js"
import pool from '../config/db.js';
import { assignment } from "./assignment.controller.js"

const LAT_MIN = 18.45
const LAT_MAX = 18.65
const LNG_MIN = 73.75
const LNG_MAX = 73.95

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

// Call the Python ML service to predict severity from description text.
// If the ML service is down, falls back to random severity so the app never breaks.
async function predictSeverity(description) {
  if (!description || !description.trim()) {
    return Math.floor(Math.random() * 5) + 1;
  }
  try {
    const response = await fetch(`${ML_SERVICE_URL}/predict-severity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    if (!response.ok) throw new Error(`ML service responded with ${response.status}`);
    const data = await response.json();
    console.log(`🧠 ML predicted severity ${data.predicted_severity} for: "${description.slice(0, 50)}..."`);
    return data.predicted_severity;
  } catch (err) {
    console.warn(`⚠️  ML service unavailable, using random severity. Reason: ${err.message}`);
    return Math.floor(Math.random() * 5) + 1;
  }
}

export async function emergencyGenerator(req, res) {
  try {
    const { latitude, longitude, description } = req.body || {};
    let lat, lng;

    if (latitude !== undefined && longitude !== undefined) {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);

      // Simple bounding box check for Pune region
      if (lat < 18.3 || lat > 18.8 || lng < 73.6 || lng > 74.1) {
        return res.status(400).json({ error: "Out of service area. We currently only dispatch ambulances within Pune." });
      }
    } else {
      lat = randomBetween(LAT_MIN, LAT_MAX);
      lng = randomBetween(LNG_MIN, LNG_MAX);
    }

    // 🧠 Use ML to predict severity from the description (falls back to random if ML is down)
    const severity = await predictSeverity(description);

    const { rows } = await pool.query(
      `INSERT INTO emergencies (latitude, longitude, severity, status, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [lat, lng, severity, 'WAITING']
    );
    const emergencyId = rows[0].id;

    await assignment(emergencyId);

    console.log(`Emergency Created — ID: ${emergencyId}, Severity: ${severity}`);
    res.status(201).json({ success: true, id: emergencyId, severity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create emergency' });
  }
}