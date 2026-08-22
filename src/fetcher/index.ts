import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
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
}

const FEEDS: FeedSource[] = [
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
  },
  {
    name: "remoteok",
    url: "https://remoteok.com/remote-dev-jobs.rss",
    parseItem: (item) => ({
      title: item.title || "",
      url: item.link || "",
      description: item.contentSnippet || item.content || "",
      company: item.creator || "",
      source: "remoteok",
    }),
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
  },
];

export async function fetchFromSource(sourceName?: string): Promise<RawJob[]> {
  const sources = sourceName
    ? FEEDS.filter((f) => f.name === sourceName)
    : FEEDS;

  const allJobs: RawJob[] = [];

  for (const source of sources) {
    try {
      console.log(`  ⟳ Fetching ${source.name}...`);
      const feed = await parser.parseURL(source.url);
      const jobs = feed.items.map(source.parseItem).filter((j) => j.url && j.title);
      allJobs.push(...jobs);
      console.log(`  ${jobs.length} jobs from ${source.name}`);
    } catch (err: any) {
      console.error(`  ✗ Failed ${source.name}: ${err.message}`);
    }
  }

  return allJobs;
}

export function getSourceNames(): string[] {
  return FEEDS.map((f) => f.name);
}
