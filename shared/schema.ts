export * from "./models/auth";
export * from "./models/chat";
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bots = pgTable("bots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: text("price").notNull(),
  imageUrl: text("image_url").notNull(),
  demoUrl: text("demo_url").notNull(),
  category: text("category").notNull(),
  features: text("features"),
  username: text("username").notNull(),
  isRunnable: boolean("is_runnable").default(false),
  botType: text("bot_type").default("demo"),
});

export const botInstances = pgTable("bot_instances", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull(),
  userId: text("user_id"),
  telegramToken: text("telegram_token").notNull(),
  adminTelegramId: text("admin_telegram_id"),
  status: text("status").default("stopped"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertBotSchema = createInsertSchema(bots).omit({ id: true });
export const insertBotInstanceSchema = createInsertSchema(botInstances).omit({ id: true, createdAt: true });

export type Bot = typeof bots.$inferSelect;
export type InsertBot = z.infer<typeof insertBotSchema>;
export type BotInstance = typeof botInstances.$inferSelect;
export type InsertBotInstance = z.infer<typeof insertBotInstanceSchema>;
