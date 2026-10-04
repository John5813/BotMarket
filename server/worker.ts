import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { generations, templates, type Generation, type StepResult, type Template } from "@shared/schema";
import { ai } from "./ai/provider";
import { extractOutputUrl, finalStepIndexes, resolveInput, usesTemplateVideo, estimateCostUsd } from "./ai/pipeline";
import { refundCredits } from "./credits";
import { deleteFile, downloadToPrivate } from "./files";
import { getSettings } from "./settings";
import { env } from "./env";

/**
 * Fon jarayoni: navbatdagi generatsiyalarni oladi va qadamlarni birma-bir bajaradi.
 * Holat bazada saqlanadi, shuning uchun server qayta ishga tushsa ham ish davom etadi.
 * Eslatma: bitta server nusxasi uchun mo'ljallangan (bir nechta nusxada Redis navbati kerak bo'ladi).
 */
const TICK_MS = 3000;
const inFlight = new Set<string>();
const TEMPLATE_VIDEO_TTL_MS = 3 * 86_400_000;

const log = (...a: unknown[]) => console.log("[worker]", ...a);

async function claimQueued() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(generations).where(eq(generations.status, "processing"));
  const free = env.workerConcurrency - count;
  if (free <= 0) return;
  await db.execute(sql`
    update generations set status = 'processing', started_at = now(), locked_at = now()
    where id in (
      select id from generations where status = 'queued' order by created_at limit ${free} for update skip locked
    )`);
}

async function failGeneration(gen: Generation, reason: string) {
  log("xato", gen.id, reason);
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(generations).where(eq(generations.id, gen.id)).for("update");
    if (!cur || cur.status === "failed" || cur.status === "succeeded") return;
    await tx.update(generations).set({ status: "failed", error: reason.slice(0, 1000), finishedAt: new Date(), currentRequestId: null })
      .where(eq(generations.id, gen.id));
    await refundCredits(tx, cur.userId, cur.creditAllocations, "Generatsiya muvaffaqiyatsiz — kredit qaytarildi", `gen:${cur.id}`);
  });
}

async function ensureTemplateVideoUrl(t: Template) {
  if (!t.sourceVideoPath) return null;
  const fresh = t.sourceFalUrl && t.sourceFalUploadedAt && Date.now() - t.sourceFalUploadedAt.getTime() < TEMPLATE_VIDEO_TTL_MS;
  if (fresh && (ai.name === "fal") === !t.sourceFalUrl!.startsWith("local:")) return t.sourceFalUrl!;
  const url = await ai.uploadFile(t.sourceVideoPath);
  await db.update(templates).set({ sourceFalUrl: url, sourceFalUploadedAt: new Date() }).where(eq(templates.id, t.id));
  return url;
}

async function finalize(gen: Generation, t: Template, results: StepResult[]) {
  const outputs: { path: string; type: "video" | "image" }[] = [];
  for (const idx of finalStepIndexes(t.steps)) {
    const r = results[idx];
    if (!r) continue;
    const path = await downloadToPrivate(r.url, "private/outputs", `${gen.id}_${idx}`, r.type === "video" ? "mp4" : "png");
    outputs.push({ path, type: r.type });
  }
  if (!outputs.length) throw new Error("Natija fayli topilmadi");
  await db.update(generations).set({
    status: "succeeded", outputs, stepResults: results, finishedAt: new Date(), currentRequestId: null,
    costUsd: estimateCostUsd(t.steps),
  }).where(eq(generations.id, gen.id));
  await db.update(templates).set({ usageCount: sql`${templates.usageCount} + 1` }).where(eq(templates.id, t.id));
  log("tayyor", gen.id);
}

