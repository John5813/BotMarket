import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  categories, generations, orders, plans, templates, users, type Template,
} from "@shared/schema";
import { requireAdmin, publicUser } from "../auth";
import { consumeCredits, getBalance, grantCredits, InsufficientCreditsError } from "../credits";
import { absPath, deleteFile, extFromMime, fileMime, IMAGE_MIMES, publicUrl, saveBuffer, VIDEO_MIMES } from "../files";
import { estimateCostUsd, maxUserImageIndex, usesTemplateVideo, validateSteps } from "../ai/pipeline";
import { getSettings, updateSettings, DEFAULT_SETTINGS } from "../settings";
import { generationDto, HttpError, parse, slugify, upload } from "./helpers";
import { ai } from "../ai/provider";
import { analyzeTemplateMedia } from "../ai/analyze";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
adminRouter.get("/stats", async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const s = await getSettings();
  const [[u], [g], [rev], [cost], daily, top, [today]] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`, last30: sql<number>`count(*) filter (where created_at >= ${since})::int` }).from(users),
    db.select({
      total: sql<number>`count(*)::int`,
      ok: sql<number>`count(*) filter (where status = 'succeeded')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      active: sql<number>`count(*) filter (where status in ('queued','processing'))::int`,
    }).from(generations),
    db.select({ total: sql<number>`coalesce(sum(amount_uzs),0)::bigint`, last30: sql<number>`coalesce(sum(amount_uzs) filter (where paid_at >= ${since}),0)::bigint` })
      .from(orders).where(eq(orders.status, "paid")),
    db.select({ last30: sql<number>`coalesce(sum(cost_usd) filter (where created_at >= ${since}),0)::float` }).from(generations),
    db.execute(sql`
      with days as (select generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') as d)
      select to_char(days.d, 'MM-DD') as day,
        (select coalesce(sum(amount_uzs),0)::bigint from orders where status = 'paid' and date_trunc('day', paid_at) = days.d) as revenue,
        (select count(*)::int from generations where date_trunc('day', created_at) = days.d) as generations,
        (select count(*)::int from users where date_trunc('day', created_at) = days.d) as users
      from days order by days.d`),
    db.select({ id: templates.id, title: templates.title, usage: templates.usageCount }).from(templates).orderBy(desc(templates.usageCount)).limit(5),
    db.select({
      generations: sql<number>`(select count(*)::int from generations where created_at >= date_trunc('day', now()))`,
      revenue: sql<number>`(select coalesce(sum(amount_uzs),0)::bigint from orders where status='paid' and paid_at >= date_trunc('day', now()))`,
    }).from(sql`(select 1) x`),
  ]);
  res.json({
    users: u, generations: g, today,
    revenue: { total: Number(rev.total), last30: Number(rev.last30) },
    aiCost: { last30Usd: cost.last30, last30Uzs: Math.round(cost.last30 * s.usdToUzs) },
    daily: daily.rows.map((r: any) => ({ day: r.day, revenue: Number(r.revenue), generations: Number(r.generations), users: Number(r.users) })),
    topTemplates: top, aiMode: ai.name,
  });
});

