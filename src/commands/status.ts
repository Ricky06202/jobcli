import { db } from "../db";
import { jobs } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import chalk from "chalk";

export async function updateJobStatus(id: number, status: string) {
  const valid = ["new", "saved", "discarded", "applied"];
  if (!valid.includes(status)) {
    console.log(chalk.red(`  Invalid status. Use: ${valid.join(", ")}`));
    return;
  }

  const result = await db.update(jobs).set({ status }).where(eq(jobs.id, id));
  console.log(`  Job #${id} → ${chalk.bold(status)}`);
}

export async function discardJobs(ids: number[]) {
  for (const id of ids) {
    await updateJobStatus(id, "discarded");
  }
  console.log(chalk.dim(`  ${ids.length} jobs discarded`));
}

export async function saveJobs(ids: number[]) {
  for (const id of ids) {
    await updateJobStatus(id, "saved");
  }
  console.log(chalk.dim(`  ${ids.length} jobs saved`));
}

export async function applyJobs(ids: number[]) {
  for (const id of ids) {
    await updateJobStatus(id, "applied");
  }
  console.log(chalk.dim(`  ${ids.length} jobs marked as applied`));
}

export async function showStats() {
  const all = await db.select({ status: jobs.status, count: sql<number>`count(*)` }).from(jobs).groupBy(jobs.status);
  console.log("\n  Job Stats:");
  for (const row of all) {
    const color =
      row.status === "new" ? chalk.cyan :
      row.status === "saved" ? chalk.green :
      row.status === "applied" ? chalk.yellow :
      chalk.dim;
    console.log(`    ${color(row.status || "unknown")}: ${row.count}`);
  }
  console.log();
}
