import { db } from "../db";
import { jobs } from "../db/schema";
import { eq, desc, asc, sql, and, like } from "drizzle-orm";
import chalk from "chalk";

export async function listJobs(opts: {
  status?: string;
  minScore?: number;
  minBudget?: number;
  source?: string;
  limit?: number;
  sort?: string;
}) {
  const conditions = [];

  if (opts.status) conditions.push(eq(jobs.status, opts.status));
  if (opts.minScore) conditions.push(sql`${jobs.score} >= ${opts.minScore}`);
  if (opts.minBudget) conditions.push(sql`${jobs.budget} >= ${opts.minBudget}`);
  if (opts.source) conditions.push(eq(jobs.source, opts.source));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderBy =
    opts.sort === "budget" ? desc(jobs.budget) :
    opts.sort === "score" ? desc(jobs.score) :
    desc(jobs.fetchedAt);

  const rows = await db.select().from(jobs).where(where).orderBy(orderBy).limit(opts.limit || 50);

  if (rows.length === 0) {
    console.log(chalk.dim("  No jobs found matching filters."));
    return;
  }

  console.log();
  for (const row of rows) {
    const statusColor =
      row.status === "new" ? chalk.cyan :
      row.status === "saved" ? chalk.green :
      row.status === "applied" ? chalk.yellow :
      chalk.dim;

    const scoreColor =
      (row.score || 0) >= 70 ? chalk.green :
      (row.score || 0) >= 40 ? chalk.yellow :
      chalk.red;

    console.log(`  ${statusColor(`[${row.status}]`)} ${chalk.bold(row.title)}`);
    console.log(`    ${chalk.dim(row.company || "Unknown")} · ${chalk.dim(row.source)} · Score: ${scoreColor(String(row.score || 0))}`);
    if (row.budget) console.log(`    Budget: ${chalk.green("$" + row.budget.toLocaleString())} ${chalk.dim(row.budgetType || "")}`);
    if (row.techStack) console.log(`    Stack:  ${chalk.dim(row.techStack)}`);
    console.log(`    ${chalk.blue(row.url)}`);
    console.log();
  }

  console.log(chalk.dim(`  ${rows.length} jobs shown`));
}
