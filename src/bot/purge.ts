import { Database } from "bun:sqlite";
import { DB_PATH } from "../db";
import chalk from "chalk";

const STALE_DAYS = 30;

// Marca como "stale" los jobs en estado "new" que llevan más de STALE_DAYS
// sin ser tocados. Evita que la DB acumule ofertas viejas como "nuevas".
export async function purgeOldJobs(): Promise<number> {
  const sqlite = new Database(DB_PATH);
  // fetched_at se guarda como epoch (segundos) por drizzle mode:"timestamp"
  const cutoffSec = Math.floor(Date.now() / 1000) - STALE_DAYS * 24 * 60 * 60;

  const result = sqlite
    .prepare(
      `UPDATE jobs SET status = 'stale'
       WHERE status = 'new' AND fetched_at < ?`
    )
    .run(cutoffSec);
  sqlite.close();

  const count = result.changes ?? 0;
  if (count > 0) {
    console.log(chalk.dim(`  🗑️ ${count} jobs marcados como stale (>${STALE_DAYS} días)`));
  }
  return count;
}
