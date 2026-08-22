import { db } from "../db";
import { jobs } from "../db/schema";
import { eq } from "drizzle-orm";
import { fetchFromSource, getSourceNames, type RawJob } from "../fetcher";
import { createFilter, isBlacklisted, scoreJob } from "../filter";
import chalk from "chalk";

function extractBudget(text: string): { budget: number | null; type: string | null } {
  // Match patterns: $1,000 | $500-1000 | $50/hr | $30-60/hour
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

function extractTechStack(text: string): string {
  const known = [
    "react", "next.js", "nextjs", "typescript", "javascript", "node.js", "nodejs",
    "vue", "nuxt", "svelte", "sveltekit", "angular", "astro",
    "python", "django", "fastapi", "flask",
    "rust", "go", "golang", "ruby", "rails",
    "postgres", "postgresql", "mysql", "sqlite", "mongodb", "redis",
    "tailwind", "css", "html", "graphql", "rest", "api",
    "react native", "expo", "flutter", "swift", "kotlin",
    "docker", "kubernetes", "aws", "gcp", "azure", "vercel", "netlify",
    "drizzle", "prisma", "typeorm",
    "tauri", "electron",
  ];
  const lower = text.toLowerCase();
  return known.filter((t) => lower.includes(t)).join(", ");
}

export async function fetchJobs(source?: string) {
  const config = createFilter();
  const rawJobs = await fetchFromSource(source);

  console.log(`\n  Processing ${rawJobs.length} jobs...`);

  let added = 0;
  let blacklisted = 0;
  let duplicates = 0;

  for (const raw of rawJobs) {
    // Check if already exists
    const existing = await db.select().from(jobs).where(eq(jobs.url, raw.url)).limit(1);
    if (existing.length > 0) {
      duplicates++;
      continue;
    }

    // Blacklist check
    if (isBlacklisted(raw.title, raw.description, config)) {
      blacklisted++;
      continue;
    }

    // Extract metadata
    const { budget, type } = extractBudget(`${raw.title} ${raw.description}`);
    const techStack = extractTechStack(`${raw.title} ${raw.description}`);
    const score = scoreJob(
      { title: raw.title, description: raw.description, budget, techStack },
      config
    );

    // Insert
    await db.insert(jobs).values({
      title: raw.title,
      company: raw.company || null,
      url: raw.url,
      description: raw.description,
      budget,
      budgetType: type,
      techStack: techStack || null,
      source: raw.source,
      score,
      status: "new",
      fetchedAt: new Date(),
    });
    added++;
  }

  console.log(`\n  ${chalk.green("✓")} ${added} new jobs added`);
  console.log(`  ${chalk.dim("•")} ${blacklisted} blacklisted`);
  console.log(`  ${chalk.dim("•")} ${duplicates} duplicates skipped`);
  console.log();
}
