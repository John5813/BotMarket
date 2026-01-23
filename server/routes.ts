import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { z } from "zod";

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

  // Seed data
  seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingBots = await storage.getBots();
  if (existingBots.length === 0) {
    console.log("Seeding database...");
    await storage.createBot({
      name: "Tarjimon Bot",
      description: "Har qanday matnni istalgan tilga tarjima qiluvchi kuchli bot. Ovozli xabarlarni ham qo'llab-quvvatlaydi.",
      price: "Bepul",
      imageUrl: "https://images.unsplash.com/photo-1546188994-07c34f295f52?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      demoUrl: "https://t.me/tarjimonbot",
      category: "Foydali",
      username: "tarjimonbot",
      features: "Matn tarjimasi, Ovozli tarjima, Ko'p tilli",
    });
    await storage.createBot({
      name: "Kino Bot",
      description: "Eng so'nggi kinolarni HD formatda tomosha qiling. Seriyallar va multfilmlar ham mavjud.",
      price: "50 000 so'm",
      imageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      demoUrl: "https://t.me/kinobot",
      category: "Ko'ngilochar",
      username: "kinobot",
      features: "HD Sifat, Katta baza, Reklamasiz",
    });
    await storage.createBot({
      name: "Valyuta Kurslari",
      description: "Markaziy bank kurslari bo'yicha eng so'nggi ma'lumotlar. Dollar, Yevro va Rubl kurslarini kuzatib boring.",
      price: "Bepul",
      imageUrl: "https://images.unsplash.com/photo-1611974765270-ca12586343bb?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      demoUrl: "https://t.me/kursbot",
      category: "Moliya",
      username: "kursbot",
      features: "Kunlik yangilanish, Valyuta konverteri",
    });
     await storage.createBot({
      name: "Payme Click Bot",
      description: "To'lovlarni qabul qilish uchun universal bot. Click va Payme integratsiyasi mavjud.",
      price: "100 000 so'm",
      imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      demoUrl: "https://t.me/paymebot",
      category: "Biznes",
      username: "paymebot",
      features: "Xavfsiz to'lovlar, Statistika, Admin panel",
    });
  }
}
