import type { PipelineStep, StepResult } from "@shared/schema";
export { estimateCostUsd } from "@shared/recipe";

export type PipelineVars = {
  user_image: string;
  /** 2-, 3-... rasmlar ({{user_image_2}}, {{user_image_3}}) */
  extra_images?: string[];
  /** Shablon videosining 1-kadri (muqova rasm) */
  template_frame?: string | null;
  template_video?: string | null;
  results: StepResult[];
};

/** Kirish qiymatlaridagi {{...}} o'rinbosarlarini haqiqiy URL'lar bilan almashtiradi */
export function resolveInput(value: unknown, vars: PipelineVars): unknown {
  if (typeof value === "string") {
    const whole = value.match(/^\{\{\s*([\w]+)\s*\}\}$/);
    if (whole) return lookup(whole[1], vars);
    return value.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, k) => String(lookup(k, vars)));
  }
  if (Array.isArray(value)) return value.map((v) => resolveInput(v, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveInput(v, vars)]));
  }
  return value;
}

function lookup(key: string, vars: PipelineVars): string {
  if (key === "user_image" || key === "user_image_1") return vars.user_image;
  const ui = key.match(/^user_image_(\d+)$/);
  if (ui) {
    const url = vars.extra_images?.[Number(ui[1]) - 2];
    if (!url) throw new Error(`{{${key}}} uchun rasm yuklanmagan`);
    return url;
  }
  if (key === "template_video" || key === "template_image") {
    if (!vars.template_video) throw new Error(`Shablonda asl media yuklanmagan ({{${key}}})`);
    return vars.template_video;
  }
  if (key === "template_frame") {
    if (!vars.template_frame) throw new Error("Shablonda muqova (1-kadr) rasmi yo'q ({{template_frame}})");
    return vars.template_frame;
  }
  if (key === "prev") {
    const last = vars.results[vars.results.length - 1];
    if (!last) throw new Error("{{prev}} birinchi qadamda ishlatilgan");
    return last.url;
  }
  const m = key.match(/^step_(\d+)$/);
  if (m) {
    const r = vars.results[Number(m[1])];
    if (!r) throw new Error(`{{${key}}} hali tayyor emas`);
    return r.url;
  }
  throw new Error(`Noma'lum o'rinbosar: {{${key}}}`);
}

/** Turli modellar natijani turlicha qaytaradi — umumiy shakllardan URL'ni topamiz */
export function extractOutputUrl(data: unknown, type: "video" | "image"): string | null {
  const d = data as Record<string, any>;
  if (!d || typeof d !== "object") return null;
  if (type === "video") {
    return d.video?.url || d.videos?.[0]?.url || d.output?.video?.url || (typeof d.video === "string" ? d.video : null) || null;
  }
  return d.images?.[0]?.url || d.image?.url || d.output?.images?.[0]?.url || (typeof d.image === "string" ? d.image : null) || null;
}

export function finalStepIndexes(steps: PipelineStep[]) {
  const marked = steps.map((s, i) => (s.final ? i : -1)).filter((i) => i >= 0);
  return marked.length ? marked : [steps.length - 1];
}

/** Retsept shablonning asl mediasini ({{template_video}} yoki {{template_image}}) ishlatadimi */
export function usesTemplateVideo(steps: PipelineStep[]) {
  const s = JSON.stringify(steps);
  return s.includes("{{template_video}}") || s.includes("{{template_image}}");
}

/** Admin kiritgan qadamlarni tekshirish */
export function validateSteps(steps: unknown): { ok: true; steps: PipelineStep[] } | { ok: false; error: string } {
  if (!Array.isArray(steps) || steps.length === 0) return { ok: false, error: "Kamida bitta qadam bo'lishi kerak" };
  if (steps.length > 12) return { ok: false, error: "Qadamlar soni 12 tadan oshmasin" };
  for (const [i, s] of steps.entries()) {
    if (!s || typeof s !== "object") return { ok: false, error: `${i + 1}-qadam noto'g'ri` };
    if (typeof s.endpoint !== "string" || !/^[\w.-]+\/[\w./-]+$/.test(s.endpoint)) return { ok: false, error: `${i + 1}-qadam: model nomi (endpoint) noto'g'ri` };
    if (s.output !== "video" && s.output !== "image") return { ok: false, error: `${i + 1}-qadam: natija turi "video" yoki "image" bo'lishi kerak` };
    if (!s.input || typeof s.input !== "object" || Array.isArray(s.input)) return { ok: false, error: `${i + 1}-qadam: input obyekt bo'lishi kerak` };
    if (i === 0 && JSON.stringify(s.input).includes("{{prev}}")) return { ok: false, error: "1-qadamda {{prev}} ishlatib bo'lmaydi" };
    for (const k of ["costUsd", "costPerSecUsd"] as const) {
      if (s[k] !== undefined && (typeof s[k] !== "number" || !Number.isFinite(s[k]) || s[k] < 0)) return { ok: false, error: `${i + 1}-qadam: narx noto'g'ri` };
    }
  }
  return { ok: true, steps: steps as PipelineStep[] };
}

/** Retseptda ishlatilgan eng katta mijoz rasmi raqami ({{user_image_3}} → 3) */
export function maxUserImageIndex(steps: PipelineStep[]) {
  let max = 1;
  for (const m of JSON.stringify(steps).matchAll(/\{\{\s*user_image_(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

export function usesTemplateFrame(steps: PipelineStep[]) {
  return JSON.stringify(steps).includes("{{template_frame}}");
}

/** Generatsiya uchun variant retsepti: null — asosiy, aks holda variants[].key */
export function stepsForVariant(t: { steps: PipelineStep[]; variants?: { key: string; steps: PipelineStep[] }[] }, key?: string | null) {
  if (!key) return t.steps;
  return t.variants?.find((v) => v.key === key)?.steps ?? [];
}
