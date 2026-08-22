export interface FilterConfig {
  minBudget: number;
  blacklist: string[];
  requiredTech: string[];
  preferredTech: string[];
}

const DEFAULT_CONFIG: FilterConfig = {
  minBudget: 300,
  blacklist: [
    "slave", "unpaid", "volunteer", "exposure only",
    "$100", "$150", "$200", "$50", "$0",
    "full-time", "permanent", "salary",
  ],
  requiredTech: [],
  preferredTech: [
    "react", "next.js", "nextjs", "typescript", "node.js", "nodejs",
    "postgres", "postgresql", "drizzle", "sqlite", "tailwind",
    "react native", "expo", "tauri", "svelte", "vue",
  ],
};

export function createFilter(overrides?: Partial<FilterConfig>): FilterConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

export function isBlacklisted(title: string, description: string, config: FilterConfig): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return config.blacklist.some((kw) => text.includes(kw.toLowerCase()));
}

export function isBelowBudget(job: { budget?: number | null }, config: FilterConfig): boolean {
  if (job.budget == null) return false; // don't filter unknowns
  return job.budget < config.minBudget;
}

export function scoreJob(
  job: { title: string; description: string; budget?: number | null; techStack?: string | null },
  config: FilterConfig
): number {
  let score = 0;
  const text = `${job.title} ${job.description}`.toLowerCase();
  const techs = (job.techStack || "").toLowerCase().split(",").map((s) => s.trim());

  // Budget scoring (0-40 points)
  if (job.budget != null) {
    if (job.budget >= 2000) score += 40;
    else if (job.budget >= 1000) score += 30;
    else if (job.budget >= 500) score += 20;
    else if (job.budget >= 300) score += 10;
  }

  // Tech match scoring (0-40 points)
  let matchCount = 0;
  for (const tech of config.preferredTech) {
    if (techs.some((t) => t.includes(tech)) || text.includes(tech)) {
      matchCount++;
    }
  }
  score += Math.min(matchCount * 10, 40);

  // Scope clarity scoring (0-20 points)
  if (job.description.length > 200) score += 5; // detailed description
  if (text.includes("deliverable") || text.includes("milestone") || text.includes("scope")) score += 10;
  if (text.includes("fixed price") || text.includes("fixed-price") || text.includes("sprint")) score += 5;

  return Math.min(score, 100);
}
