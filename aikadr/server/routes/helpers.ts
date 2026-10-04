import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import type { z } from "zod";
import { publicUrl } from "../files";
import type { Template, Generation } from "@shared/schema";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message || "Ma'lumot noto'g'ri");
  return r.data;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 4 },
});

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Fayl hajmi juda katta" : "Fayl yuklashda xatolik" });
  }
  const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
  if (status && status >= 400 && status < 500) return res.status(status).json({ message: status === 404 ? "Topilmadi" : "So'rov noto'g'ri" });
  console.error(err);
  res.status(500).json({ message: "Serverda xatolik yuz berdi" });
}

const isVideo = (p?: string | null) => !!p && /\.(mp4|webm|mov)$/i.test(p);

/** Mijozga ko'rsatiladigan shablon (promptlar va qadamlar sir saqlanadi) */
export function templateDto(t: Template) {
  return {
    id: t.id, slug: t.slug, title: t.title, description: t.description, categoryId: t.categoryId, kind: t.kind,
    previewUrl: publicUrl(t.previewPath), previewIsVideo: isVideo(t.previewPath), posterUrl: publicUrl(t.posterPath),
    creditCost: t.creditCost, allowAnimals: t.allowAnimals, inputHint: t.inputHint,
    isFeatured: t.isFeatured, isNew: t.isNew, usageCount: t.usageCount,
  };
}

export function generationDto(g: Generation, t?: Pick<Template, "title" | "slug" | "steps"> | null, admin = false) {
  return {
    id: g.id, status: g.status, createdAt: g.createdAt, finishedAt: g.finishedAt, creditsSpent: g.creditsSpent,
    templateTitle: t?.title ?? "O'chirilgan shablon", templateSlug: t?.slug ?? null,
    stepIndex: g.stepIndex, totalSteps: t?.steps.length ?? 1,
    outputs: g.outputs.map((o, i) => ({ type: o.type, url: `/api/generations/${g.id}/file/${i}` })),
    error: g.status === "failed" ? (admin ? g.error : "Natija tayyorlanmadi. Kredit hisobingizga qaytarildi.") : null,
    ...(admin ? { userId: g.userId, costUsd: g.costUsd, rawError: g.error, attempts: g.attempts } : {}),
  };
}

export function slugify(s: string) {
  const map: Record<string, string> = { "o'": "o", "g'": "g", "ʻ": "", "'": "", "ʼ": "" };
  return s.toLowerCase().replace(/o'|g'|ʻ|'|ʼ/g, (m) => map[m] ?? "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "shablon";
}
