// ─── Stack completo de Ricky (fuente de verdad única) ───
// Se usa para:
//  1. Whitelist del filtro personal (debe matchear 2+)
//  2. Extraer el stack mostrado en cada job (extractTechStack)
// Orden: más específicos primero (node.js antes que node, next.js antes que next)

export const KNOWN_TECHS: string[] = [
  // ─── JS/TS core ───
  "typescript", "javascript", "ts", "js", "bun", "node.js", "nodejs", "node",

  // ─── Backend JS/TS ───
  "hono", "express",

  // ─── Frontend ───
  "next.js", "nextjs", "react", "astro", "svelte", "tailwind", "html", "css",

  // ─── Python ───
  "python", "fastapi", "django",

  // ─── Go ───
  "golang", "go",

  // ─── Java ───
  "java",

  // ─── C# ───
  "c#", "csharp", "blazor",

  // ─── Rust ───
  "rust",

  // ─── C / C++ ───
  "c++", "c",

  // ─── Mobile / Desktop ───
  "react native", "expo", "tauri",

  // ─── Game Dev ───
  "godot", "gdscript",

  // ─── Bases de datos / ORM (solo SQL relacional) ───
  "drizzle", "postgresql", "postgres", "mysql", "sqlite",

  // ─── DevOps / Tools / Deploy ───
  "docker", "linux", "bash", "shell", "nixos", "git", "github",
  "vercel", "cloudflare", "cf pages", "cloudflare workers",

  // ─── Autenticación ───
  "authentication", "jwt", "oauth",

  // ─── Dominios ───
  "saas", "full-stack", "fullstack", "api", "rest",
  "mobile app", "web app",
  "automation", "scraping", "game dev", "game development",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Match por palabra completa: "go" NO matchea "godot",
// "java" NO matchea "javascript", "c" NO matchea "typescript".
// Si el término empieza/termina con palabra normal, aplica límite \b.
function matchesTech(text: string, tech: string): boolean {
  const t = tech.toLowerCase();
  const startsWord = /^[a-z0-9_]/.test(t);
  const endsWord = /[a-z0-9_]$/.test(t);
  let pattern = "";
  if (startsWord) pattern += "\\b";
  pattern += escapeRegExp(t);
  if (endsWord) pattern += "\\b";
  return new RegExp(pattern, "i").test(text);
}

export function matchTechs(text: string): string[] {
  const lower = text.toLowerCase();
  return KNOWN_TECHS.filter((t) => matchesTech(lower, t));
}

export function extractTechStack(text: string): string {
  return matchTechs(text).join(", ");
}
