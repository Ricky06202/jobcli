import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "jobcli/1.0" },
});

export interface RawJob {
  title: string;
  url: string;
  description: string;
  company?: string;
  location?: string;
  source: string;
}

interface FeedSource {
  name: string;
  url: string;
  parseItem: (item: any) => RawJob;
  // Pre-filter: only keep jobs matching at least one keyword
  keywords?: string[];
}

// Extrae la empresa del job. Primero el campo directo del feed; si viene vacío,
// la saca del título con el patrón "Empresa: Puesto" (formato de We Work Remotely).
function extractCompany(item: any, title: string): string {
  const direct = item.creator || item.author || item["dc:creator"] || "";
  if (direct && direct.trim() !== "Company Name") return direct.trim();

  const match = title.match(/^(.+?):\s+/);
  if (match) return match[1].trim();

  return "";
}

// Extrae la ubicación/sede del job.
// Patrones soportados:
//   "Headquarters: Remote - US"  (We Work Remotely)
//   "...in Portugal"             (Landing.jobs)
//   "Remote (Anywhere)" / "100% Remote"
//   "US, EU, LATAM" / "Remote: Americas"
function extractLocation(description: string): string {
  if (!description) return "";

  // 1. Headquarters: ... (primera línea). Solo espacios/tabs después del ":".
  //    Si la línea está vacía, devolvemos "" (no seguimos con otros patrones).
  const hq = description.match(/Headquarters:[ \t]*([^\n]+)/i);
  if (hq) {
    const v = hq[1].trim();
    if (v && v !== "") return v;
    return "";
  }

  // 2. "in <Country>" / "based in <Place>" — solo para feeds sin Headquarters
  //    (Landing.jobs: "At We are META (Permanent), in Portugal")
  const inMatch = description.match(/\b(?:in|based in)\s+([A-Z][a-z]{2,20}(?:\s[A-Z][a-z]{2,20}){0,2})(?:,|\.|\n|$)/);
  if (inMatch) return inMatch[1].trim();

  // 3. Remoto puro
  if (/remote \(anywhere\)|100%? remote|fully remote|remote-first/i.test(description)) {
    return "Remote (Anywhere)";
  }
  if (/remote:?\s*(americas|latam|us|europe|european|worldwide|global)/i.test(description)) {
    return "Remote";
  }

  // 4. Foco geográfico tipo "Remote: US / EU"
  const zones = description.match(/Remote\s*(?:to|for|in)?:?\s*([A-Za-z\s,/]+)(?:\n|\.|$)/i);
  if (zones) {
    const v = zones[1].trim();
    if (v.length < 40) return `Remote (${v})`;
  }

  return "";
}

const FEEDS: FeedSource[] = [
  // ─── Remote-first job boards ───
  {
    name: "weworkremotely",
    url: "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    parseItem: (item) => ({
      title: item.title || "",
      url: item.link || "",
      description: item.contentSnippet || item.content || "",
      company: extractCompany(item, item.title || ""),
      location: extractLocation(item.contentSnippet || item.content || ""),
      source: "weworkremotely",
    }),
    keywords: ["react", "typescript", "bun", "python", "rust", "hono", "next.js", "tauri", "drizzle", "fullstack", "full-stack", "saas", "contract", "freelance", "sprint", "mobile", "expo", "godot", "scraping", "automation"],
  },
  {
    name: "weworkremotely-contract",
    url: "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
    parseItem: (item) => ({
      title: item.title || "",
      url: item.link || "",
      description: item.contentSnippet || item.content || "",
      company: extractCompany(item, item.title || ""),
      location: extractLocation(item.contentSnippet || item.content || ""),
      source: "weworkremotely",
    }),
    keywords: ["react", "typescript", "bun", "python", "rust", "hono", "next.js", "tauri", "drizzle", "fullstack", "full-stack", "saas", "contract", "freelance", "sprint", "mobile", "expo", "godot", "scraping", "automation"],
  },
  {
    name: "remotive",
    url: "https://remotive.com/remote-jobs/feed",
    parseItem: (item) => ({
      title: item.title || "",
      url: item.link || "",
      description: item.contentSnippet || item.content || "",
      company: extractCompany(item, item.title || ""),
      location: extractLocation(item.contentSnippet || item.content || ""),
      source: "remotive",
    }),
    keywords: ["react", "typescript", "node", "python", "fullstack", "full-stack", "backend", "frontend", "api", "saas", "contract", "freelance", "sprint", "rust", "next.js"],
  },
  {
    name: "himalayas",
    url: "https://himalayas.app/jobs/rss",
    parseItem: (item) => ({
      title: item.title || "",
      url: item.link || "",
      description: item.contentSnippet || item.content || "",
      company: extractCompany(item, item.title || ""),
      location: extractLocation(item.contentSnippet || item.content || ""),
      source: "himalayas",
    }),
    keywords: ["react", "typescript", "node", "python", "fullstack", "full-stack", "backend", "frontend", "api", "saas", "contract", "freelance", "sprint", "rust", "next.js"],
  },
  {
    name: "landingjobs",
    url: "https://landing.jobs/feed",
    parseItem: (item) => ({
      title: item.title || "",
      url: item.link || "",
      description: item.contentSnippet || item.content || item.summary || "",
      company: extractCompany(item, item.title || ""),
      location: extractLocation(item.contentSnippet || item.content || item.summary || ""),
      source: "landingjobs",
    }),
    keywords: ["react", "typescript", "bun", "python", "rust", "hono", "next.js", "tauri", "drizzle", "fullstack", "full-stack", "saas", "contract", "freelance", "sprint", "mobile", "expo", "node", "api", "backend", "frontend", "ios", "android", "devops", "kubernetes", "docker"],
  },
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export async function fetchFromSource(sourceName?: string): Promise<RawJob[]> {
  const sources = sourceName
    ? FEEDS.filter((f) => f.name === sourceName)
    : FEEDS;

  const allJobs: RawJob[] = [];
  let totalPreFiltered = 0;

  for (const source of sources) {
    try {
      console.log(`  ⟳ Fetching ${source.name}...`);
      const feed = await parser.parseURL(source.url);
      let jobs = feed.items.map(source.parseItem).filter((j) => j.url && j.title);

      // Pre-filter by keywords if defined
      if (source.keywords && source.keywords.length > 0) {
        const before = jobs.length;
        jobs = jobs.filter((j) => matchesKeywords(`${j.title} ${j.description}`, source.keywords!));
        const filtered = before - jobs.length;
        if (filtered > 0) totalPreFiltered += filtered;
      }

      allJobs.push(...jobs);
      console.log(`  ${jobs.length} jobs from ${source.name}`);
    } catch (err: any) {
      console.error(`  ✗ Failed ${source.name}: ${err.message}`);
    }
  }

  if (totalPreFiltered > 0) {
    console.log(`  ${totalPreFiltered} pre-filtered by keywords`);
  }

  return allJobs;
}

export function getSourceNames(): string[] {
  return FEEDS.map((f) => f.name);
}