async function advance(gen: Generation) {
  const settings = await getSettings();
  if (gen.startedAt && Date.now() - gen.startedAt.getTime() > settings.generationTimeoutMinutes * 60_000) {
    return failGeneration(gen, "Vaqt tugadi: AI javob bermadi");
  }
  const [t] = gen.templateId ? await db.select().from(templates).where(eq(templates.id, gen.templateId)) : [];
  if (!t) return failGeneration(gen, "Shablon topilmadi");
  if (!t.steps.length) return failGeneration(gen, "Shablonda qadamlar yo'q");

  // 1) Mijoz rasmini AI serveriga yuklash (bir marta)
  let inputUrl = gen.inputFalUrl;
  if (!inputUrl) {
    if (!gen.inputPath) return failGeneration(gen, "Mijoz rasmi topilmadi");
    inputUrl = await ai.uploadFile(gen.inputPath);
    await db.update(generations).set({ inputFalUrl: inputUrl }).where(eq(generations.id, gen.id));
  }

  // 1b) Qo'shimcha rasmlar (ko'p personajli shablonlar)
  let extras = gen.extraInputs;
  if (extras.some((x) => !x.falUrl)) {
    extras = await Promise.all(extras.map(async (x) => (x.falUrl ? x : { ...x, falUrl: await ai.uploadFile(x.path) })));
    await db.update(generations).set({ extraInputs: extras }).where(eq(generations.id, gen.id));
  }

  const results = [...gen.stepResults];
  const step = t.steps[gen.stepIndex];

  // 2) Qadam hali yuborilmagan bo'lsa — yuboramiz
  if (!gen.currentRequestId) {
    const templateVideo = usesTemplateVideo([step]) ? await ensureTemplateVideoUrl(t) : null;
    const input = resolveInput(step.input, {
      user_image: inputUrl, extra_images: extras.map((x) => x.falUrl!), template_video: templateVideo, results,
    }) as Record<string, unknown>;
    const isVideoPreview = t.previewPath && /\.(mp4|webm|mov)$/i.test(t.previewPath);
    const requestId = await ai.submit(step.endpoint, input, {
      mockVideoPath: isVideoPreview ? t.previewPath : t.sourceVideoPath && /\.(mp4|webm|mov)$/i.test(t.sourceVideoPath) ? t.sourceVideoPath : null,
    });
    await db.update(generations).set({ currentRequestId: requestId, currentEndpoint: step.endpoint, lockedAt: new Date() })
      .where(eq(generations.id, gen.id));
    log("yuborildi", gen.id, `qadam ${gen.stepIndex + 1}/${t.steps.length}`, step.endpoint);
    return;
  }

  // 3) Natijani tekshiramiz
  const res = await ai.check(gen.currentEndpoint || step.endpoint, gen.currentRequestId);
  if (res.status === "pending") return;
  if (res.status === "error") {
    if (gen.attempts < 1) {
      log("qayta urinish", gen.id, res.error);
      await db.update(generations).set({ currentRequestId: null, attempts: gen.attempts + 1 }).where(eq(generations.id, gen.id));
      return;
    }
    return failGeneration(gen, `AI xatoligi: ${res.error}`);
  }
  const url = extractOutputUrl(res.data, step.output);
  if (!url) return failGeneration(gen, `AI natijasida ${step.output} topilmadi`);
  results.push({ url, type: step.output, requestId: gen.currentRequestId });

  if (gen.stepIndex + 1 < t.steps.length) {
    await db.update(generations).set({ stepResults: results, stepIndex: gen.stepIndex + 1, currentRequestId: null, attempts: 0 })
      .where(eq(generations.id, gen.id));
    return;
  }
  await finalize(gen, t, results);
}

async function tick() {
  await claimQueued();
  const active = await db.select().from(generations).where(eq(generations.status, "processing"));
  await Promise.all(active.filter((g) => !inFlight.has(g.id)).map(async (g) => {
    inFlight.add(g.id);
    try { await advance(g); }
    catch (e) { await failGeneration(g, (e as Error).message || "Noma'lum xatolik"); }
    finally { inFlight.delete(g.id); }
  }));
}

/** Eski mijoz rasmlarini o'chirish (shaxsiy ma'lumotlarni himoya qilish) */
async function cleanup() {
  const s = await getSettings();
  const cutoff = new Date(Date.now() - s.inputRetentionHours * 3_600_000);
  const old = await db.select({ id: generations.id, inputPath: generations.inputPath, extraInputs: generations.extraInputs }).from(generations)
    .where(and(eq(generations.inputDeleted, false), lt(generations.createdAt, cutoff), inArray(generations.status, ["succeeded", "failed"])))
    .limit(500);
  for (const g of old) {
    await deleteFile(g.inputPath);
    for (const x of g.extraInputs) await deleteFile(x.path);
    await db.update(generations).set({ inputDeleted: true, inputPath: null, inputFalUrl: null, extraInputs: [] }).where(eq(generations.id, g.id));
  }
  if (old.length) log(`${old.length} ta eski rasm o'chirildi`);
}

export function startWorker() {
  log(`ishga tushdi (AI rejimi: ${ai.name})`);
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try { await tick(); } catch (e) { console.error("[worker]", e); } finally { running = false; }
  }, TICK_MS);
  cleanup().catch(console.error);
  setInterval(() => cleanup().catch(console.error), 3_600_000);
}
