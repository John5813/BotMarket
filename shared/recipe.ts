import type { PipelineStep, SourceMeta } from "./schema";

/**
 * Retseptni asl media bilan solishtirib tekshirish va tannarxni hisoblash.
 * Server (saqlashda) ham, admin panel (yozish paytida) ham shu funksiyalardan foydalanadi —
 * shunda pul sarflanadigan, lekin baribir xato beradigan generatsiyalar oldindan to'xtatiladi.
 * Cheklovlar fal.ai SDK turlaridagi rasmiy tavsiflardan olingan.
 */
export const DEFAULT_DURATION_SEC = 5;

const usesVar = (step: PipelineStep, name: string) => JSON.stringify(step.input).includes(`{{${name}}}`);

const KLING_EDIT = /kling-video\/o\d\/(?:standard\/|pro\/)?video-to-video\/(?:edit|reference)/;
const MOTION_CONTROL = /motion-control/;
/** Kirishida video kutadigan modellar */
const VIDEO_INPUT = /motion-control|video-to-video|animate\/(?:replace|move)|faceswapvideo|pixverse\/swap/;

/** Qadam natijasining taxminiy davomiyligi (soniya) — soniyasiga narxlanadigan modellar uchun */
export function stepDurationSec(step: PipelineStep, templateDurationSec?: number | null) {
  if (usesVar(step, "template_video")) return templateDurationSec && templateDurationSec > 0 ? templateDurationSec : DEFAULT_DURATION_SEC;
  const d = Number((step.input as Record<string, unknown>)?.duration);
  return Number.isFinite(d) && d > 0 ? d : DEFAULT_DURATION_SEC;
}

export function stepCostUsd(step: PipelineStep, templateDurationSec?: number | null) {
  const fixed = Number(step.costUsd) || 0;
  const perSec = Number(step.costPerSecUsd) || 0;
  if (!perSec) return fixed;
  let billed = stepDurationSec(step, templateDurationSec);
  // Kling O1/O3 tahriri 3–10 soniya oralig'ida hisoblanadi
  if (KLING_EDIT.test(step.endpoint)) billed = Math.min(Math.max(billed, 3), 10);
  return fixed + perSec * billed;
}

export function estimateCostUsd(steps: PipelineStep[], templateDurationSec?: number | null) {
  return Math.round(steps.reduce((s, x) => s + stepCostUsd(x, templateDurationSec), 0) * 1000) / 1000;
}

/**
 * Narx tavsiyasi: AI tannarxi tushumning ~50% idan oshmasin.
 * minCreditUzs — eng arzon tarifdagi 1 kredit narxi (masalan yillik tarif).
 */
export function recommendedCredits(costUsd: number, usdToUzs: number, minCreditUzs: number) {
  if (!minCreditUzs || costUsd <= 0) return 1;
  return Math.max(1, Math.ceil((costUsd * usdToUzs * 2) / minCreditUzs));
}

export type RecipeCheck = { errors: string[]; warnings: string[] };

/**
 * Retseptni asl media bilan tekshiradi.
 * ext — asl media kengaytmasi (mp4, mov, webm, jpg...), meta — brauzerda aniqlangan o'lcham va davomiylik.
 */
