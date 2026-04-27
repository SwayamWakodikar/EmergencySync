import pool from '../config/db.js';
import { assignment } from "./assignment.controller.js";
import log from '../utils/logger.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const AI_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free';

const LAT_MIN = 18.45
const LAT_MAX = 18.65
const LNG_MIN = 73.75
const LNG_MAX = 73.95

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

const VALID_TYPES = ["MEDICAL", "FIRE", "POLICE"];

// Call OpenRouter AI to extract severity and summary
async function analyzeEmergency(description) {
  if (!description || !description.trim()) {
    return { is_valid: false, rejection_message: "Please describe your emergency so we can send the right help." };
  }
  try {
    const systemPrompt = `You are an expert AI triage agent for Pune city emergency dispatch. You also have a witty personality.

FIRST: Determine if the message is a REAL emergency or not.
- If the message is a greeting, joke, prank, gibberish, test message, random words, food orders, or anything that is NOT an actual emergency — set "is_valid" to false.
- For "rejection_message": Be FUNNY and WITTY. Roast the user lightly in a humorous way, then remind them this line is for real emergencies. Keep it to 1-2 short sentences. Be creative and different each time.
- Also include an "emoji" field: a SINGLE emoji that fits the prank situation. Examples: greeting → "👋", food → "🍕", boredom → "😴", gibberish → "🤡", flirting → "💀", test → "🧪", joke → "😂", random → "🤨", insult → "🙄". Be creative!
- Only set "is_valid" to true for genuine emergencies (fire, injury, crime, accident, medical issue, etc.)

If is_valid is TRUE, extract:
1. "severity": integer 1-5.
2. "type": ONE of: "MEDICAL", "FIRE", "POLICE".
3. "types_needed": Array of all vehicle types needed. Each: "MEDICAL", "FIRE", or "POLICE".
4. "summary": Concise 3-8 word summary.
5. "action_plan": Brief immediate instructions.

Return ONLY valid JSON. INVALID: {"is_valid": false, "rejection_message": "STRING", "emoji": "SINGLE_EMOJI"}
VALID: {"is_valid": true, "severity": INT, "type": "STRING", "types_needed": ["STRING"], "summary": "STRING", "action_plan": "STRING"}
No markdown, no backticks!`;

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Description: "${description}"` }
      ],
      temperature: 0.3,
    });
    
    let text = response.choices[0].message.content.trim();
    if (text.startsWith('```json')) {
       text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    }
    
    const data = JSON.parse(text);

    // Check if AI flagged this as invalid/prank
    if (data.is_valid === false) {
      log(`🚫 AI rejected input as non-emergency: "${description}"`);
      return {
        is_valid: false,
        rejection_message: data.rejection_message || "That doesn't seem like an emergency. Please describe what's happening so we can help.",
        emoji: data.emoji || "🤨"
      };
    }

    const severity = parseInt(data.severity, 10) || Math.floor(Math.random() * 5) + 1;
    const finalSummary = (data.summary || description);
    
    // Ensure strict primary type
    let finalType = data.type?.toUpperCase() || "MEDICAL";
    if (!VALID_TYPES.includes(finalType)) {
        if (["CRIME", "ROBBERY", "VIOLENCE", "ACCIDENT"].includes(finalType)) finalType = "POLICE";
        else finalType = "MEDICAL";
    }

    // Parse and validate types_needed array
    let typesNeeded = [];
    if (Array.isArray(data.types_needed)) {
      typesNeeded = [...new Set(data.types_needed.map(t => t?.toUpperCase()).filter(t => VALID_TYPES.includes(t)))];
    }
    // Ensure primary type is always included
    if (typesNeeded.length === 0) typesNeeded = [finalType];
    if (!typesNeeded.includes(finalType)) typesNeeded.unshift(finalType);

    log(`🧠 AI analyzed: Severity ${severity}, Type: ${finalType}, Dispatch: [${typesNeeded.join(', ')}], Summary: "${finalSummary}"`);
    return { 
        is_valid: true,
        severity: Math.min(Math.max(severity, 1), 5), 
        summary: finalSummary, 
        type: finalType,
        types_needed: typesNeeded,
        action_plan: `✨ AI Assessed: ${data.action_plan || "Dispatching appropriate unit."}`
    };
  } catch (err) {
    log(`⚠️  AI API unavailable or failed, using fallback. Reason: ${err.message}`, "WARN");
    return { is_valid: true, severity: Math.floor(Math.random() * 5) + 1, summary: description, type: "MEDICAL", types_needed: ["MEDICAL"], action_plan: "⚠️ SYSTEM FALLBACK: AI service unavailable. Standard dispatch initiated." };
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
        return res.status(400).json({ error: "Out of service area. We currently only dispatch within Pune." });
      }
    } else {
      lat = randomBetween(LAT_MIN, LAT_MAX);
      lng = randomBetween(LNG_MIN, LNG_MAX);
    }

    const analysis = await analyzeEmergency(description);

    // Reject non-emergencies — no DB insert, no dispatch
    if (!analysis.is_valid) {
      log(`🚫 Rejected non-emergency report: "${description}"`);
      return res.status(400).json({ 
        error: analysis.rejection_message,
        emoji: analysis.emoji || '🤨',
        is_prank: true
      });
    }

    const { severity, summary, type, types_needed, action_plan } = analysis;

    const { rows } = await pool.query(
      `INSERT INTO emergencies (latitude, longitude, severity, description, type, types_needed, action_plan, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
      [lat, lng, severity, summary, type, JSON.stringify(types_needed), action_plan, 'WAITING']
    );
    const emergencyId = rows[0].id;

    // Multi-dispatch: assign one vehicle of each required type
    await assignment(emergencyId, types_needed);

    log(`Emergency Created — ID: ${emergencyId}, Severity: ${severity}, Type: ${type}, Dispatch: [${types_needed.join(', ')}], Desc: ${summary}`);
    res.status(201).json({ success: true, id: emergencyId, severity, description: summary, type, types_needed, action_plan });
  } catch (err) {
    log(`Failed to create emergency: ${err.message}`, "ERROR");
    res.status(500).json({ error: 'Failed to create emergency' });
  }
}