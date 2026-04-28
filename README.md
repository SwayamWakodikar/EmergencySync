# EmergencySync

**EmergencySync** is a full-stack real-time emergency dispatch platform for Pune city. It uses **Google Gemini AI** to automatically triage incoming emergency reports — classifying them by type, severity, and generating actionable response plans — then dispatches the nearest appropriate unit across a live map.

---

## ✨ Features

### AI-Powered Triage (Gemini API)
- Natural language emergency reports are analyzed by **Google Gemini** in real time
- Automatically extracts: **severity** (1–5), **type** (MEDICAL / FIRE / POLICE), a concise **summary**, and an **AI action plan** for the responding unit
- Graceful fallback if the API is unavailable

### Multi-Agency Dispatch
- Supports three responder types: **Ambulance** (medical), **Police**, and **Fire** units
- Smart assignment logic — a fire incident only dispatches a Fire unit, a crime dispatches Police, etc.
- Nearest available unit is selected via Euclidean distance calculation

### Live Map Dashboard
- Interactive **Leaflet.js** map showing all units and incidents in real time
- Distinct icons and colors per unit type (teal = medical, blue = police, red = fire)
- Animated dispatch **route polylines** (powered by OSRM routing, proxied through the backend)
- Polls every 2.5 seconds — no page refresh needed

### Incident Queue Feed
- Live incident list grouped by status: **Waiting → Assigned → Resolved**
- Each card shows: type, severity bar, AI-generated action plan, and description
- Status badges with color coding (red / amber / green)

### KPI Header
- Real-time counts for: Free Medics, Free Police, Free Fire units, Active Incidents, Resolved

---

## 🏗️ Architecture

```
EmergencySync/
├── client/                  # React + TypeScript + Vite frontend
│   └── src/
│       ├── pages/           # Dashboard (main page)
│       ├── components/      # MapView, EmergencyList, Sidebar, Markers
│       └── services/        # API client (axios)
│
├── server/                  # Node.js + Express backend
│   └── src/
│       ├── controller/      # emergency, assignment, movement controllers
│       ├── services/        # dispatch service
│       ├── config/          # PostgreSQL pool + DB init
│       └── utils/           # logger
│
└── docker-compose.yml       # Spins up PostgreSQL
```

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Leaflet.js |
| Backend | Node.js, Express |
| Database | PostgreSQL (raw SQL via `pg` pool) |
| AI | Google Gemini API (`@google/genai`) |
| Routing | OSRM (OpenStreetMap) via backend proxy |
| Containerization | Docker & Docker Compose |

> **Note:** Prisma ORM has been removed. The project now uses direct `pg` pool queries with auto-migration on startup.

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)
- A **Google Gemini API key** — get one free at [aistudio.google.com](https://aistudio.google.com)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/SwayamWakodikar/EmergencySync.git
cd EmergencySync

# 2. Install server dependencies
cd server && npm install

# 3. Install client dependencies
cd ../client && npm install
```

### Environment Variables

Create `server/.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/emergencysync
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
```

### Running the App

**Step 1 — Start the database:**
```bash
# From project root
docker-compose up -d
```

**Step 2 — Start the backend:**
```bash
cd server
npm run dev
```
The server auto-creates and migrates all database tables on startup. No manual migration needed.

**Step 3 — Start the frontend:**
```bash
cd client
npm run dev
```

Open **http://localhost:5173** — the dashboard is live.

---

## 🗄️ Database Schema

| Table | Key Columns |
|-------|-------------|
| `ambulances` | `id`, `latitude`, `longitude`, `status` (FREE/ASSIGNED), `type` (AMBULANCE/POLICE/FIRE) |
| `emergencies` | `id`, `latitude`, `longitude`, `severity`, `description`, `type`, `action_plan`, `status`, `created_at` |
| `assignments` | `id`, `ambulance_id`, `emergency_id`, `assigned_at` |

Schema is **auto-migrated** on every server start via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

---

## 🤖 How AI Triage Works

1. User submits a text description (e.g. *"Person collapsed at FC Road, not breathing"*)
2. Backend sends the description to **Gemini** with a structured prompt
3. Gemini returns a JSON object:
   ```json
   {
     "severity": 5,
     "type": "MEDICAL",
     "summary": "Cardiac arrest at FC Road",
     "action_plan": "Dispatch ALS unit immediately. Begin CPR instructions over phone."
   }
   ```
4. The incident is stored with all fields and the nearest matching unit is dispatched
5. The frontend displays everything live on the map and incident queue

---

## 📜 License

See the `LICENSE` file for details.
