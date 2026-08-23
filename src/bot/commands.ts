import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { db } from "../db";
import { jobs } from "../db/schema";
import { eq, desc, sql, and, like, or, gte, ne } from "drizzle-orm";
import { extractTechStack } from "../filter/techs";

export const commands = [
  new SlashCommandBuilder()
    .setName("fetch")
    .setDescription("Fetch new jobs from all sources"),

  new SlashCommandBuilder()
    .setName("jobs")
    .setDescription("List top matching jobs")
    .addIntegerOption((opt) =>
      opt.setName("min_score").setDescription("Minimum priority score (1-10)").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt.setName("limit").setDescription("Number of jobs to show (max 10)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show job statistics"),

  new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search jobs by keyword")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("Search term").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("How this bot works"),

  new SlashCommandBuilder()
    .setName("canales")
    .setDescription("List job category channels"),

  new SlashCommandBuilder()
    .setName("poblar")
    .setDescription("Send existing jobs to category channels")
    .addIntegerOption((opt) =>
      opt.setName("limit").setDescription("How many jobs to distribute (default 10)").setRequired(false)
    ),
];

export function jobEmbed(job: any) {
  const scoreColor =
    (job.priorityScore || 0) >= 8 ? 0x2ecc71 :
    (job.priorityScore || 0) >= 5 ? 0xf1c40f :
    0xe74c3c;

  const embed = new EmbedBuilder()
    .setTitle(job.title.substring(0, 256))
    .setURL(job.url)
    .setColor(scoreColor)
    .addFields(
      { name: "🏢 Empresa", value: job.company || "No especificada", inline: true },
      { name: "🌍 Ubicación", value: job.location || "No especificada", inline: true },
      { name: "🔢 Prioridad", value: `${job.priorityScore || 0}/10`, inline: true },
    );

  if (job.budget) {
    embed.addFields({ name: "💰 Presupuesto", value: `$${job.budget.toLocaleString()} ${job.budgetType || ""}`, inline: true });
  }
  if (job.techStack) {
    embed.addFields({ name: "🧰 Stack", value: job.techStack.substring(0, 200) });
  }
  if (job.description) {
    const clean = job.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length > 0) {
      embed.setDescription(clean.substring(0, 500));
    }
  }
  embed.setFooter({ text: `Fuente: ${job.source}${job.reason ? ` • ${job.reason}` : ""}` });

  return embed;
}

export async function handleFetch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const { fetchFromSource } = await import("../fetcher");
  const { evaluateJob } = await import("../filter");
  const { eq: eqOp } = await import("drizzle-orm");

  const rawJobs = await fetchFromSource();

  let added = 0;
  let duplicates = 0;
  const newViable: any[] = [];

  for (const raw of rawJobs) {
    const existing = await db.select().from(jobs).where(eqOp(jobs.url, raw.url)).limit(1);
    if (existing.length > 0) { duplicates++; continue; }

    const { budget, type } = extractBudget(`${raw.title} ${raw.description}`);
    const techStack = extractTechStack(`${raw.title} ${raw.description}`);
    const result = evaluateJob(raw.title, raw.description, budget);

    await db.insert(jobs).values({
      title: raw.title,
      company: raw.company || null,
      url: raw.url,
      description: raw.description,
      location: raw.location || null,
      budget,
      budgetType: type,
      techStack: techStack || null,
      source: raw.source,
      priorityScore: result.status === "viable" ? result.priorityScore : 0,
      reason: result.reason,
      score: result.status === "viable" ? result.priorityScore * 10 : 0,
      status: result.status === "discarded" ? "discarded" : "new",
      fetchedAt: new Date(),
    });
    if (result.status === "viable") {
      added++;
      newViable.push({
        title: raw.title,
        company: raw.company || null,
        url: raw.url,
        budget,
        budgetType: type,
        techStack: techStack || null,
        source: raw.source,
        priorityScore: result.priorityScore,
      });
    }
  }

  await interaction.editReply(
    `✅ Fetch completado: **${added}** trabajos nuevos, **${duplicates}** duplicados omitidos`
  );

  if (newViable.length > 0) {
    const channel = interaction.client.channels.cache.get(process.env.CHANNEL_NEW_JOBS!);
    if (channel && "send" in channel) {
      const sorted = newViable.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
      for (const job of sorted) {
        await channel.send({ embeds: [jobEmbed(job)] });
      }
    }
  }
}

export async function handleJobs(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const minScore = interaction.options.getInteger("min_score") || 5;
  const limit = Math.min(interaction.options.getInteger("limit") || 5, 10);

  const rows = await db.select().from(jobs)
    .where(and(gte(jobs.priorityScore, minScore), eq(jobs.status, "new")))
    .orderBy(desc(jobs.priorityScore))
    .limit(limit);

  if (rows.length === 0) {
    await interaction.editReply("No hay trabajos nuevos con ese puntaje mínimo.");
    return;
  }

  const embeds = rows.map(jobEmbed);
  await interaction.editReply({ content: `📋 **${rows.length} trabajos** (score ≥ ${minScore}):`, embeds });
}

export async function handleStats(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const all = await db.select({ status: jobs.status, count: sql<number>`count(*)` })
    .from(jobs).groupBy(jobs.status);

  const lines = all.map((r) => {
    const emoji =
      r.status === "new" ? "🆕" :
      r.status === "saved" ? "💾" :
      r.status === "applied" ? "📨" :
      r.status === "stale" ? "⏳" :
      "🗑️";
    return `${emoji} **${r.status || "unknown"}**: ${r.count}`;
  });

  await interaction.editReply({ content: `📊 **Estadísticas:**\n${lines.join("\n")}` });
}

