#!/usr/bin/env bun
import { Command } from "commander";
import { fetchJobs } from "./commands/fetch";
import { listJobs } from "./commands/list";
import { discardJobs, saveJobs, showStats } from "./commands/status";
import { db } from "./db";
import { jobs } from "./db/schema";
import chalk from "chalk";

const program = new Command();

program
  .name("jobcli")
  .description("CLI job aggregator & AI screener")
  .version("1.0.0");

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
  .option("--min-score <n>", "Minimum score", parseInt)
  .option("--min-budget <n>", "Minimum budget", parseInt)
  .option("--source <name>", "Filter by source")
  .option("--sort <field>", "Sort by: score, budget, date (default: date)")
  .option("-n, --limit <n>", "Max results", parseInt)
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
