import pool from '../config/db.js';
import { assignment } from "./assignment.controller.js";
import log from '../utils/logger.js';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "AIzaSyAGaCUcXUHcu1jw7O0T2rt8X3eM5g2CvJ4" });

const LAT_MIN = 18.45
const LAT_MAX = 18.65
const LNG_MIN = 73.75
const LNG_MAX = 73.95

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

// Call Gemini API to extract severity and summary
async function analyzeEmergency(description) {
  if (!description || !description.trim()) {
    return { severity: Math.floor(Math.random() * 5) + 1, summary: "", type: "MEDICAL", action_plan: "" };
  }
  try {
    const prompt = `You are an expert AI triage agent for Pune city emergency dispatch.
Analyze the following emergency description and extract:
1. "severity": an integer from 1 to 5.
2. "type": Must be EXACTLY ONE of: "MEDICAL", "FIRE", "POLICE". Choose the best primary response needed.
3. "summary": A concise, clear 3-8 word summary.
4. "action_plan": A brief sentence or two outlining immediate instructions for the dispatched unit.

Return ONLY a valid JSON object strictly matching this structure: {"severity": INT, "type": "STRING", "summary": "STRING", "action_plan": "STRING"}. Do not add any markdown, comments, or backticks!

Description: "${description}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    let text = response.text.trim();
    if (text.startsWith('```json')) {
       text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    }
    
    const data = JSON.parse(text);
    const severity = parseInt(data.severity, 10) || Math.floor(Math.random() * 5) + 1;
    const finalSummary = (data.summary || description);
    
    // Ensure strict typing
    const validTypes = ["MEDICAL", "FIRE", "POLICE"];
    let finalType = data.type?.toUpperCase() || "MEDICAL";
    if (!validTypes.includes(finalType)) {
        if (["CRIME", "ROBBERY", "VIOLENCE", "ACCIDENT"].includes(finalType)) finalType = "POLICE";
        else finalType = "MEDICAL";
    }

    log(`🧠 Gemini AI analyzed: Severity ${severity}, Type: ${finalType}, Summary: "${finalSummary}"`);
    return { 
        severity: Math.min(Math.max(severity, 1), 5), 
        summary: finalSummary, 
        type: finalType,
        action_plan: data.action_plan || ""
    };
  } catch (err) {
    log(`⚠️  Gemini API unavailable or failed, using fallback. Reason: ${err.message}`, "WARN");
    return { severity: Math.floor(Math.random() * 5) + 1, summary: description, type: "MEDICAL", action_plan: "" };
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

    const { severity, summary, type, action_plan } = await analyzeEmergency(description);

    const { rows } = await pool.query(
      `INSERT INTO emergencies (latitude, longitude, severity, description, type, action_plan, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
      [lat, lng, severity, summary, type, action_plan, 'WAITING']
    );
    const emergencyId = rows[0].id;

    await assignment(emergencyId);

    log(`Emergency Created — ID: ${emergencyId}, Severity: ${severity}, Type: ${type}, Desc: ${summary}`);
    res.status(201).json({ success: true, id: emergencyId, severity, description: summary, type, action_plan });
  } catch (err) {
    log(`Failed to create emergency: ${err.message}`, "ERROR");
    res.status(500).json({ error: 'Failed to create emergency' });
  }
}