export async function handleSearch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const query = interaction.options.getString("query")!;
  const term = `%${query}%`;

  const rows = await db.select().from(jobs)
    .where(and(
      or(like(jobs.title, term), like(jobs.description, term), like(jobs.techStack, term)),
      ne(jobs.status, "stale"),
    ))
    .orderBy(desc(jobs.priorityScore))
    .limit(5);

  if (rows.length === 0) {
    await interaction.editReply(`No se encontraron trabajos para "${query}".`);
    return;
  }

  const embeds = rows.map(jobEmbed);
  await interaction.editReply({ content: `🔍 **${rows.length} resultados** para "${query}":`, embeds });
}

export async function handleInfo(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("📋 Cómo funciona jobcli")
    .setColor(0x3498db)
    .setDescription("Bot de búsqueda inteligente de empleo remoto. Busca en múltiples fuentes RSS, filtra basándose en tu stack tecnológico y prioriza las mejores ofertas.")
    .addFields(
      {
        name: "🔍 Fuentes de empleo",
        value: [
          "• We Work Remotely (Programming + Full-Stack)",
          "• Remotive",
          "• Himalayas",
          "• Landing.jobs",
        ].join("\n"),
      },
      {
        name: "🧠 Filtro inteligente",
        value: [
          "Cada oferta pasa por 4 pasos:",
          "1️⃣ **Blacklist dura** — descarta construction, non-software, explotación, non-tech",
          "2️⃣ **Restricción geográfica** — descarta empleos con restricción de país/visa",
          "3️⃣ **Whitelist de tech** — requiere match con 2+ tecnologías de tu stack",
          "4️⃣ **Scoring 1-10** — prioriza por profundidad tech, presupuesto y claridad del scope",
        ].join("\n"),
      },
      {
        name: "⚙️ Stack que filtra",
        value: [
          "**JS/TS:** TypeScript, JavaScript, Bun, Node, Hono, Express, React, Next.js, Astro, Svelte, HTML, CSS, Tailwind",
          "**Python:** Python, FastAPI, Django",
          "**Otros lenguajes:** Go, Java, C#, C, Rust",
          "**Mobile/Desktop:** React Native, Expo, Tauri",
          "**Game Dev:** Godot (GDScript)",
          "**Bases de datos:** PostgreSQL, MySQL, SQLite, Drizzle ORM",
          "**Deploy:** Vercel, Cloudflare",
          "**DevOps:** Docker, Linux, NixOS, Git",
          "",
          "**Dominios:** SaaS, Full-Stack, Web, Mobile, Scraping, Autenticación",
        ].join("\n"),
      },
      {
        name: "📊 Comandos disponibles",
        value: [
          "`/fetch` — Buscar trabajos nuevos ahora",
          "`/jobs` — Ver top trabajos (filtrable por score)",
          "`/search query:react` — Buscar por palabra clave",
          "`/canales` — Ver canales por categoría",
          "`/stats` — Ver estadísticas",
          "`/info` — Esta información",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Auto-fetch cada 30 minutos • Powered by Bun + Drizzle ORM" });

  await interaction.reply({ embeds: [embed] });
}

export async function handleCanales(interaction: ChatInputCommandInteraction) {
  const { JOB_CHANNELS } = await import("./channels");

  const embed = new EmbedBuilder()
    .setTitle("📂 Canales por categoría")
    .setColor(0x9b59b6)
    .setDescription("Cada canal muestra trabajos que matchean su especialidad. Un job puede aparecer en varios canales si aplica a varias categorías.")
    .addFields(
      JOB_CHANNELS.map((c) => ({
        name: c.name,
        value: c.description,
        inline: true,
      })),
    )
    .setFooter({ text: "Mandá tus dudas en /comandos" });

  await interaction.reply({ embeds: [embed] });
}

export async function handlePoblar(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const { matchChannels } = await import("./channels");
  const limit = Math.min(interaction.options.getInteger("limit") || 10, 30);

  const rows = await db.select().from(jobs)
    .where(and(eq(jobs.status, "new"), gte(jobs.priorityScore, 5)))
    .orderBy(desc(jobs.priorityScore))
    .limit(limit);

  if (rows.length === 0) {
    await interaction.editReply("No hay trabajos viables en la base para distribuir.");
    return;
  }

  let sent = 0;
  const byChannel: Record<string, number> = {};

  for (const job of rows) {
    const matched = matchChannels(job.title, job.description || "");

    for (const cat of matched) {
      const ch = interaction.client.channels.cache.get(cat.channelId);
      if (ch && "send" in ch) {
        await ch.send({ embeds: [jobEmbed(job)] });
        sent++;
        byChannel[cat.name] = (byChannel[cat.name] || 0) + 1;
      }
    }
  }

  const summary = Object.entries(byChannel)
    .map(([name, count]) => `**${name}**: ${count}`)
    .join(" • ");

  await interaction.editReply(
    `📤 Distribuidos **${rows.length}** trabajos en las categorías:\n${summary}`
  );
}

// ─── Helpers (duplicated from fetch.ts to keep bot self-contained) ───

function extractBudget(text: string): { budget: number | null; type: string | null } {
  const match = text.match(/\$(\d[\d,]*(?:\.\d{2})?)\s*(?:-?\s*\$?\d[\d,]*)?\s*(?:\/\s*(?:hr|hour|mo|month))?/i);
  if (match) {
    const budget = parseFloat(match[1].replace(/,/g, ""));
    const isHourly = /\/\s*(?:hr|hour)/i.test(text);
    const isMonthly = /\/\s*(?:mo|month)/i.test(text);
    return { budget, type: isHourly ? "hourly" : isMonthly ? "monthly" : "fixed" };
  }
  return { budget: null, type: null };
}
