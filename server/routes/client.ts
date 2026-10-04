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

const MAX_SLOTS = 6;
const photoFields = upload.fields([{ name: "photo", maxCount: 1 }, ...Array.from({ length: MAX_SLOTS - 1 }, (_, i) => ({ name: `photo_${i + 2}`, maxCount: 1 }))]);

function checkPhoto(file: Express.Multer.File | undefined, label: string) {
  if (!file) throw new HttpError(400, `${label}: rasm yuklang`);
  const mime = fileMime(file);
  if (!IMAGE_MIMES.includes(mime) || !looksLikeImage(file.buffer)) throw new HttpError(400, `${label}: faqat JPG, PNG yoki WEBP rasm yuklang`);
  if (file.size > 15 * 1024 * 1024) throw new HttpError(400, `${label}: rasm hajmi 15 MB dan oshmasin`);
  if (file.size < 20 * 1024) throw new HttpError(400, `${label}: rasm juda kichik yoki sifatsiz. Tiniqroq rasm yuklang`);
  return { file, mime };
}

/** Yangi generatsiya: rasm(lar) yuklanadi, kredit yechiladi, navbatga qo'shiladi */
clientRouter.post("/generations", createLimiter, photoFields, async (req, res) => {
  const user = req.user!;
  const body = parse(z.object({
    templateSlug: z.string().min(1),
    consent: z.literal("true", { message: "Rozilik belgisini qo'ying" }),
  }), req.body);

  const [t] = await db.select().from(templates).where(eq(templates.slug, body.templateSlug));
  const isAdminTest = user.role === "admin" && req.query.test === "1";
  if (!t || (!t.isActive && !isAdminTest)) throw new HttpError(404, "Shablon topilmadi");

  // Shablon nechta rasm so'rasa, shuncha rasm kelishi kerak
  const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const slotCount = Math.max(1, t.inputSlots.length);
  const label = (i: number) => t.inputSlots[i]?.label || (slotCount > 1 ? `${i + 1}-rasm` : "Rasm");
  const photos = Array.from({ length: slotCount }, (_, i) => checkPhoto(files[i === 0 ? "photo" : `photo_${i + 1}`]?.[0], label(i)));

  const id = nanoid(14);
  const saved: string[] = [];
  for (const [i, p] of photos.entries()) {
    saved.push(await saveBuffer("private/uploads", p.file.buffer, extFromMime(p.mime, "jpg"), i === 0 ? id : `${id}_${i + 1}`));
  }
  try {
    await db.transaction(async (tx) => {
      const cost = isAdminTest ? 0 : t.creditCost;
      const allocations = await consumeCredits(tx, user.id, cost, `"${t.title}" generatsiyasi`, `gen:${id}`);
      await tx.insert(generations).values({
        id, userId: user.id, templateId: t.id, inputPath: saved[0], extraInputs: saved.slice(1).map((path) => ({ path })),
        creditsSpent: cost, creditAllocations: allocations,
      });
    });
  } catch (e) {
    for (const p of saved) await deleteFile(p);
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
  for (const x of g.extraInputs) await deleteFile(x.path);
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
