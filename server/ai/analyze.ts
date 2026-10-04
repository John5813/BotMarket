import { env } from "../env";

/**
 * Shablon videosi/rasmini AI (vision model) orqali tahlil qilish:
 * personajlarni topadi, sahna va harakatni tasvirlaydi, nom va maslahat taklif qiladi.
 * Promptlar shu natijadan klient tomonda (shared/presets.ts → buildStepsFromAnalysis) yig'iladi,
 * admin ularni xohlagancha o'zgartirishi mumkin.
 */
export type AnalysisCharacter = {
  id: number;
  labelUz: string;
  descriptionEn: string;
  type: "human" | "animal";
  frame: number;
  box: [number, number, number, number] | null; // [ymin, xmin, ymax, xmax], 0–1000
  isMain: boolean;
};

export type TemplateAnalysis = {
  titleUz: string;
  descriptionUz: string;
  inputHintUz: string;
  recommendedKind: "character_replace" | "effect" | "photoshoot";
  allowAnimals: boolean;
  scene: string;
  motion: string;
  characters: AnalysisCharacter[];
  mainCharacterId: number | null;
  warningsUz: string[];
  model: string;
  mock?: boolean;
};

const SYSTEM_PROMPT = `You analyze template media for an AI video app. Users upload ONE selfie (or a pet photo) and the app puts them into this template.
You receive several frames (in order) of a template video, or a single template image.

Return ONLY a JSON object with exactly these keys:
{
  "titleUz": short catchy template title in Uzbek (Latin script), max 4 words,
  "descriptionUz": one sentence in Uzbek (Latin) telling the user what they will get,
  "inputHintUz": one short sentence in Uzbek (Latin) about what photo to upload (face close-up or full body, etc.),
  "recommendedKind": "character_replace" if the video is mainly one character performing movement (dance, walk, gestures) that should be copied exactly; "effect" if it is a cinematic scene/transformation better recreated from a photo; "photoshoot" for a single styled portrait image,
  "allowAnimals": true if a pet/animal photo could reasonably replace the main character (e.g. dances), else false,
  "scene": English description of the setting, lighting, camera framing and visual style (1–2 sentences),
  "motion": English description of what happens over time: actions, expressions, camera movement (1–2 sentences; for a still image describe a natural subtle motion),
  "characters": array of EVERY visible person or animal: {
     "id": integer starting at 1,
     "labelUz": short Uzbek (Latin) label, e.g. "Qizil ko'ylakdagi raqqosa",
     "descriptionEn": precise English description that identifies this character unambiguously (position, clothes, action),
     "type": "human" or "animal",
     "frame": index of the frame (0-based) where the character is most visible,
     "box": [ymin, xmin, ymax, xmax] of that character in that frame, integers normalized to 0–1000,
     "isMain": true for the single most prominent character
  },
  "mainCharacterId": id of the main character or null,
  "warningsUz": array of short Uzbek (Latin) warnings for the admin, e.g. several people present, face too small, fast camera cuts, text/logos/watermarks, copyrighted celebrities or music video. Empty array if none.
}`;

function clamp(n: unknown, lo: number, hi: number, d: number) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
}

function normalize(raw: any, frameCount: number, model: string): TemplateAnalysis {
  const kinds = ["character_replace", "effect", "photoshoot"] as const;
  const chars: AnalysisCharacter[] = (Array.isArray(raw?.characters) ? raw.characters : []).slice(0, 12).map((c: any, i: number) => {
    const b = Array.isArray(c?.box) && c.box.length === 4 ? c.box.map((v: unknown) => clamp(v, 0, 1000, 0)) : null;
    const box = b && b[2] > b[0] && b[3] > b[1] ? (b as [number, number, number, number]) : null;
    return {
      id: clamp(c?.id, 1, 99, i + 1),
      labelUz: String(c?.labelUz || `Personaj ${i + 1}`).slice(0, 80),
      descriptionEn: String(c?.descriptionEn || "the main character").slice(0, 300),
      type: c?.type === "animal" ? "animal" : "human",
      frame: clamp(c?.frame, 0, Math.max(frameCount - 1, 0), 0),
      box,
      isMain: Boolean(c?.isMain),
    };
  });
  const mainId = chars.find((c) => c.id === Number(raw?.mainCharacterId))?.id ?? chars.find((c) => c.isMain)?.id ?? chars[0]?.id ?? null;
  return {
    titleUz: String(raw?.titleUz || "Yangi shablon").slice(0, 80),
    descriptionUz: String(raw?.descriptionUz || "").slice(0, 300),
    inputHintUz: String(raw?.inputHintUz || "").slice(0, 200),
    recommendedKind: kinds.includes(raw?.recommendedKind) ? raw.recommendedKind : "effect",
    allowAnimals: Boolean(raw?.allowAnimals),
    scene: String(raw?.scene || "").slice(0, 600),
    motion: String(raw?.motion || "").slice(0, 600),
    characters: chars.map((c) => ({ ...c, isMain: c.id === mainId })),
    mainCharacterId: mainId,
    warningsUz: (Array.isArray(raw?.warningsUz) ? raw.warningsUz : []).map(String).slice(0, 6),
    model,
  };
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Kalit bo'lmaganda interfeysni sinash uchun namunaviy natija */
function mockAnalysis(mediaType: "video" | "image"): TemplateAnalysis {
  return normalize({
    titleUz: mediaType === "video" ? "Yangi raqs" : "Yangi portret",
    descriptionUz: "Siz ham shu videodagi qahramon kabi harakat qilasiz!",
    inputHintUz: "Butun gavdangiz yoki yuzingiz aniq ko'ringan rasm yuklang",
    recommendedKind: mediaType === "video" ? "character_replace" : "effect",
    allowAnimals: mediaType === "video",
    scene: "A colorful studio background with soft bokeh lights, vertical 9:16 framing, vibrant cinematic style.",
    motion: "The character dances energetically in place, smiling, while the camera slowly pushes in.",
    characters: [{ id: 1, labelUz: "Markazdagi qahramon", descriptionEn: "the character in the center of the frame", type: "human", frame: 0, box: [300, 250, 700, 750], isMain: true }],
    mainCharacterId: 1,
    warningsUz: ["Bu SINOV tahlili: OPENROUTER_API_KEY ulanmagan, natija haqiqiy emas"],
  }, 1, "mock");
}

export async function analyzeTemplateMedia(frames: string[], mediaType: "video" | "image"): Promise<TemplateAnalysis> {
  if (!env.openrouter.key) return { ...mockAnalysis(mediaType), mock: true };

  const content = [
    { type: "text", text: `Media type: ${mediaType}. ${frames.length} frame(s) follow in chronological order (frame 0 first).` },
    ...frames.map((url) => ({ type: "image_url", image_url: { url } })),
  ];
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openrouter.key}`,
      "HTTP-Referer": env.publicUrl,
      "X-Title": "AIKadr admin",
    },
    body: JSON.stringify({
      model: env.openrouter.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`AI tahlil xatosi (${res.status}): ${data?.error?.message || "noma'lum"}`);
  const text: string = data?.choices?.[0]?.message?.content || "";
  try {
    return normalize(parseJson(text), frames.length, env.openrouter.model);
  } catch {
    throw new Error("AI javobini o'qib bo'lmadi. Qayta urinib ko'ring yoki qo'lda kiriting");
  }
}
