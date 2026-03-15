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
const app = express();
const port = process.env.PORT||5000;
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
  res.send("Server is running successfully");
});

// GET all ambulances
app.get("/ambulances", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, latitude, longitude, status FROM ambulances ORDER BY id"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch ambulances" });
  }
});

// GET all emergencies
app.get("/emergencies", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, latitude, longitude, status, severity FROM emergencies ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});
//posting emergency
app.post('/emergency',emergencyGenerator)
//dynamically updating data
setInterval(moveAmbulance,1000);
app.listen(port, () => {
  console.log(`Server Running at port ${port}`);
});
