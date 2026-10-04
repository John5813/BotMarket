/**
 * Boshlang'ich ma'lumotlar: kategoriyalar, DEMO shablonlar va tariflar.
 *   npm run seed
 * Qayta ishga tushirilsa mavjud yozuvlarga tegmaydi (slug bo'yicha tekshiradi).
 * DEMO videolar faqat namuna — haqiqiy shablon videolarini admin paneldan yuklang.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { categories, plans, templates, type PipelineStep } from "@shared/schema";
import { PIPELINE_PRESETS } from "@shared/presets";
import { saveBuffer } from "./files";

const ASSETS = path.resolve(import.meta.dirname, "seed-assets");

const CATEGORIES = [
  { slug: "trend", title: "Trenddagilar", emoji: "🔥", sortOrder: 0 },
  { slug: "raqslar", title: "Raqslar", emoji: "🕺", sortOrder: 1 },
  { slug: "hayvonlar", title: "Hayvonlar raqsga tushadi", emoji: "🐾", sortOrder: 2 },
  { slug: "effektlar", title: "Effektlar", emoji: "✨", sortOrder: 3 },
  { slug: "fotosessiya", title: "AI fotosessiya", emoji: "📸", sortOrder: 4 },
];

const effect = (scene: string, motion: string): PipelineStep[] => [
  { ...PIPELINE_PRESETS.effect.steps[0], input: { prompt: `${scene} Photorealistic, keep the exact same face and identity.`, image_urls: ["{{user_image}}"] } },
  { ...PIPELINE_PRESETS.effect.steps[1], input: { prompt: motion, image_url: "{{prev}}", duration: "5" } },
];

const TEMPLATES: Array<{
  slug: string; title: string; description: string; category: string; kind: "character_replace" | "effect" | "photoshoot";
  steps: PipelineStep[]; creditCost: number; allowAnimals?: boolean; featured?: boolean; isNew?: boolean; hint: string;
}> = [
  { slug: "lazgi", title: "Lazgi raqsi", category: "raqslar", kind: "character_replace", creditCost: 1, featured: true, isNew: true, allowAnimals: true,
    description: "Xorazmning mashhur lazgi raqsini siz ijro etasiz!", hint: "Butun gavdangiz ko'rinadigan, tik turgan rasm eng yaxshi natija beradi",
    steps: PIPELINE_PRESETS.character_replace.steps },
  { slug: "kocha-raqsi", title: "Ko'cha raqsi", category: "raqslar", kind: "character_replace", creditCost: 1, allowAnimals: true,
    description: "Trenddagi ko'cha raqsi harakatlari", hint: "Butun gavdangiz ko'rinadigan rasm yuklang", steps: PIPELINE_PRESETS.character_replace.steps },
  { slug: "raqschi-it", title: "Raqschi it", category: "hayvonlar", kind: "character_replace", creditCost: 1, allowAnimals: true, featured: true,
    description: "Itingiz yoki mushugingiz raqsga tushadi", hint: "Hayvon to'liq ko'rinadigan, tiniq rasm yuklang", steps: PIPELINE_PRESETS.character_replace.steps },
  { slug: "dj-mushuk", title: "DJ mushuk", category: "hayvonlar", kind: "character_replace", creditCost: 1, allowAnimals: true, isNew: true,
    description: "Uy hayvoningiz DJ pultida", hint: "Hayvonning yuzi aniq ko'rinsin", steps: PIPELINE_PRESETS.character_replace.steps },
  { slug: "stadion-kamerasi", title: "Stadion kamerasi", category: "trend", kind: "effect", creditCost: 1, featured: true,
    description: "Stadiondagi katta ekranda siz!", hint: "Yuzingiz to'g'ri qaragan, yorug' rasm yuklang",
    steps: effect("Place the person into a crowded baseball stadium, wearing a blue cap, looking at the camera.", "The person notices they are on the big screen, smiles shyly and waves, the crowd cheers, broadcast camera zooms in") },
  { slug: "bullet-time", title: "Bullet Time", category: "trend", kind: "effect", creditCost: 2, isNew: true,
    description: "Vaqt to'xtaydi, kamera atrofingizda aylanadi", hint: "Yuzingiz aniq ko'ringan rasm",
    steps: effect("Place the person on a city street at golden hour, sunglasses flying, coffee splashing in the air.", "Bullet time effect, everything freezes mid-air while the camera orbits 180 degrees around the person") },
  { slug: "toy-korteji", title: "To'y korteji", category: "effektlar", kind: "effect", creditCost: 1,
    description: "Gul bilan bezatilgan to'y mashinasida", hint: "Yuzingiz aniq ko'ringan rasm",
    steps: effect("Place the person in festive Uzbek wedding attire next to a white car decorated with flowers and ribbons.", "The person waves happily, the decorated car slowly drives, rose petals fall, celebration atmosphere") },
  { slug: "zombi", title: "Zombi", category: "effektlar", kind: "effect", creditCost: 1,
    description: "Bir necha soniyada zombiga aylaning", hint: "Yuzingiz to'g'ri qaragan rasm",
    steps: effect("Keep the person as is, standing in a foggy dark street at night.", "The person slowly transforms into a cinematic zombie, skin turns pale, eyes glow, dramatic lighting") },
  { slug: "studiya-fotosessiya", title: "Studiya portret", category: "fotosessiya", kind: "photoshoot", creditCost: 2,
    description: "4 xil uslubda professional portret", hint: "Yuzingiz aniq, yorug' joyda tushgan rasm", steps: PIPELINE_PRESETS.photoshoot.steps },
  { slug: "atlas-libos", title: "Atlas libosda", category: "fotosessiya", kind: "photoshoot", creditCost: 1,
    description: "Milliy atlas libosdagi portret", hint: "Yuzingiz aniq ko'ringan rasm",
    steps: [PIPELINE_PRESETS.photoshoot.steps[3]] },
];

const PLANS = [
  { title: "1 ta video", description: "Bir martalik sinab ko'rish", credits: 1, priceUzs: 15000, validityDays: 7, badge: "", sortOrder: 0 },
  { title: "Haftalik", description: "8 ta video, 7 kun amal qiladi", credits: 8, priceUzs: 99000, validityDays: 7, badge: "", sortOrder: 1 },
  { title: "Oylik", description: "30 ta video, 30 kun amal qiladi", credits: 30, priceUzs: 299000, validityDays: 30, badge: "Ommabop", sortOrder: 2 },
  { title: "Yillik", description: "360 ta video, 1 yil amal qiladi", credits: 360, priceUzs: 2990000, validityDays: 365, badge: "Eng foydali", sortOrder: 3 },
];

async function copyAsset(file: string, dir: string) {
  const buf = await fs.readFile(path.join(ASSETS, file));
  return saveBuffer(dir, buf, path.extname(file).slice(1));
}

const catIds: Record<string, number> = {};
for (const c of CATEGORIES) {
  const [ex] = await db.select().from(categories).where(eq(categories.slug, c.slug));
  catIds[c.slug] = ex ? ex.id : (await db.insert(categories).values(c).returning())[0].id;
}

let created = 0;
for (const [i, t] of TEMPLATES.entries()) {
  const [ex] = await db.select({ id: templates.id }).from(templates).where(eq(templates.slug, t.slug));
  if (ex) continue;
  await db.insert(templates).values({
    slug: t.slug, title: t.title, description: t.description, categoryId: catIds[t.category], kind: t.kind,
    previewPath: await copyAsset(`${t.slug}.webm`, "public/templates"),
    posterPath: await copyAsset(`${t.slug}.jpg`, "public/templates"),
    sourceVideoPath: t.kind === "character_replace" ? await copyAsset(`${t.slug}.webm`, "private/templates") : null,
    steps: t.steps, creditCost: t.creditCost, allowAnimals: !!t.allowAnimals, inputHint: t.hint,
    isActive: true, isFeatured: !!t.featured, isNew: !!t.isNew, sortOrder: i,
  });
  created++;
}

if ((await db.select({ id: plans.id }).from(plans)).length === 0) await db.insert(plans).values(PLANS);

console.log(`✅ Seed tayyor: ${CATEGORIES.length} kategoriya, ${created} yangi shablon, ${PLANS.length} tarif`);
await pool.end();
