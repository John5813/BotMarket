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

  // GitHub import - fetch bot.json from repo
  app.post("/api/bots/import-github", async (req, res) => {
    try {
      const { githubUrl } = req.body;
      
      if (!githubUrl) {
        return res.status(400).json({ message: "GitHub URL kerak" });
      }

      // Parse GitHub URL to get raw content URL - handle various formats
      const cleanUrl = githubUrl.replace(/\/$/, '').replace(/\.git$/, '');
      const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return res.status(400).json({ message: "Noto'g'ri GitHub URL formati. Masalan: https://github.com/username/repo" });
      }

      const [, owner, repo] = match;
      console.log(`Trying to fetch bot.json from ${owner}/${repo}`);

      // Try different branches: main, master
      const branches = ['main', 'master'];
      let botData = null;
      let foundBranch = null;

      for (const branch of branches) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/bot.json`;
        console.log(`Trying: ${rawUrl}`);
        try {
          const response = await fetch(rawUrl);
          if (response.ok) {
            botData = await response.json();
            foundBranch = branch;
            console.log(`Found bot.json in ${branch} branch`);
            break;
          }
        } catch (e) {
          console.log(`Failed to fetch from ${branch}:`, e);
        }
      }

      if (!botData) {
        return res.status(400).json({ 
          message: `bot.json fayli topilmadi. Repository ildiz papkasida bot.json fayli bo'lishi kerak.`,
          hint: `URL: https://github.com/${owner}/${repo} da bot.json fayli yo'q`
        });
      }

      // Validate required fields
      if (!botData.name || !botData.description) {
        return res.status(400).json({ 
          message: "bot.json da name va description maydonlari bo'lishi kerak" 
        });
      }

      // Create bot with defaults for missing fields
      const bot = await storage.createBot({
        name: botData.name,
        description: botData.description,
        price: botData.price || "Bepul",
        imageUrl: botData.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${botData.name}`,
        demoUrl: botData.demoUrl || `https://t.me/${botData.username || 'bot'}`,
        category: botData.category || "Boshqa",
        features: botData.features || "",
        username: botData.username || repo,
        githubUrl: cleanUrl,
        pricingType: botData.pricingType || "monthly",
        pricingTier: botData.pricingTier || "simple",
      });
      
      res.status(201).json(bot);
    } catch (err) {
      console.error("GitHub import error:", err);
      res.status(500).json({ message: "GitHub dan yuklashda xatolik: " + (err as Error).message });
    }
  });

  // Refresh bot from GitHub
  app.post("/api/bots/:id/refresh-github", async (req, res) => {
    try {
      const botId = Number(req.params.id);
      const bot = await storage.getBot(botId);
      
      if (!bot) {
        return res.status(404).json({ message: "Bot topilmadi" });
      }

      if (!bot.githubUrl) {
        return res.status(400).json({ message: "Bu botda GitHub URL yo'q" });
      }

      // Parse GitHub URL
      const match = bot.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return res.status(400).json({ message: "Noto'g'ri GitHub URL" });
      }

      const [, owner, repo] = match;
      let botData;

      // Try main branch first, then master
      const mainUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/bot.json`;
      const response = await fetch(mainUrl);
      
      if (response.ok) {
        botData = await response.json();
      } else {
        const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/bot.json`;
        const masterResponse = await fetch(masterUrl);
        if (!masterResponse.ok) {
          return res.status(400).json({ message: "bot.json fayli topilmadi" });
        }
        botData = await masterResponse.json();
      }

      // Update bot with new data
      const updatedBot = await storage.updateBot(botId, {
        name: botData.name || bot.name,
        description: botData.description || bot.description,
        price: botData.price || bot.price,
        imageUrl: botData.imageUrl || bot.imageUrl,
        demoUrl: botData.demoUrl || bot.demoUrl,
        category: botData.category || bot.category,
        features: botData.features || bot.features,
        username: botData.username || bot.username,
      });
      
      res.json(updatedBot);
    } catch (err) {
      console.error("GitHub refresh error:", err);
      res.status(500).json({ message: "GitHub dan yangilashda xatolik" });
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
