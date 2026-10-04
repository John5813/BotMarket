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
  recommendedKind: "motion_control" | "multi_character" | "character_replace" | "effect" | "photoshoot";
  allowAnimals: boolean;
  scene: string;
  motion: string;
  /** Asosiy personaj kadrda qanday ko'rinadi — mijozdan qanday rasm so'rashni belgilaydi */
  framing: "full_body" | "upper_body" | "close_up";
  /** Kadrlar orasida montaj (sahna almashishi) bormi — Motion Control buni yoqtirmaydi */
  hasCuts: boolean;
  characters: AnalysisCharacter[];
  mainCharacterId: number | null;
  /** Admin ko'rsatmasiga ko'ra almashtiriladigan personajlar (tartib = mijoz rasmlari tartibi) */
  targetCharacterIds: number[];
  /** Admin ko'rsatmasidan kelib chiqqan qo'shimcha talablar (ingliz tilida), promptlarga qo'shiladi */
  extraPromptEn: string;
  /** AI admin ko'rsatmasini qanday tushungani (o'zbekcha) */
  instructionNoteUz: string;
  warningsUz: string[];
  model: string;
  mock?: boolean;
};

const SYSTEM_PROMPT = `You are a production assistant for an AI video app (like the "Shots" app). Customers upload a photo of themselves (or of their pet) and the app swaps them into a trending template video.
How the app generates videos:
- "motion_control" (default for videos): the main character is replaced in the FIRST frame by an image model, then Kling Motion Control re-animates that frame with the exact motion of the template video. Works best with ONE continuous shot (no cuts), a realistic person whose head and upper body (ideally full body) are clearly visible, not tiny, not heavily occluded, 3–30 seconds.
- "multi_character": 2–4 people in the video are each replaced by a different customer photo (Kling video edit). Needs MP4 3–10 s.
- "effect": the customer is placed into a new scene from their photo and animated (good for cinematic scenes, transformations, crowds, heavy camera moves or cuts).
- "photoshoot": a styled still image of the customer.
You receive several frames of a template video in chronological order, or a single template image.

Return ONLY a JSON object with exactly these keys:
{
  "titleUz": short catchy template title in Uzbek (Latin script), max 4 words,
  "descriptionUz": one sentence in Uzbek (Latin) telling the customer what they will get,
  "inputHintUz": one short sentence in Uzbek (Latin) telling the customer what photo to upload (e.g. a clear, well-lit photo where the face is fully visible; for full-body dances: a photo where the whole body is visible),
  "recommendedKind": one of "motion_control", "multi_character", "effect", "photoshoot" (see above; for a still template image use "effect" or "photoshoot"),
  "allowAnimals": true only if a pet photo could reasonably replace the main character (e.g. a funny dance), else false,
  "scene": English description of the setting, lighting, camera framing and visual style (1–2 sentences),
  "motion": English description of what happens over time: actions, expressions, camera movement (1–2 sentences; for a still image describe a natural subtle motion),
  "framing": "full_body", "upper_body" or "close_up" — how the main character is framed,
  "hasCuts": true if the frames show different shots/scene cuts (not one continuous shot), else false,
  "characters": array of EVERY clearly visible person or animal (ignore tiny background crowd): {
     "id": integer starting at 1,
     "labelUz": short Uzbek (Latin) label, e.g. "Qizil ko'ylakdagi raqqosa",
     "descriptionEn": precise English description that identifies this character unambiguously by position, clothing and action, e.g. "the young woman in the red dress in the center",
     "type": "human" or "animal",
     "frame": index of the frame (0-based) where the character is most visible,
     "box": [ymin, xmin, ymax, xmax] tightly around the whole character in that frame, integers normalized to 0–1000,
     "isMain": true for the single most prominent character
  },
  "mainCharacterId": id of the main character or null,
  "targetCharacterIds": array of character ids that should be replaced by the customer's photo(s), in order (first = customer photo 1). Follow the admin instruction if given; otherwise [mainCharacterId],
  "extraPromptEn": English text with extra requirements from the admin instruction to append to generation prompts (style, outfit, what to keep), or "" if none,
  "instructionNoteUz": one short Uzbek (Latin) sentence explaining how you understood the admin instruction, or "" if there was no instruction,
  "warningsUz": array of short, practical Uzbek (Latin) warnings for the admin, for example: scene cuts (trim to one continuous shot), the main character is small or partly hidden, very fast motion or motion blur, several similar people (make sure the right one is chosen), text/logos/watermarks that will stay in the result, a celebrity or copyrighted content, a child as the main character. Empty array if none.
}

If an ADMIN INSTRUCTION is given, it has priority: identify exactly the characters the admin describes (they may appear only in some frames, e.g. "the man in a suit in the next frame"), make sure each of them is in "characters" with an accurate box, put them into "targetCharacterIds" in the order the admin mentions them, and set "mainCharacterId" to the first one. If 2 or more targets are given for a video, use "multi_character". If you cannot find a described character, say so in "warningsUz".`;

