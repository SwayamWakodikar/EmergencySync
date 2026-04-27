import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import 'dotenv/config'
dotenv.config();
// import prisma from "./prisma.js"
import './config/db.js';
import pool from './config/db.js';
import { emergencyGenerator } from "./controller/emergency.controller.js";
import { moveAmbulance } from "./controller/movement.controller.js";
import path from "path";
import log from "./utils/logger.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  log(`${req.method} ${req.url}`);
  next();
});


app.get("/", (req, res) => {
  res.send("Server is running successfully");
});

// GET all ambulances
app.get("/ambulances", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, latitude, longitude, status, type FROM ambulances ORDER BY id"
    );
    res.json(rows);
  } catch (err) {
    log(`Failed to fetch ambulances: ${err.message}`, "ERROR");
    res.status(500).json({ error: "Failed to fetch ambulances" });
  }
});

// GET all emergencies
app.get("/emergencies", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, latitude, longitude, status, severity, description, type, types_needed, action_plan FROM emergencies ORDER BY created_at DESC"
    );
    // Parse types_needed from JSON string to array
    const parsed = rows.map(r => ({
      ...r,
      types_needed: (() => { try { return JSON.parse(r.types_needed || '[]'); } catch { return [r.type || 'MEDICAL']; } })()
    }));
    res.json(parsed);
  } catch (err) {
    log(`Failed to fetch emergencies: ${err.message}`, "ERROR");
    res.status(500).json({ error: "Failed to fetch emergencies" });
  }
});

// GET all assignments
app.get("/assignments", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, ambulance_id, emergency_id, assigned_at FROM assignments ORDER BY assigned_at DESC"
    );
    res.json(rows);
  } catch (err) {
    log(`Failed to fetch assignments: ${err.message}`, "ERROR");
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});
//posting emergency
app.post('/emergency', emergencyGenerator);

// GET /route?fromLng=&fromLat=&toLng=&toLat=
// Backend proxy to OSRM — avoids CORS issues in the browser
app.get('/route', async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  if (!fromLat || !fromLng || !toLat || !toLng) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: 'OSRM request failed' });
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      // Return [lat, lng] pairs (Leaflet format)
      const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      return res.json({ coords });
    }
    return res.status(404).json({ error: 'No route found' });
  } catch (err) {
    log(`Route proxy error: ${err.message}`, "ERROR");
    return res.status(500).json({ error: 'Route proxy failed' });
  }
});

// ── Startup: full DB state normalization
async function resetStuckAmbulances() {
  try {
    // 1. BUSY → FREE  (legacy status from old dispatch.services bug)
    const { rowCount: busyFixed } = await pool.query(
      `UPDATE ambulances SET status = 'FREE' WHERE status = 'BUSY'`
    );

    // 2. ASSIGNED ambulances whose linked emergency is no longer ASSIGNED
    //    (e.g. server crashed mid-assignment, or old BUSY bug)
    const { rowCount: ambFixed } = await pool.query(`
      UPDATE ambulances SET status = 'FREE'
      WHERE status = 'ASSIGNED'
        AND id NOT IN (
          SELECT DISTINCT asn.ambulance_id
          FROM assignments asn
          JOIN emergencies e ON asn.emergency_id = e.id
          WHERE e.status = 'ASSIGNED'
        )
    `);

    // 3. ASSIGNED emergencies with no ASSIGNED ambulance responding
    //    (their ambulance died/was reset — put them back in the queue)
    const { rowCount: emFixed } = await pool.query(`
      UPDATE emergencies SET status = 'WAITING'
      WHERE status = 'ASSIGNED'
        AND id NOT IN (
          SELECT DISTINCT asn.emergency_id
          FROM assignments asn
          JOIN ambulances a ON asn.ambulance_id = a.id
          WHERE a.status = 'ASSIGNED'
        )
    `);

    const total = busyFixed + ambFixed + emFixed;
    if (total > 0) {
      log(`Startup cleanup: freed ${busyFixed} BUSY, ${ambFixed} orphan ambulances, re-queued ${emFixed} orphan emergencies`);
    } else {
      log('Startup cleanup: DB state is clean');
    }
  } catch (err) {
    log(`Startup cleanup error: ${err.message}`, "ERROR");
  }
}

app.listen(port, "0.0.0.0", async () => {
  log(`Server Running at port ${port}`);
  await resetStuckAmbulances(); // clear any DB leftovers before movement starts
  setInterval(moveAmbulance, 1000); // start movement loop only after cleanup
});
