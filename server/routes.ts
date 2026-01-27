import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { z } from "zod";
import { startEdufailBot, stopBot, isBotRunning } from "./botRunner";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Set up auth first
  await setupAuth(app);
  registerAuthRoutes(app);

  // Bot routes
  app.get(api.bots.list.path, async (req, res) => {
    const bots = await storage.getBots();
    res.json(bots);
  });

  app.get(api.bots.get.path, async (req, res) => {
    const bot = await storage.getBot(Number(req.params.id));
    if (!bot) {
      return res.status(404).json({ message: "Bot not found" });
    }
    res.json(bot);
  });

  app.post(api.bots.create.path, async (req, res) => {
    try {
      const input = api.bots.create.input.parse(req.body);
      const bot = await storage.createBot(input);
      res.status(201).json(bot);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Bot instance routes - for running bots with user tokens
  app.post("/api/bot-instances", async (req, res) => {
    try {
      const { botId, telegramToken, adminTelegramId } = req.body;
      
      if (!botId || !telegramToken) {
        return res.status(400).json({ message: "botId va telegramToken kerak" });
      }

      const instance = await storage.createBotInstance({
        botId,
        telegramToken,
        adminTelegramId: adminTelegramId || null,
        userId: null,
        status: "stopped",
      });

      res.status(201).json(instance);
    } catch (err) {
      console.error("Error creating bot instance:", err);
      res.status(500).json({ message: "Bot instance yaratishda xatolik" });
    }
  });

  app.post("/api/bot-instances/:id/start", async (req, res) => {
    try {
      const instanceId = Number(req.params.id);
      const instance = await storage.getBotInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ message: "Bot instance topilmadi" });
      }

      if (isBotRunning(instanceId)) {
        return res.json({ status: "running", message: "Bot allaqachon ishlamoqda" });
      }

      const success = startEdufailBot(instanceId, instance.telegramToken, instance.adminTelegramId || undefined);
      
      if (success) {
        await storage.updateBotInstanceStatus(instanceId, "running");
        res.json({ status: "running", message: "Bot muvaffaqiyatli ishga tushirildi" });
      } else {
        res.status(500).json({ message: "Botni ishga tushirishda xatolik" });
      }
    } catch (err) {
      console.error("Error starting bot:", err);
      res.status(500).json({ message: "Botni ishga tushirishda xatolik" });
    }
  });

  app.post("/api/bot-instances/:id/stop", async (req, res) => {
    try {
      const instanceId = Number(req.params.id);
      const instance = await storage.getBotInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ message: "Bot instance topilmadi" });
      }

      const success = stopBot(instanceId);
      await storage.updateBotInstanceStatus(instanceId, "stopped");
      
      res.json({ status: "stopped", message: "Bot to'xtatildi" });
    } catch (err) {
      console.error("Error stopping bot:", err);
      res.status(500).json({ message: "Botni to'xtatishda xatolik" });
    }
  });

  app.get("/api/bot-instances/:id/status", async (req, res) => {
    const instanceId = Number(req.params.id);
    const running = isBotRunning(instanceId);
    res.json({ status: running ? "running" : "stopped" });
  });

  app.delete("/api/bot-instances/:id", async (req, res) => {
    try {
      const instanceId = Number(req.params.id);
      stopBot(instanceId);
      await storage.deleteBotInstance(instanceId);
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting bot instance:", err);
      res.status(500).json({ message: "Bot instance o'chirishda xatolik" });
    }
  });

  return httpServer;
}
