import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import { generations, orders, templates } from "@shared/schema";
import { requireAuth } from "../auth";
import { consumeCredits, getCreditOverview, InsufficientCreditsError } from "../credits";
import { absPath, deleteFile, extFromMime, fileMime, IMAGE_MIMES, looksLikeImage, saveBuffer } from "../files";
import { checkoutUrl, createOrder, markOrderPaid, type Provider } from "../payments/orders";
import { env } from "../env";
import { generationDto, HttpError, parse, upload } from "./helpers";

export const clientRouter = Router();
clientRouter.use(["/generations", "/me", "/orders"], requireAuth);

const createLimiter = rateLimit({ windowMs: 60_000, limit: 10, keyGenerator: (req) => String(req.user?.id),
  message: { message: "Juda tez-tez so'rov yuborilyapti. Bir daqiqa kuting." } });

/** Yangi generatsiya: rasm yuklanadi, kredit yechiladi, navbatga qo'shiladi */
clientRouter.post("/generations", createLimiter, upload.single("photo"), async (req, res) => {
  const user = req.user!;
  const body = parse(z.object({
    templateSlug: z.string().min(1),
    consent: z.literal("true", { message: "Rozilik belgisini qo'ying" }),
  }), req.body);
  const file = req.file;
  if (!file) throw new HttpError(400, "Rasm yuklang");
  const mime = fileMime(file);
  if (!IMAGE_MIMES.includes(mime) || !looksLikeImage(file.buffer)) throw new HttpError(400, "Faqat JPG, PNG yoki WEBP rasm yuklang");
  if (file.size > 15 * 1024 * 1024) throw new HttpError(400, "Rasm hajmi 15 MB dan oshmasin");
  if (file.size < 20 * 1024) throw new HttpError(400, "Rasm juda kichik yoki sifatsiz. Tiniqroq rasm yuklang");

  const [t] = await db.select().from(templates).where(eq(templates.slug, body.templateSlug));
  const isAdminTest = user.role === "admin" && req.query.test === "1";
  if (!t || (!t.isActive && !isAdminTest)) throw new HttpError(404, "Shablon topilmadi");

  const id = nanoid(14);
  const inputPath = await saveBuffer("private/uploads", file.buffer, extFromMime(mime, "jpg"), id);
  try {
    await db.transaction(async (tx) => {
      const cost = isAdminTest ? 0 : t.creditCost;
      const allocations = await consumeCredits(tx, user.id, cost, `"${t.title}" generatsiyasi`, `gen:${id}`);
      await tx.insert(generations).values({ id, userId: user.id, templateId: t.id, inputPath, creditsSpent: cost, creditAllocations: allocations });
    });
  } catch (e) {
    await deleteFile(inputPath);
    if (e instanceof InsufficientCreditsError) {
      return res.status(402).json({ message: `Kredit yetarli emas: kerak ${e.needed}, sizda ${e.balance}`, code: "NO_CREDITS" });
    }
    throw e;
  }
  res.status(201).json({ id });
});

clientRouter.get("/generations", async (req, res) => {
  const list = await db.select().from(generations).where(eq(generations.userId, req.user!.id)).orderBy(desc(generations.createdAt)).limit(100);
  const ids = [...new Set(list.map((g) => g.templateId).filter(Boolean))] as number[];
  const tpls = ids.length ? await db.select().from(templates).where(inArray(templates.id, ids)) : [];
  res.json(list.map((g) => generationDto(g, tpls.find((t) => t.id === g.templateId))));
});

async function ownGeneration(userId: number, id: string, isAdmin: boolean) {
  const [g] = await db.select().from(generations).where(eq(generations.id, id));
  if (!g || (g.userId !== userId && !isAdmin)) throw new HttpError(404, "Topilmadi");
  return g;
}

clientRouter.get("/generations/:id", async (req, res) => {
  const g = await ownGeneration(req.user!.id, String(req.params.id), req.user!.role === "admin");
  const [t] = g.templateId ? await db.select().from(templates).where(eq(templates.id, g.templateId)) : [];
  res.json(generationDto(g, t));
});

/** Natija faylini faqat egasi (yoki admin) ko'ra oladi */
clientRouter.get("/generations/:id/file/:idx", async (req, res) => {
  const g = await ownGeneration(req.user!.id, String(req.params.id), req.user!.role === "admin");
  const out = g.outputs[Number(req.params.idx)];
  if (!out) throw new HttpError(404, "Fayl topilmadi");
  if (req.query.download === "1") {
    const ext = out.path.split(".").pop();
    res.setHeader("Content-Disposition", `attachment; filename="aikadr-${g.id}-${req.params.idx}.${ext}"`);
  }
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(absPath(out.path));
});

clientRouter.delete("/generations/:id", async (req, res) => {
  const g = await ownGeneration(req.user!.id, String(req.params.id), false);
  if (g.status === "queued" || g.status === "processing") throw new HttpError(400, "Tayyorlanayotgan ishni o'chirib bo'lmaydi");
  for (const o of g.outputs) await deleteFile(o.path);
  await deleteFile(g.inputPath);
  await db.delete(generations).where(eq(generations.id, g.id));
  res.json({ ok: true });
});

clientRouter.get("/me/credits", async (req, res) => {
  res.json(await getCreditOverview(req.user!.id));
});

// ---------------------------------------------------------------------------
// Buyurtmalar
// ---------------------------------------------------------------------------
clientRouter.post("/orders", async (req, res) => {
  const body = parse(z.object({ planId: z.number().int().positive(), provider: z.enum(["payme", "click", "test"]) }), req.body);
  try {
    const order = await createOrder(req.user!.id, body.planId, body.provider as Provider);
    res.status(201).json({ orderId: order.id, redirectUrl: checkoutUrl(order) });
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
});

clientRouter.get("/orders", async (req, res) => {
  res.json(await db.select().from(orders).where(eq(orders.userId, req.user!.id)).orderBy(desc(orders.createdAt)).limit(50));
});

clientRouter.get("/orders/:id", async (req, res) => {
  const [o] = await db.select().from(orders).where(and(eq(orders.id, Number(req.params.id)), eq(orders.userId, req.user!.id)));
  if (!o) throw new HttpError(404, "Buyurtma topilmadi");
  res.json(o);
});

/** Faqat sinov rejimi: to'lovni simulyatsiya qilish */
clientRouter.post("/orders/:id/test-pay", async (req, res) => {
  if (!env.testPayments) throw new HttpError(403, "Sinov to'lovlari o'chirilgan");
  const [o] = await db.select().from(orders).where(and(eq(orders.id, Number(req.params.id)), eq(orders.userId, req.user!.id)));
  if (!o || o.provider !== "test") throw new HttpError(404, "Buyurtma topilmadi");
  const paid = await db.transaction((tx) => markOrderPaid(tx, o.id));
  res.json(paid);
});
