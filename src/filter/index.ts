export interface FilterResult {
  status: "viable" | "discarded";
  reason: string;
  priorityScore: number; // 1-10
}

// ─── HARD BLACKLIST (instant discard) ───
const BLACKLIST_KEYWORDS: Record<string, string[]> = {
  "Engineering/Construction": [
    "facade", "facade engineer", "window design", "curtain wall",
    "autocad", "civil engineering", "structural engineering",
    "as 2047", "as 1288", "construction", "building envelope",
    "architectural drafting", "mechanical engineer", "electrical engineer",
    "plumbing", "hvac", "civil", "geotechnical",
  ],
  "Non-Software Roles": [
    "accountant", "accounting", "finance", "financial analyst",
    "social media marketing", "content specialist", "content writer",
    "customer support", "customer service", "project manager",
    "business analyst", "sales", "recruiter", "hr manager",
    "graphic designer", "video editor", "copywriter",
    "data entry", "virtual assistant", "translator",
    "product designer", "product manager", "product owner",
    "ux designer", "ui designer", "ux researcher",
    "engineering manager", "delivery manager", "scrum master",
    "devrel", "developer advocate",
  ],
  "Exploitative": [
    "slave", "unpaid", "volunteer", "exposure only",
    "$100", "$150", "$200", "$50", "$0",
  ],
  "Non-Tech": [
    "autocad", "solidworks", "matlab", "labview",
    "sap", "oracle erp", "salesforce admin",
    "medical", "nursing", "pharmaceutical", "biotech",
  ],
};

// ─── WHITELIST (must match 2+) ───
const WHITELIST_TECHS = [
  // ─── Core Languages ───
  "typescript", "javascript", "bun", "python", "rust",

  // ─── Frontend & Web Frameworks ───
  "react", "next.js", "nextjs", "hono", "react native", "expo",

  // ─── Desktop & Cross-Platform ───
  "tauri",

  // ─── Databases & ORMs ───
  "drizzle", "drizzle orm", "postgresql", "postgres", "sqlite",

  // ─── DevOps & Tools ───
  "docker", "linux", "nixos", "fedora", "git", "github",

  // ─── Domains (high priority) ───
  "saas", "full-stack", "fullstack", "api", "rest",
  "mobile app", "web app", "saas platform",
  "automation", "scraping", "godot", "game dev", "game development",
];

// ─── GEOGRAPHIC RESTRICTIONS ───
const GEO_RESTRICTIONS = [
  "philippines only", "india only", "pakistan only", "nigeria only",
  "us citizenship", "us resident", "security clearance",
  "must reside in", "must live in", "on-site only",
  "no remote", "hybrid only",
];

export function evaluateJob(
  title: string,
  description: string,
  budget?: number | null
): FilterResult {
  const text = `${title} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // ─── STEP 1: Hard blacklist check ───
  // Los "Non-Software Roles" se evalúan sobre el TÍTULO (donde está el puesto
  // real); la descripción puede mencionar roles ajenos (ej: "work with product
  // managers") y eso no significa que el puesto sea ese rol.
  for (const [category, keywords] of Object.entries(BLACKLIST_KEYWORDS)) {
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const hitsTitle = titleLower.includes(kwLower);
      const hitsBody = text.includes(kwLower);
      const shouldDiscard =
        category === "Non-Software Roles" ? hitsTitle : hitsBody;

      if (shouldDiscard) {
        return {
          status: "discarded",
          reason: `Blacklisted (${category}): "${kw}"`,
          priorityScore: 0,
        };
      }
    }
  }

  // ─── STEP 2: Geographic restrictions ───
  for (const geo of GEO_RESTRICTIONS) {
    if (text.includes(geo)) {
      return {
        status: "discarded",
        reason: `Geo-restricted: "${geo}"`,
        priorityScore: 0,
      };
    }
  }

  // ─── STEP 3: Whitelist — must match 2+ techs ───
  const matchedTechs: string[] = [];
  for (const tech of WHITELIST_TECHS) {
    if (text.includes(tech.toLowerCase())) {
      matchedTechs.push(tech);
    }
  }

  if (matchedTechs.length < 2) {
    return {
      status: "discarded",
      reason: `Insufficient tech match (${matchedTechs.length}/2): ${matchedTechs.join(", ") || "none"}`,
      priorityScore: 0,
    };
  }

  // ─── STEP 4: Calculate priority score (1-10) ───
  let score = 1;

  // Tech match depth (1-4)
  score += Math.min(matchedTechs.length, 4);

  // Budget alignment (1-3)
  if (budget != null) {
    if (budget >= 2000) score += 3;
    else if (budget >= 1000) score += 2;
    else if (budget >= 500) score += 1;
  }

  // Scope clarity (1-2)
  if (text.includes("fixed price") || text.includes("sprint") || text.includes("milestone")) score += 1;
  if (text.includes("deliverable") || text.includes("scope") || text.includes("requirements")) score += 1;

  return {
    status: "viable",
    reason: `Matched ${matchedTechs.length} techs: ${matchedTechs.join(", ")}`,
    priorityScore: Math.min(score, 10),
  };
}

export function getWhitelistTechs(): string[] {
  return WHITELIST_TECHS;
}