function clamp(n: unknown, lo: number, hi: number, d: number) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
}

function normalize(raw: any, frameCount: number, model: string): TemplateAnalysis {
  const kinds = ["motion_control", "multi_character", "character_replace", "effect", "photoshoot"] as const;
  const framings = ["full_body", "upper_body", "close_up"] as const;
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
  const ids = new Set(chars.map((c) => c.id));
  const targets: number[] = [...new Set<number>((Array.isArray(raw?.targetCharacterIds) ? raw.targetCharacterIds : []).map(Number))]
    .filter((id) => ids.has(id)).slice(0, 4);
  const mainId = targets[0] ?? chars.find((c) => c.id === Number(raw?.mainCharacterId))?.id ?? chars.find((c) => c.isMain)?.id ?? chars[0]?.id ?? null;
  return {
    titleUz: String(raw?.titleUz || "Yangi shablon").slice(0, 80),
    descriptionUz: String(raw?.descriptionUz || "").slice(0, 300),
    inputHintUz: String(raw?.inputHintUz || "").slice(0, 200),
    recommendedKind: kinds.includes(raw?.recommendedKind) ? raw.recommendedKind : "effect",
    allowAnimals: Boolean(raw?.allowAnimals),
    scene: String(raw?.scene || "").slice(0, 600),
    motion: String(raw?.motion || "").slice(0, 600),
    framing: framings.includes(raw?.framing) ? raw.framing : "upper_body",
    hasCuts: Boolean(raw?.hasCuts),
    characters: chars.map((c) => ({ ...c, isMain: c.id === mainId })),
    mainCharacterId: mainId,
    targetCharacterIds: targets.length ? targets : mainId ? [mainId] : [],
    extraPromptEn: String(raw?.extraPromptEn || "").slice(0, 400),
    instructionNoteUz: String(raw?.instructionNoteUz || "").slice(0, 300),
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
function mockAnalysis(mediaType: "video" | "image", instruction: string): TemplateAnalysis {
  // Sinov: ko'rsatmada "o'ng" yoki "ikkinchi" so'zi bo'lsa — o'ngdagi personaj tanlangandek ko'rsatiladi
  const right = /o'ng|ong|ikkinchi|right|second/i.test(instruction);
  return normalize({
    targetCharacterIds: mediaType === "video" && right ? [2] : [1],
    extraPromptEn: instruction ? `Admin note: ${instruction}` : "",
    instructionNoteUz: instruction ? `SINOV: ko'rsatma qabul qilindi — ${right ? "o'ngdagi" : "chapdagi"} personaj tanlandi` : "",
    titleUz: mediaType === "video" ? "Yangi raqs" : "Yangi portret",
    descriptionUz: "Siz ham shu videodagi qahramon kabi harakat qilasiz!",
    inputHintUz: "Butun gavdangiz yoki yuzingiz aniq ko'ringan rasm yuklang",
    recommendedKind: mediaType === "video" ? "motion_control" : "effect",
    framing: "full_body",
    hasCuts: false,
    allowAnimals: mediaType === "video",
    scene: "A colorful studio background with soft bokeh lights, vertical 9:16 framing, vibrant cinematic style.",
    motion: "The character dances energetically in place, smiling, while the camera slowly pushes in.",
    characters: mediaType === "video"
      ? [
          { id: 1, labelUz: "Chapdagi qahramon", descriptionEn: "the person on the left side of the frame", type: "human", frame: 0, box: [280, 80, 760, 480], isMain: true },
          { id: 2, labelUz: "O'ngdagi qahramon", descriptionEn: "the person on the right side of the frame", type: "human", frame: 0, box: [300, 520, 760, 920], isMain: false },
        ]
      : [{ id: 1, labelUz: "Markazdagi qahramon", descriptionEn: "the character in the center of the frame", type: "human", frame: 0, box: [300, 250, 700, 750], isMain: true }],
    mainCharacterId: 1,
    warningsUz: ["Bu SINOV tahlili: OPENROUTER_API_KEY ulanmagan, natija haqiqiy emas"],
  }, 1, "mock");
}

export async function analyzeTemplateMedia(frames: string[], mediaType: "video" | "image", instruction = ""): Promise<TemplateAnalysis> {
  if (!env.openrouter.key) return { ...mockAnalysis(mediaType, instruction), mock: true };

  const content = [
    { type: "text", text: `Media type: ${mediaType}. ${frames.length} frame(s) follow in chronological order (frame 0 first).` +
      (instruction ? `\n\nADMIN INSTRUCTION (may be in Uzbek; follow it):\n"""${instruction}"""` : "") },
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
