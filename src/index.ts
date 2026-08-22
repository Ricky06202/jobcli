#!/usr/bin/env bun
import { Command } from "commander";
import { fetchJobs } from "./commands/fetch";
import { listJobs } from "./commands/list";
import { discardJobs, saveJobs, applyJobs, showStats } from "./commands/status";
import { exportJobs } from "./commands/export";
import { db } from "./db";
import { jobs } from "./db/schema";
import { eq } from "drizzle-orm";
import chalk from "chalk";

const program = new Command();

program
  .name("jobcli")
  .description("CLI job aggregator & AI screener")
  .version("1.1.0");

program
  .command("fetch")
  .description("Fetch jobs from configured sources")
  .option("-s, --source <name>", "Fetch from specific source only")
  .action(async (opts) => {
    console.log(chalk.bold("\n  jobcli fetch\n"));
    await fetchJobs(opts.source);
  });

program
  .command("list")
  .description("List jobs with filters")
  .option("-s, --status <status>", "Filter by status (new/saved/discarded/applied)")
  .option("--min-score <n>", "Minimum priority score (1-10)", parseInt)
  .option("--min-budget <n>", "Minimum budget in USD", parseInt)
  .option("--source <name>", "Filter by source")
  .option("--sort <field>", "Sort by: score, budget, date (default: date)")
  .option("-n, --limit <n>", "Max results", parseInt)
  .option("-r, --remote-only", "Show only remote jobs")
  .option("--search <term>", "Search in title, description, stack, company")
  .action(async (opts) => {
    await listJobs(opts);
  });

program
  .command("discard <ids...>")
  .description("Mark jobs as discarded")
  .action(async (ids: string[]) => {
    await discardJobs(ids.map(Number));
  });

program
  .command("save <ids...>")
  .description("Mark jobs as saved")
  .action(async (ids: string[]) => {
    await saveJobs(ids.map(Number));
  });

program
  .command("apply <ids...>")
  .description("Mark jobs as applied")
  .action(async (ids: string[]) => {
    await applyJobs(ids.map(Number));
  });

program
  .command("open <id>")
  .description("Open job URL in browser")
  .action(async (id: string) => {
    const row = await db.select().from(jobs).where(eq(jobs.id, Number(id))).limit(1);
    if (row.length === 0) {
      console.log(chalk.red(`  Job #${id} not found`));
      return;
    }
    const url = row[0].url;
    console.log(chalk.dim(`  Opening ${url}`));
    const { spawn } = await import("child_process");
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
  });

program
  .command("export")
  .description("Export jobs to CSV or JSON")
  .option("-f, --format <fmt>", "Export format: csv, json (default: json)")
  .option("-s, --status <status>", "Filter by status")
  .option("--search <term>", "Search in title, description, stack, company")
  .option("-n, --limit <n>", "Max results", parseInt)
  .option("-o, --output <path>", "Output file path")
  .action(async (opts) => {
    await exportJobs(opts);
  });

program
  .command("stats")
  .description("Show job statistics")
  .action(async () => {
    await showStats();
  });

program
  .command("init")
  .description("Initialize database (runs automatically)")
  .action(() => {
    console.log(chalk.green("\n  ✓ Database initialized at ~/.local/share/jobcli/jobs.db\n"));
  });

program.parse();
