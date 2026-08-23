import { Client, GatewayIntentBits, Events } from "discord.js";
import { REST, Routes } from "discord.js";
import {
  commands,
  handleFetch,
  handleJobs,
  handleStats,
  handleSearch,
  handleInfo,
  handleCanales,
  handlePoblar,
  jobEmbed,
} from "./commands";
import { db } from "../db";
import { jobs } from "../db/schema";
import { eq } from "drizzle-orm";
import chalk from "chalk";

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const CHANNEL_NEW_JOBS = process.env.CHANNEL_NEW_JOBS!;
const FETCH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Register slash commands ───
const rest = new REST({ version: "10" }).setToken(TOKEN);
async function registerCommands() {
  console.log(chalk.dim("  Registering slash commands..."));

  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands.map((c) => c.toJSON()),
  });

  console.log(chalk.green("  ✓ Slash commands registered"));
}

// ─── Auto-fetch loop ───
async function autoFetch(client: Client) {
  const channel = client.channels.cache.get(CHANNEL_NEW_JOBS);
  if (!channel || !("send" in channel)) return;

  console.log(chalk.dim("  Auto-fetching jobs..."));

  const { purgeOldJobs } = await import("./purge");
  await purgeOldJobs();

  const { fetchFromSource } = await import("../fetcher");
  const { evaluateJob } = await import("../filter");

  const rawJobs = await fetchFromSource();
  const newViable: { job: any; score: number }[] = [];

  for (const raw of rawJobs) {
    const existing = await db.select().from(jobs).where(eq(jobs.url, raw.url)).limit(1);
    if (existing.length > 0) continue;

    const { budget, type } = extractBudget(`${raw.title} ${raw.description}`);
    const techStack = extractTechStack(`${raw.title} ${raw.description}`);
    const result = evaluateJob(raw.title, raw.description, budget);

    await db.insert(jobs).values({
      title: raw.title,
      company: raw.company || null,
      url: raw.url,
      description: raw.description,
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
      newViable.push({
        job: {
          title: raw.title,
          url: raw.url,
          company: raw.company,
          source: raw.source,
          description: raw.description,
          budget,
          budgetType: type,
          techStack,
          priorityScore: result.priorityScore,
        },
        score: result.priorityScore,
      });
    }
  }

  if (newViable.length > 0) {
    const { matchChannels } = await import("./channels");

    for (const { job } of newViable.sort((a, b) => b.score - a.score)) {
      const embed = jobEmbed(job);

      // Canal personal (el del dueño del bot)
      await channel.send({ embeds: [embed] });

      // Canales de categoría
      const matched = matchChannels(job.title, job.description || "");
      for (const cat of matched) {
        const catChannel = client.channels.cache.get(cat.channelId);
        if (catChannel && "send" in catChannel) {
          await catChannel.send({ embeds: [embed] });
        }
      }
    }
  }
}

// ─── Main ───
async function main() {
  console.log(chalk.bold("\n  jobcli bot\n"));

  await registerCommands();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(chalk.green(`  ✓ Bot online: ${c.user.tag}`));
    console.log(chalk.dim(`  Auto-fetch cada ${FETCH_INTERVAL_MS / 60000} minutos`));

    // Force guild-local command sync so /info and friends appear instantly
    // (global commands can take up to 1 hour to propagate on Discord)
    for (const guild of c.guilds.cache.values()) {
      rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), {
        body: commands.map((cmd) => cmd.toJSON()),
      })
        .then(() => console.log(chalk.dim(`  ✓ Commands synced to guild ${guild.name}`)))
        .catch((err) => console.error(chalk.red(`  ✗ Guild sync failed for ${guild.name}: ${err}`)));
    }

    // Start auto-fetch loop
    autoFetch(client);
    setInterval(() => autoFetch(client), FETCH_INTERVAL_MS);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      // Comandos que escriben en canales: solo admins del servidor
      const adminOnly = ["fetch", "poblar"];
      if (adminOnly.includes(interaction.commandName)) {
        const memberPerms = interaction.memberPermissions;
        const isAdmin = memberPerms?.has("Administrator") ?? false;
        if (!isAdmin) {
          await interaction.reply({
            content: "⛔ Este comando solo está disponible para administradores del servidor.",
            ephemeral: true,
          });
          return;
        }
      }

      switch (interaction.commandName) {
        case "fetch": await handleFetch(interaction); break;
        case "jobs": await handleJobs(interaction); break;
        case "stats": await handleStats(interaction); break;
        case "search": await handleSearch(interaction); break;
        case "info": await handleInfo(interaction); break;
        case "canales": await handleCanales(interaction); break;
        case "poblar": await handlePoblar(interaction); break;
      }
    } catch (err) {
      console.error(chalk.red(`  Error: ${err}`));
      const reply = { content: "❌ Error ejecutando el comando.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  await client.login(TOKEN);
}

// ─── Helpers ───

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

function extractTechStack(text: string): string {
  const known = [
    "typescript", "javascript", "bun", "node.js", "nodejs", "python", "rust",
    "react", "next.js", "nextjs", "hono", "react native", "expo",
    "tauri", "drizzle", "postgresql", "postgres", "sqlite",
    "docker", "linux", "nixos", "git", "github",
    "vue", "svelte", "angular", "astro", "tailwind",
    "mongodb", "redis", "supabase", "graphql", "rest", "api",
    "kubernetes", "aws", "gcp", "azure", "vercel", "netlify",
    "godot", "flutter", "swift", "kotlin", "django", "fastapi", "flask",
  ];
  const lower = text.toLowerCase();
  return known.filter((t) => lower.includes(t)).join(", ");
}

main().catch((err) => {
  console.error(chalk.red(`Fatal: ${err}`));
  process.exit(1);
});
