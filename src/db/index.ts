import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { mkdirSync } from "fs";
import { dirname } from "path";

const DB_PATH = process.env.JOBCLI_DB || `${process.env.HOME}/.local/share/jobcli/jobs.db`;

// Ensure directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

// Auto-create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT,
    url TEXT NOT NULL UNIQUE,
    description TEXT,
    budget REAL,
    budget_type TEXT,
    tech_stack TEXT,
    source TEXT NOT NULL,
    client_history TEXT,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'new',
    fetched_at INTEGER NOT NULL
  );
`);

export const db = drizzle(sqlite, { schema });
export { DB_PATH };
