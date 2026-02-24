import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import 'dotenv/config'
dotenv.config();
// import prisma from "./prisma.js"
import './config/db.js';
import { emergencyGenerator } from "./controller/emergency.controller.js";
import { moveAmbulance } from "./controller/movement.controller.js";
const app = express();
const port = process.env.PORT;
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
  res.send("Server is running successfully");
});
app.get("/emergency", (req, res) => {
  res.send("Posted");
});
//posting emergency
app.post('/emergency',emergencyGenerator)
//dynamically updating data
setInterval(moveAmbulance,1000);
app.listen(port, () => {
  console.log(`Server Running at port ${port}`);
});
