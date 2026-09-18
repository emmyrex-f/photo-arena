/**
 * The verify scripts sign webhooks with the API's own BACHS_WEBHOOK_SECRET, so they have to read
 * backend/.env the same way Nest does. Importing this first makes that explicit: without it a
 * script only sees .env when something else (e.g. @prisma/client) happens to load it, and otherwise
 * falls back to a placeholder secret — every correctly signed webhook then comes back 401.
 *
 * Variables already present in the real environment win, so `API_BASE=… npm run …` still overrides.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
