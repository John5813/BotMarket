import { db } from "./db";
import { bots, type InsertBot, type Bot } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getBots(): Promise<Bot[]>;
  getBot(id: number): Promise<Bot | undefined>;
  createBot(bot: InsertBot): Promise<Bot>;
}

export class DatabaseStorage implements IStorage {
  async getBots(): Promise<Bot[]> {
    return await db.select().from(bots);
  }

  async getBot(id: number): Promise<Bot | undefined> {
    const [bot] = await db.select().from(bots).where(eq(bots.id, id));
    return bot;
  }

  async createBot(insertBot: InsertBot): Promise<Bot> {
    const [bot] = await db.insert(bots).values(insertBot).returning();
    return bot;
  }
}

export const storage = new DatabaseStorage();