export function checkRecipe(steps: PipelineStep[], src: { ext?: string | null; meta?: SourceMeta | null; hasFrame?: boolean }): RecipeCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ext = (src.ext || "").toLowerCase();
  const meta = src.meta && src.meta.width > 0 ? src.meta : null;
  const isImageSource = ["jpg", "jpeg", "png", "webp"].includes(ext);
  const add = (list: string[], msg: string) => { if (!list.includes(msg)) list.push(msg); };

  steps.forEach((step, i) => {
    const n = `${i + 1}-qadam`;
    const input = step.input as Record<string, unknown>;
    const takesTemplateVideo = usesVar(step, "template_video") || usesVar(step, "template_image");

    if (takesTemplateVideo && VIDEO_INPUT.test(step.endpoint) && isImageSource) {
      add(errors, `${n}: bu model asl VIDEO talab qiladi, lekin asl media — rasm`);
    }

    if (KLING_EDIT.test(step.endpoint) && takesTemplateVideo) {
      if (ext && !["mp4", "mov"].includes(ext)) add(errors, `${n}: Kling O1/O3 faqat MP4 yoki MOV videoni qabul qiladi (hozir: ${ext.toUpperCase()})`);
      if (meta) {
        if (meta.durationSec > 0 && (meta.durationSec < 3 || meta.durationSec > 10.05)) add(errors, `${n}: Kling O1/O3 uchun video 3–10 soniya bo'lishi kerak (hozir: ${meta.durationSec.toFixed(1)} s)`);
        if (Math.min(meta.width, meta.height) < 720) add(errors, `${n}: Kling O1/O3 uchun videoning ikkala tomoni kamida 720 piksel bo'lsin (hozir: ${meta.width}×${meta.height})`);
        if (Math.max(meta.width, meta.height) > 2160) add(errors, `${n}: video 2160 pikseldan katta bo'lmasin (hozir: ${meta.width}×${meta.height})`);
      }
      const refs = (Array.isArray(input.image_urls) ? input.image_urls.length : 0) + (Array.isArray(input.elements) ? input.elements.length : 0);
      if (refs > 4) add(errors, `${n}: Kling O1/O3 da rasmlar va elementlar jami 4 tadan oshmasin`);
    }

    if (MOTION_CONTROL.test(step.endpoint)) {
      const orientation = input.character_orientation;
      if (orientation !== "video" && orientation !== "image") add(errors, `${n}: character_orientation "video" yoki "image" bo'lishi shart`);
      if (Array.isArray(input.elements)) {
        if (input.elements.length > 1) add(errors, `${n}: Motion Control faqat 1 ta yuz elementini qabul qiladi`);
        if (orientation !== "video") add(errors, `${n}: yuzni bog'lash (elements) faqat character_orientation = "video" bo'lganda ishlaydi`);
      }
      if (takesTemplateVideo) {
        if (ext === "webm") add(warnings, `${n}: Kling Motion Control uchun MP4 yoki MOV video tavsiya etiladi (WEBM qabul qilinmasligi mumkin)`);
        const max = orientation === "image" ? 10 : 30;
        if (meta?.durationSec && meta.durationSec > max) add(errors, `${n}: "${orientation}" rejimida video ${max} soniyadan oshmasin (hozir: ${meta.durationSec.toFixed(1)} s) — videoni qisqartiring`);
        if (meta?.durationSec && meta.durationSec < 3) add(warnings, `${n}: video juda qisqa (${meta.durationSec.toFixed(1)} s) — kamida 3 soniya tavsiya etiladi`);
      }
      if (usesVar(step, "template_frame") && src.hasFrame === false) add(errors, `${n}: videoning 1-kadri saqlanmagan — asl videoni qayta yuklang`);
    }

    if (/faceswapvideo/.test(step.endpoint) && meta?.durationSec && meta.durationSec > 60) {
      add(warnings, `${n}: yuz almashtirish narxi kadrlar soniga bog'liq — uzun video qimmat tushadi`);
    }
  });

  if (meta?.durationSec && meta.durationSec > 15 && steps.some((s) => usesVar(s, "template_video") && (Number(s.costPerSecUsd) || 0) > 0)) {
    add(warnings, `Video ${meta.durationSec.toFixed(0)} soniya — tannarx soniyasiga hisoblanadi. Trend videolar uchun 5–10 soniya optimal`);
  }
  if (meta && Math.min(meta.width, meta.height) < 480 && steps.some((s) => usesVar(s, "template_video"))) {
    add(warnings, `Asl video sifati past (${meta.width}×${meta.height}) — natija ham xira chiqadi. Kamida 720p yuklang`);
  }
  return { errors, warnings };
}

/** fal.ai rasm modellari qabul qiladigan nisbatlardan eng yaqinini tanlaydi (masalan 720×1280 → "9:16") */
export function nearestAspectRatio(width: number, height: number) {
  const options = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"];
  if (!width || !height) return "9:16";
  const r = width / height;
  let best = options[0];
  let bestDiff = Infinity;
  for (const o of options) {
    const [a, b] = o.split(":").map(Number);
    const diff = Math.abs(Math.log(r / (a / b)));
    if (diff < bestDiff) { bestDiff = diff; best = o; }
  }
  return best;
}
