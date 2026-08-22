import { db } from "../db";
import { jobs } from "../db/schema";
import { eq, and, like, or } from "drizzle-orm";
import chalk from "chalk";
import { writeFileSync } from "fs";

export async function exportJobs(opts: {
  format?: string;
  status?: string;
  search?: string;
  output?: string;
  limit?: number;
}) {
  const format = opts.format || "json";
  const conditions = [];

  if (opts.status) conditions.push(eq(jobs.status, opts.status));
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(or(
      like(jobs.title, term),
      like(jobs.description, term),
      like(jobs.techStack, term),
      like(jobs.company, term),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  let query = db.select().from(jobs).where(where);
  if (opts.limit) query = query.limit(opts.limit);
  const rows = await query;

  if (rows.length === 0) {
    console.log(chalk.dim("  No jobs to export."));
    return;
  }

  const filename = opts.output || `jobcli-export.${format}`;

  if (format === "csv") {
    const headers = ["id", "title", "company", "url", "budget", "budget_type", "tech_stack", "source", "priority_score", "reason", "status", "fetched_at"];
    const csvRows = rows.map((r) =>
      headers.map((h) => {
        const val = r[h as keyof typeof r];
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    writeFileSync(filename, csv);
  } else {
    const json = rows.map((r) => ({
      id: r.id,
      title: r.title,
      company: r.company,
      url: r.url,
      budget: r.budget,
      budgetType: r.budgetType,
      techStack: r.techStack,
      source: r.source,
      priorityScore: r.priorityScore,
      reason: r.reason,
      status: r.status,
      fetchedAt: r.fetchedAt,
    }));
    writeFileSync(filename, JSON.stringify(json, null, 2));
  }

  console.log(chalk.green(`  ✓ Exported ${rows.length} jobs to ${filename}`));
}
