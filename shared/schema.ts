export * from "./models/auth";
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bots = pgTable("bots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: text("price").notNull(), // "Tekin", "50 000 so'm", etc.
  imageUrl: text("image_url").notNull(),
  demoUrl: text("demo_url").notNull(),
  category: text("category").notNull(),
  features: text("features"), // stored as JSON string or simple text description
  username: text("username").notNull(), // Telegram username without @
});

export const insertBotSchema = createInsertSchema(bots).omit({ id: true });

export type Bot = typeof bots.$inferSelect;
export type InsertBot = z.infer<typeof insertBotSchema>;
