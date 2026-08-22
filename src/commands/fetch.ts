import { db } from "../db";
import { jobs } from "../db/schema";
import { eq } from "drizzle-orm";
import { fetchFromSource, type RawJob } from "../fetcher";
import { evaluateJob } from "../filter";
import { extractTechStack } from "../filter/techs";
import chalk from "chalk";

function extractBudget(text: string): { budget: number | null; type: string | null } {
  const match = text.match(/\$(\d[\d,]*(?:\.\d{2})?)\s*(?:-?\s*\$?\d[\d,]*)?\s*(?:\/\s*(?:hr|hour|mo|month))?/i);
  if (match) {
    const budget = parseFloat(match[1].replace(/,/g, ""));
    const isHourly = /\/\s*(?:hr|hour)/i.test(text);
    const isMonthly = /\/\s*(?:mo|month)/i.test(text);
    return {
      budget,
      type: isHourly ? "hourly" : isMonthly ? "monthly" : "fixed",
    };
  }
  return { budget: null, type: null };
}

export async function fetchJobs(source?: string) {
  const rawJobs = await fetchFromSource(source);

  console.log(`\n  Processing ${rawJobs.length} jobs...`);

  let added = 0;
  let viable = 0;
  let blacklisted = 0;
  let duplicates = 0;

  for (const raw of rawJobs) {
    // Check if already exists
    const existing = await db.select().from(jobs).where(eq(jobs.url, raw.url)).limit(1);
    if (existing.length > 0) {
      duplicates++;
      continue;
    }

    // Extract metadata
    const { budget, type } = extractBudget(`${raw.title} ${raw.description}`);
    const techStack = extractTechStack(`${raw.title} ${raw.description}`);

    // Smart evaluation
    const result = evaluateJob(raw.title, raw.description, budget);

    if (result.status === "discarded") {
      blacklisted++;
      // Still save it but as discarded
      await db.insert(jobs).values({
        title: raw.title,
        company: raw.company || null,
        url: raw.url,
        description: raw.description,
        budget,
        budgetType: type,
        techStack: techStack || null,
        source: raw.source,
        priorityScore: 0,
        reason: result.reason,
        score: 0,
        status: "discarded",
        fetchedAt: new Date(),
      });
      continue;
    }

    // Insert viable job
    await db.insert(jobs).values({
      title: raw.title,
      company: raw.company || null,
      url: raw.url,
      description: raw.description,
      budget,
      budgetType: type,
      techStack: techStack || null,
      source: raw.source,
      priorityScore: result.priorityScore,
      reason: result.reason,
      score: result.priorityScore * 10, // convert 1-10 to 0-100 for compatibility
      status: "new",
      fetchedAt: new Date(),
    });
    added++;
    viable++;
  }

  console.log(`\n  ${chalk.green("✓")} ${chalk.bold(String(viable))} viable jobs added`);
  console.log(`  ${chalk.red("✗")} ${chalk.bold(String(blacklisted))} blacklisted`);
  console.log(`  ${chalk.dim("•")} ${duplicates} duplicates skipped`);
  console.log();
}
