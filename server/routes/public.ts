import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { categories, plans, templates, users } from "@shared/schema";
import { hashPassword, normalizePhone, publicUser, startSession, verifyPassword } from "../auth";
import { getBalance, grantCredits } from "../credits";
import { getSettings } from "../settings";
import { enabledProviders } from "../payments/orders";
import { HttpError, parse, templateDto } from "./helpers";
import { ai, generationEnabled } from "../ai/provider";

export const publicRouter = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { message: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." } });

/** Uptime monitoring uchun (masalan UptimeRobot): server va baza ishlayaptimi */
publicRouter.get("/health", async (_req, res) => {
  await db.execute(sql`select 1`);
  res.json({ ok: true, ai: ai.name, time: new Date().toISOString() });
});

publicRouter.get("/config", async (_req, res) => {
  const s = await getSettings();
  res.json({
    siteName: s.siteName, tagline: s.tagline, supportTelegram: s.supportTelegram,
    paymentProviders: enabledProviders(), aiMode: ai.name, generationEnabled,
  });
});

/** Bosh sahifa: faol kategoriyalar va ulardagi faol shablonlar */
publicRouter.get("/catalog", async (_req, res) => {
  const cats = await db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder), asc(categories.id));
  const tpls = await db.select().from(templates).where(eq(templates.isActive, true)).orderBy(asc(templates.sortOrder), desc(templates.id));
  res.json({
    featured: tpls.filter((t) => t.isFeatured).map(templateDto),
    categories: cats.map((c) => ({
      id: c.id, title: c.title, slug: c.slug, emoji: c.emoji,
      templates: tpls.filter((t) => t.categoryId === c.id).map(templateDto),
    })).filter((c) => c.templates.length > 0),
  });
});

publicRouter.get("/templates/:slug", async (req, res) => {
  const [t] = await db.select().from(templates).where(and(eq(templates.slug, String(req.params.slug)), eq(templates.isActive, true)));
  if (!t) throw new HttpError(404, "Shablon topilmadi");
  res.json(templateDto(t));
});

publicRouter.get("/plans", async (_req, res) => {
  const list = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder), asc(plans.priceUzs));
  res.json(list);
});

// ---------------------------------------------------------------------------
// Ro'yxatdan o'tish va kirish
// ---------------------------------------------------------------------------
const credentialsSchema = z.object({
  phone: z.string().min(9, "Telefon raqamni kiriting"),
  password: z.string().min(6, "Parol kamida 6 belgidan iborat bo'lsin").max(100),
});

publicRouter.post("/auth/register", authLimiter, async (req, res) => {
  const body = parse(credentialsSchema.extend({ name: z.string().trim().min(2, "Ismingizni kiriting").max(60) }), req.body);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, "Telefon raqam noto'g'ri. Masalan: +998 90 123 45 67");
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (exists) throw new HttpError(409, "Bu raqam bilan allaqachon ro'yxatdan o'tilgan");

  const s = await getSettings();
  const user = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ phone, name: body.name, passwordHash: await hashPassword(body.password), lastLoginAt: new Date() }).returning();
    await grantCredits(tx, { userId: u.id, amount: s.signupBonusCredits, days: s.signupBonusDays, source: "signup", reason: "Ro'yxatdan o'tish bonusi" });
    return u;
  });
  await startSession(req, user.id);
  res.status(201).json({ user: publicUser(user) });
});

publicRouter.post("/auth/login", authLimiter, async (req, res) => {
  const body = parse(credentialsSchema, req.body);
  const phone = normalizePhone(body.phone);
  const [user] = phone ? await db.select().from(users).where(eq(users.phone, phone)) : [];
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) throw new HttpError(401, "Telefon raqam yoki parol noto'g'ri");
  if (user.isBlocked) throw new HttpError(403, "Hisobingiz bloklangan. Qo'llab-quvvatlash xizmatiga murojaat qiling");
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await startSession(req, user.id);
  res.json({ user: publicUser(user) });
});

publicRouter.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

publicRouter.get("/auth/me", async (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: publicUser(req.user), balance: await getBalance(req.user.id) });
});
