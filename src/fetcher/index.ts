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
  source: string;
}

interface FeedSource {
  name: string;
  url: string;
  parseItem: (item: any) => RawJob;
  // Pre-filter: only keep jobs matching at least one keyword
  keywords?: string[];
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
      company: item.creator || item["dc:creator"] || "",
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
      company: item.creator || item["dc:creator"] || "",
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
      company: item.creator || "",
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
      company: item.creator || "",
      source: "himalayas",
    }),
    keywords: ["react", "typescript", "node", "python", "fullstack", "full-stack", "backend", "frontend", "api", "saas", "contract", "freelance", "sprint", "rust", "next.js"],
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
