import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "..", "..", "logs");
const LOG_DATA_PATH = path.join(LOG_DIR, "server.log");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logStream = fs.createWriteStream(LOG_DATA_PATH, { flags: 'a' });

const log = (message, level = "INFO") => {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
  process.stdout.write(formattedMessage);
  logStream.write(formattedMessage);
};

export default log;
