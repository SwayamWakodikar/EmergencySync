import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
});

// Automatically create the required tables if they don't exist
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ambulances (
        id SERIAL PRIMARY KEY,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        status VARCHAR(20) DEFAULT 'FREE',
        type VARCHAR(20) DEFAULT 'AMBULANCE'
      );
      CREATE TABLE IF NOT EXISTS emergencies (
        id SERIAL PRIMARY KEY,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        severity INT,
        description TEXT,
        type VARCHAR(20) DEFAULT 'MEDICAL',
        action_plan TEXT,
        status VARCHAR(20) DEFAULT 'WAITING',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        ambulance_id INT REFERENCES ambulances(id),
        emergency_id INT REFERENCES emergencies(id),
        assigned_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Auto-migrate columns if they are missing
      ALTER TABLE ambulances ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'AMBULANCE';
      ALTER TABLE emergencies ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'MEDICAL';
      ALTER TABLE emergencies ADD COLUMN IF NOT EXISTS action_plan TEXT;
      
      -- Seed diverse responders if they are all default
      UPDATE ambulances SET type = 'POLICE' WHERE id % 3 = 1 AND type = 'AMBULANCE';
      UPDATE ambulances SET type = 'FIRE' WHERE id % 3 = 2 AND type = 'AMBULANCE';
    `);
    console.log('Database tables initialized locally.');
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
  }
}

await initDB();

export default pool;