import { db } from "./db";
import { bots, botInstances, type InsertBot, type Bot, type InsertBotInstance, type BotInstance } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getBots(): Promise<Bot[]>;
  getBot(id: number): Promise<Bot | undefined>;
  createBot(bot: InsertBot): Promise<Bot>;
  updateBot(id: number, data: Partial<InsertBot>): Promise<Bot | undefined>;
  createBotInstance(instance: InsertBotInstance): Promise<BotInstance>;
  getBotInstance(id: number): Promise<BotInstance | undefined>;
  updateBotInstanceStatus(id: number, status: string): Promise<void>;
  deleteBotInstance(id: number): Promise<void>;
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

  async updateBot(id: number, data: Partial<InsertBot>): Promise<Bot | undefined> {
    const [bot] = await db.update(bots).set(data).where(eq(bots.id, id)).returning();
    return bot;
  }

  async createBotInstance(instance: InsertBotInstance): Promise<BotInstance> {
    const [botInstance] = await db.insert(botInstances).values(instance).returning();
    return botInstance;
  }

  async getBotInstance(id: number): Promise<BotInstance | undefined> {
    const [instance] = await db.select().from(botInstances).where(eq(botInstances.id, id));
    return instance;
  }

  async updateBotInstanceStatus(id: number, status: string): Promise<void> {
    await db.update(botInstances).set({ status }).where(eq(botInstances.id, id));
  }

  async deleteBotInstance(id: number): Promise<void> {
    await db.delete(botInstances).where(eq(botInstances.id, id));
  }
}

export const storage = new DatabaseStorage();
