import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
dotenv.config();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())
const app = express();
const port = process.env.PORT;
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("Server is running successfully");
});

app.listen(port, () => {
  console.log(`Server Running at port ${port}`);
});