// ---------------------------------------------------------------------------
// Kategoriyalar
// ---------------------------------------------------------------------------
const categorySchema = z.object({
  title: z.string().trim().min(1, "Nomini kiriting").max(60),
  slug: z.string().trim().max(60).optional(),
  emoji: z.string().max(8).default(""),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

adminRouter.get("/categories", async (_req, res) => {
  const list = await db.select({
    id: categories.id, title: categories.title, slug: categories.slug, emoji: categories.emoji,
    sortOrder: categories.sortOrder, isActive: categories.isActive,
    templateCount: sql<number>`(select count(*)::int from templates where category_id = "categories"."id")`,
  }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
  res.json(list);
});

adminRouter.post("/categories", async (req, res) => {
  const b = parse(categorySchema, req.body);
  const [c] = await db.insert(categories).values({ ...b, slug: slugify(b.slug || b.title) }).returning();
  res.status(201).json(c);
});

adminRouter.put("/categories/:id", async (req, res) => {
  const b = parse(categorySchema, req.body);
  const [c] = await db.update(categories).set({ ...b, slug: slugify(b.slug || b.title) }).where(eq(categories.id, Number(req.params.id))).returning();
  if (!c) throw new HttpError(404, "Topilmadi");
  res.json(c);
});

adminRouter.delete("/categories/:id", async (req, res) => {
  await db.delete(categories).where(eq(categories.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Shablonlar
// ---------------------------------------------------------------------------
function adminTemplateDto(t: Template) {
  return {
    ...t,
    previewUrl: publicUrl(t.previewPath), posterUrl: publicUrl(t.posterPath),
    sourceVideoUrl: t.sourceVideoPath ? `/api/admin/templates/${t.id}/source` : null,
    sourceIsVideo: !!t.sourceVideoPath && /\.(mp4|webm|mov)$/i.test(t.sourceVideoPath),
    estimatedCostUsd: estimateCostUsd(t.steps),
  };
}

const templateSchema = z.object({
  title: z.string().trim().min(2, "Nomini kiriting").max(80),
  slug: z.string().trim().max(60).optional().default(""),
  description: z.string().max(500).default(""),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  kind: z.enum(["character_replace", "multi_character", "effect", "photoshoot", "custom"]),
  inputSlots: z.array(z.object({
    label: z.string().trim().min(1, "Rasm joyiga nom bering").max(40),
    hint: z.string().trim().max(120).optional(),
  })).max(6, "Ko'pi bilan 6 ta rasm joyi").default([]),
  creditCost: z.coerce.number().int().min(0).max(100),
  allowAnimals: z.boolean().default(false),
  inputHint: z.string().max(300).default(""),
  isActive: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  steps: z.unknown(),
});

const templateFiles = upload.fields([
  { name: "preview", maxCount: 1 }, { name: "poster", maxCount: 1 }, { name: "sourceVideo", maxCount: 1 },
]);

/** Forma multipart bo'lib keladi: "data" maydonida JSON, alohida fayllar */
async function saveTemplate(req: any, existing?: Template) {
  let raw: unknown;
  try { raw = JSON.parse(req.body?.data || "{}"); } catch { throw new HttpError(400, "Ma'lumot formati noto'g'ri"); }
  const b = parse(templateSchema, raw);
  const steps = validateSteps(b.steps);
  if (!steps.ok) throw new HttpError(400, steps.error);
  const needImages = maxUserImageIndex(steps.steps);
  const slotCount = Math.max(1, b.inputSlots.length);
  if (needImages > slotCount) {
    throw new HttpError(400, `Retsept {{user_image_${needImages}}} ishlatadi, lekin faqat ${slotCount} ta rasm joyi bor — "Mijozdan so'raladigan rasmlar" bo'limiga qo'shing`);
  }

  const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const paths: Partial<Pick<Template, "previewPath" | "posterPath" | "sourceVideoPath">> = {};
  const preview = files.preview?.[0];
  if (preview) {
    if (![...IMAGE_MIMES, ...VIDEO_MIMES, "image/gif"].includes(fileMime(preview))) throw new HttpError(400, "Namuna video (MP4/WEBM) yoki rasm bo'lishi kerak");
    paths.previewPath = await saveBuffer("public/templates", preview.buffer, extFromMime(fileMime(preview), "mp4"));
  }
  const poster = files.poster?.[0];
  if (poster) {
    if (!IMAGE_MIMES.includes(fileMime(poster))) throw new HttpError(400, "Muqova rasm JPG/PNG/WEBP bo'lishi kerak");
    paths.posterPath = await saveBuffer("public/templates", poster.buffer, extFromMime(fileMime(poster), "jpg"));
  }
  const src = files.sourceVideo?.[0];
  if (src) {
    if (![...VIDEO_MIMES, ...IMAGE_MIMES].includes(fileMime(src))) throw new HttpError(400, "Asl media video (MP4/WEBM/MOV) yoki rasm (JPG/PNG/WEBP) bo'lishi kerak");
    paths.sourceVideoPath = await saveBuffer("private/templates", src.buffer, extFromMime(fileMime(src), "mp4"));
  }

  if (usesTemplateVideo(steps.steps) && !paths.sourceVideoPath && !existing?.sourceVideoPath) {
    throw new HttpError(400, "Bu retsept shablonning asl mediasini ishlatadi — asl video yoki rasmni yuklang");
  }
  if (b.isActive && !paths.previewPath && !existing?.previewPath) {
    throw new HttpError(400, "Faol qilishdan oldin namuna video yoki rasm yuklang");
  }

  let slug = slugify(b.slug || b.title);
  const [clash] = await db.select({ id: templates.id }).from(templates).where(eq(templates.slug, slug));
  if (clash && clash.id !== existing?.id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const values = {
    title: b.title, slug, description: b.description, categoryId: b.categoryId ?? null, kind: b.kind,
    creditCost: b.creditCost, allowAnimals: b.allowAnimals, inputHint: b.inputHint,
    isActive: b.isActive, isFeatured: b.isFeatured, isNew: b.isNew, sortOrder: b.sortOrder,
    steps: steps.steps, inputSlots: b.inputSlots.length > 1 ? b.inputSlots : b.inputSlots.slice(0, 1), updatedAt: new Date(), ...paths,
    ...(paths.sourceVideoPath ? { sourceFalUrl: null, sourceFalUploadedAt: null } : {}),
  };
  if (existing) {
    const [t] = await db.update(templates).set(values).where(eq(templates.id, existing.id)).returning();
    // eski fayllarni o'chirib tashlaymiz
    if (paths.previewPath) await deleteFile(existing.previewPath);
    if (paths.posterPath) await deleteFile(existing.posterPath);
    if (paths.sourceVideoPath) await deleteFile(existing.sourceVideoPath);
    return t;
  }
  const [t] = await db.insert(templates).values(values).returning();
  return t;
}

adminRouter.get("/templates", async (_req, res) => {
  const list = await db.select().from(templates).orderBy(asc(templates.sortOrder), desc(templates.id));
  res.json(list.map(adminTemplateDto));
});

adminRouter.get("/templates/:id", async (req, res) => {
  const [t] = await db.select().from(templates).where(eq(templates.id, Number(req.params.id)));
  if (!t) throw new HttpError(404, "Topilmadi");
  res.json(adminTemplateDto(t));
});

adminRouter.get("/templates/:id/source", async (req, res) => {
  const [t] = await db.select().from(templates).where(eq(templates.id, Number(req.params.id)));
  if (!t?.sourceVideoPath) throw new HttpError(404, "Topilmadi");
  res.sendFile(absPath(t.sourceVideoPath));
});

adminRouter.post("/templates", templateFiles, async (req, res) => {
  res.status(201).json(adminTemplateDto(await saveTemplate(req)));
});

adminRouter.put("/templates/:id", templateFiles, async (req, res) => {
  const [existing] = await db.select().from(templates).where(eq(templates.id, Number(req.params.id)));
  if (!existing) throw new HttpError(404, "Topilmadi");
  res.json(adminTemplateDto(await saveTemplate(req, existing)));
});

adminRouter.patch("/templates/:id", async (req, res) => {
  const b = parse(z.object({ isActive: z.boolean().optional(), isFeatured: z.boolean().optional(), sortOrder: z.number().int().optional() }), req.body);
  const [t] = await db.update(templates).set({ ...b, updatedAt: new Date() }).where(eq(templates.id, Number(req.params.id))).returning();
  if (!t) throw new HttpError(404, "Topilmadi");
  if (b.isActive && !t.previewPath) {
    await db.update(templates).set({ isActive: false }).where(eq(templates.id, t.id));
    throw new HttpError(400, "Namuna video yuklanmagan shablonni faol qilib bo'lmaydi");
  }
  res.json(adminTemplateDto(t));
});

adminRouter.delete("/templates/:id", async (req, res) => {
  const [t] = await db.delete(templates).where(eq(templates.id, Number(req.params.id))).returning();
  if (t) { await deleteFile(t.previewPath); await deleteFile(t.posterPath); await deleteFile(t.sourceVideoPath); }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Tariflar
// ---------------------------------------------------------------------------
const planSchema = z.object({
  title: z.string().trim().min(1, "Nomini kiriting").max(60),
  description: z.string().max(300).default(""),
  credits: z.coerce.number().int().min(1, "Kredit soni kamida 1"),
  priceUzs: z.coerce.number().int().min(1000, "Narx kamida 1 000 so'm"),
  validityDays: z.coerce.number().int().min(1).max(3650),
  badge: z.string().max(30).default(""),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

adminRouter.get("/plans", async (_req, res) => {
  res.json(await db.select().from(plans).orderBy(asc(plans.sortOrder), asc(plans.priceUzs)));
});
adminRouter.post("/plans", async (req, res) => {
  const [p] = await db.insert(plans).values(parse(planSchema, req.body)).returning();
  res.status(201).json(p);
});
adminRouter.put("/plans/:id", async (req, res) => {
  const [p] = await db.update(plans).set(parse(planSchema, req.body)).where(eq(plans.id, Number(req.params.id))).returning();
  if (!p) throw new HttpError(404, "Topilmadi");
  res.json(p);
});
adminRouter.delete("/plans/:id", async (req, res) => {
  await db.update(plans).set({ isActive: false }).where(eq(plans.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Foydalanuvchilar
// ---------------------------------------------------------------------------
adminRouter.get("/users", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const where = q ? or(ilike(users.phone, `%${q.replace(/\D/g, "") || q}%`), ilike(users.name, `%${q}%`)) : undefined;
  const list = await db.select({
    id: users.id, phone: users.phone, name: users.name, role: users.role, isBlocked: users.isBlocked,
    createdAt: users.createdAt, lastLoginAt: users.lastLoginAt,
    balance: sql<number>`(select coalesce(sum(remaining),0)::int from credit_lots where user_id = "users"."id" and remaining > 0 and (expires_at is null or expires_at > now()))`,
    generations: sql<number>`(select count(*)::int from generations where user_id = "users"."id")`,
    spent: sql<number>`(select coalesce(sum(amount_uzs),0)::bigint from orders where user_id = "users"."id" and status = 'paid')`,
  }).from(users).where(where).orderBy(desc(users.id)).limit(200);
  res.json(list.map((u) => ({ ...u, spent: Number(u.spent) })));
});

adminRouter.patch("/users/:id", async (req, res) => {
  const b = parse(z.object({ role: z.enum(["user", "admin"]).optional(), isBlocked: z.boolean().optional() }), req.body);
  const id = Number(req.params.id);
  if (id === req.user!.id && (b.role === "user" || b.isBlocked)) throw new HttpError(400, "O'zingizni bloklay yoki adminlikdan chiqara olmaysiz");
  const [u] = await db.update(users).set(b).where(eq(users.id, id)).returning();
  if (!u) throw new HttpError(404, "Topilmadi");
  res.json(publicUser(u));
});

adminRouter.post("/users/:id/credits", async (req, res) => {
  const b = parse(z.object({
    delta: z.number().int().refine((v) => v !== 0, "0 bo'lmasin"),
    days: z.number().int().min(1).max(3650).nullable().default(30),
    note: z.string().trim().max(200).default(""),
  }), req.body);
  const userId = Number(req.params.id);
  const reason = `Admin: ${b.note || (b.delta > 0 ? "kredit qo'shildi" : "kredit ayirildi")}`;
  try {
    await db.transaction(async (tx) => {
      if (b.delta > 0) await grantCredits(tx, { userId, amount: b.delta, days: b.days, source: "admin", reason, actorId: req.user!.id });
      else await consumeCredits(tx, userId, -b.delta, reason, undefined, req.user!.id);
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) throw new HttpError(400, `Foydalanuvchida faqat ${e.balance} kredit bor`);
    throw e;
  }
  res.json({ balance: await getBalance(userId) });
});

// ---------------------------------------------------------------------------
// Generatsiyalar va buyurtmalar
// ---------------------------------------------------------------------------
adminRouter.get("/generations", async (req, res) => {
  const status = String(req.query.status || "");
  const conds: SQL[] = [];
  if (["queued", "processing", "succeeded", "failed"].includes(status)) conds.push(eq(generations.status, status as any));
  if (req.query.userId) conds.push(eq(generations.userId, Number(req.query.userId)));
  const list = await db.select().from(generations).where(conds.length ? and(...conds) : undefined).orderBy(desc(generations.createdAt)).limit(200);
  const tIds = [...new Set(list.map((g) => g.templateId).filter(Boolean))] as number[];
  const uIds = [...new Set(list.map((g) => g.userId))];
  const [tpls, us] = await Promise.all([
    tIds.length ? db.select().from(templates).where(inArray(templates.id, tIds)) : [],
    uIds.length ? db.select({ id: users.id, phone: users.phone, name: users.name }).from(users).where(inArray(users.id, uIds)) : [],
  ]);
  res.json(list.map((g) => ({ ...generationDto(g, tpls.find((t) => t.id === g.templateId), true), user: us.find((u) => u.id === g.userId) })));
});

adminRouter.get("/orders", async (req, res) => {
  const status = String(req.query.status || "");
  const where = ["pending", "paid", "cancelled", "refunded"].includes(status) ? eq(orders.status, status as any) : undefined;
  const list = await db.select({
    order: orders, phone: users.phone, name: users.name,
  }).from(orders).leftJoin(users, eq(users.id, orders.userId)).where(where).orderBy(desc(orders.createdAt)).limit(300);
  res.json(list.map((r) => ({ ...r.order, user: { phone: r.phone, name: r.name } })));
});

// ---------------------------------------------------------------------------
// Sozlamalar
// ---------------------------------------------------------------------------
adminRouter.get("/settings", async (_req, res) => {
  res.json({ values: await getSettings(), defaults: DEFAULT_SETTINGS });
});
adminRouter.put("/settings", async (req, res) => {
  res.json({ values: await updateSettings(req.body || {}) });
});

// ---------------------------------------------------------------------------
// AI tahlil: shablon kadrlarini ko'rib personaj, sahna va promptlarni taklif qiladi
// ---------------------------------------------------------------------------
adminRouter.post("/analyze", async (req, res) => {
  const b = parse(z.object({
    mediaType: z.enum(["video", "image"]),
    frames: z.array(z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, "Kadr formati noto'g'ri").max(2_000_000, "Kadr juda katta"))
      .min(1, "Kamida bitta kadr kerak").max(6, "Ko'pi bilan 6 ta kadr"),
  }), req.body);
  try {
    res.json(await analyzeTemplateMedia(b.frames, b.mediaType));
  } catch (e) {
    throw new HttpError(502, (e as Error).message);
  }
});
