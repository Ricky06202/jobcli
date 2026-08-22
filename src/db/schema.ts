import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  company: text("company"),
  url: text("url").notNull().unique(),
  description: text("description"),
  budget: real("budget"),
  budgetType: text("budget_type"), // "fixed" | "hourly" | "unknown"
  techStack: text("tech_stack"), // comma-separated
  source: text("source").notNull(), // "weworkremotely" | "himalayas" | etc
  clientHistory: text("client_history"), // "new" | "repeat" | "verified"
  score: integer("score").default(0), // 0-100 (old scoring)
  priorityScore: integer("priority_score").default(0), // 1-10 (new smart scoring)
  reason: text("reason"), // why viable/discarded
  status: text("status").default("new"), // "new" | "saved" | "discarded" | "applied" | "stale"
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
