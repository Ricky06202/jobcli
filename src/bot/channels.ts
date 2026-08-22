// ─── Job category channels ───
// Cada canal de Discord tiene un perfil con keywords propias.
// Un job se envía a un canal si matchea sus keywords.
//
// COMO CONFIGURAR: creá el canal en Discord, copiá su ID
// (click derecho -> Copiar ID del canal) y ponelo en `channelId`.
// channelId vacío = canal desactivado.

export interface JobChannel {
  name: string;
  description: string;
  channelId: string; // "" = desactivado
  keywords: string[]; // cualquier match activa el canal
  requireBoth?: string[][]; // categorías que deben matchear TODAS (ej: fullstack)
}

export const JOB_CHANNELS: JobChannel[] = [
  {
    name: "Frontend",
    description: "React, Vue, Svelte, CSS, Tailwind, Angular, UI",
    channelId: "1540840306529013790",
    keywords: [
      "react", "vue", "svelte", "angular", "css", "tailwind",
      "frontend", "front-end", "html", "ui engineer", "webpack",
      "vite", "storybook", "next.js", "nextjs", "astro", "remix",
    ],
  },
  {
    name: "Backend",
    description: "Node, Python, Rust, Go, APIs, bases de datos, servidores",
    channelId: "1540840344072233031",
    keywords: [
      "backend", "back-end", "node.js", "nodejs", "python", "rust", "go",
      "golang", "java", "c#", "csharp", "blazor", "api", "rest", "graphql",
      "database", "postgresql", "postgres", "mysql", "sqlite", "mongo",
      "redis", "server", "django", "fastapi", "flask", "express", "nestjs",
      "microservices",
    ],
  },
  {
    name: "Fullstack",
    description: "Frontend + Backend combinados",
    channelId: "1540840397138563242",
    requireBoth: [
      // frontend keywords
      [
        "react", "vue", "svelte", "angular", "css", "tailwind",
        "frontend", "front-end", "html", "next.js", "nextjs",
      ],
      // backend keywords
      [
        "backend", "back-end", "node.js", "nodejs", "python", "rust", "go",
        "golang", "api", "rest", "graphql", "postgresql", "postgres",
        "django", "fastapi", "express", "nestjs", "microservices",
      ],
    ],
    keywords: ["fullstack", "full-stack", "full stack"],
  },
  {
    name: "DevOps / Cloud",
    description: "Docker, Kubernetes, AWS, GCP, CI/CD, Linux, Terraform",
    channelId: "1540840449344938044",
    keywords: [
      "devops", "kubernetes", "k8s", "docker", "aws", "gcp", "azure",
      "terraform", "ci/cd", "ci cd", "linux", "bash", "shell", "nginx", "sre",
      "site reliability", "helm", "ansible", "prometheus", "grafana",
      "cloud infrastructure", "infrastructure engineer", "devops engineer",
    ],
  },
  {
    name: "Mobile",
    description: "React Native, Flutter, Expo, iOS, Android",
    channelId: "1540840490952302612",
    keywords: [
      "react native", "flutter", "expo", "ios", "android", "kotlin",
      "swift", "mobile", "mobile developer", "mobile app",
    ],
  },
  {
    name: "Game Dev",
    description: "Godot, Unity, Unreal, Game Dev, diseño de juegos",
    channelId: "1540840505565388810",
    keywords: [
      "godot", "gdscript", "unity", "unreal", "game dev", "game development",
      "game developer", "gaming", "gameplay", "game engine",
    ],
  },
  {
    name: "QA / Testing",
    description: "QA, testing, automatización de pruebas",
    channelId: "1540840541900505199",
    keywords: [
      "qa", "quality assurance", "test engineer", "testing",
      "automation test", "test automation", "selenium", "cypress",
      "playwright", "test analyst",
    ],
  },
  {
    name: "Data / IA",
    description: "Python, ML, IA, Data Engineering, análisis de datos",
    channelId: "1540840582577135706",
    keywords: [
      "data engineer", "data science", "data scientist", "machine learning",
      "ml engineer", "ai engineer", "artificial intelligence", "llm",
      "nlp", "tensorflow", "pytorch", "data analyst", "big data",
      "spark", "kafka", "data warehouse", "etl",
    ],
  },
];

export function getActiveChannels(): JobChannel[] {
  return JOB_CHANNELS.filter((c) => c.channelId !== "");
}

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// Cuenta cuántas keywords matchean en un texto. Las del título valen x2
// porque el título define el puesto real (la descripción tiene texto
// genérico de la empresa que contamina el match).
function countMatches(title: string, description: string, keywords: string[]): number {
  const t = title.toLowerCase();
  const d = description.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (t.includes(kw)) count += 2;
    else if (d.includes(kw)) count += 1;
  }
  return count;
}

// Determina a qué canales de categoría debe ir un job.
// - `keywords`: exige MIN_MATCHES (2) sumando título (x2) + descripción (x1).
// - `requireBoth`: cada sub-lista debe matchear al menos 1 (fullstack = 1 front + 1 back).
const MIN_MATCHES = 2;

export function matchChannels(title: string, description: string): JobChannel[] {
  const active = getActiveChannels();

  return active.filter((c) => {
    if (c.requireBoth && c.requireBoth.length > 0) {
      return c.requireBoth.every((sub) =>
        sub.some((kw) => title.toLowerCase().includes(kw) || description.toLowerCase().includes(kw))
      );
    }
    return countMatches(title, description, c.keywords) >= MIN_MATCHES;
  });
}
