import type { PipelineStep, TemplateVariant } from "./schema";

/**
 * Admin paneldagi tayyor "retseptlar". Admin shablon turini tanlaganda
 * qadamlar shu yerdan to'ldiriladi, keyin xohlagancha o'zgartirish mumkin.
 *
 * Model nomlari — fal.ai endpoint identifikatorlari. Parametrlar @fal-ai/client SDK
 * turlaridagi rasmiy sxemalar bilan tekshirilgan. Narxlar taxminiy (fal.ai narxlari
 * o'zgarib turadi — admin paneldagi qadamda yangilash mumkin):
 *   Kling v3 Pro Motion Control      ~$0.168 / soniya (Standard ~$0.126)
 *   Kling O3 Pro Video Edit          ~$0.168 / soniya (3–10 s)
 *   Wan 2.2 Animate Replace (720p)   ~$0.08 / soniya
 *   Half Moon Face Swap Video        $0.0008 / kadr (~$0.024 / soniya, 30 fps)
 *   Nano Banana 2 Edit               ~$0.08 / rasm
 *   Kling 2.5 Turbo Pro image→video  ~$0.07 / soniya
 */

// ---------------------------------------------------------------------------
// Prompt bloklari
// ---------------------------------------------------------------------------
export type Outfit = "template" | "user";

const IDENTITY =
  "Use their exact face, facial features, skin tone, hairstyle and hair color so they are clearly recognizable as the same person.";

/**
 * Videoning 1-kadridagi personajni mijoz bilan almashtirish (Motion Control'ning 1-qadami).
 * Rasm tartibi: Image 1 — video kadri, Image 2 — mijoz rasmi.
 * Qisqa va aniq: nima o'zgaradi (shaxs) va nima aynan qoladi (poza, kadr, fon, yorug'lik).
 */
export function frameSwapPrompt(who: string, opts: { outfit?: Outfit; allowAnimals?: boolean; extra?: string } = {}) {
  const outfit = opts.outfit === "user"
    ? "Dress them in the clothes they wear in Image 2, completing any hidden parts naturally in the same style."
    : "Keep the outfit from Image 1 and fit it naturally to the new person (if their gender or body type differs, adapt the outfit while keeping its style and colors).";
  const pet = opts.allowAnimals
    ? " If Image 2 shows a pet instead of a person, place that animal in the same position and pose as naturally as possible, keeping its exact fur color and markings."
    : "";
  return [
    "Image 1 is a still frame from a video. Image 2 is a photo of a new person.",
    `Replace ${who} in Image 1 with the person from Image 2. ${IDENTITY}`,
    "Keep everything else in Image 1 exactly as it is: body pose, hand and limb positions, body size and position in the frame, camera angle, framing, background, lighting, color grading and all other people.",
    outfit + pet,
    opts.extra?.trim() || "",
    "Photorealistic, natural skin texture, sharp face, no text, no borders. Output only the edited Image 1.",
  ].filter(Boolean).join(" ");
}

/** Kling Motion Control prompti. @Element1 — mijoz yuzi (yuz o'xshashligini kuchaytiradi) */
export function motionPrompt(opts: { faceElement: boolean; extra?: string }) {
  const who = opts.faceElement ? "@Element1" : "The person from the reference image";
  const keep = opts.faceElement
    ? "Keep @Element1's face, hairstyle and identity consistent and recognizable in every frame."
    : "Keep their face and identity consistent in every frame.";
  return [
    `${who} performs the exact movements from the reference video.`,
    keep,
    "Keep the outfit, background and lighting from the reference image. Realistic, natural motion and facial expressions, sharp details.",
    opts.extra?.trim() || "",
  ].filter(Boolean).join(" ");
}

export const MOTION_CONTROL_ENDPOINT = "fal-ai/kling-video/v3/pro/motion-control";
export const IMAGE_EDIT_ENDPOINT = "fal-ai/nano-banana-2/edit";
export const MULTI_EDIT_ENDPOINT = "fal-ai/kling-video/o3/pro/video-to-video/edit";

/**
 * "Butun personaj" retsepti (viral AI character swap):
 *  1) videoning 1-kadrida personaj mijoz bilan almashtiriladi (rasm AI),
 *  2) Kling Motion Control shu kadrni asl video harakati bilan jonlantiradi, ovoz saqlanadi.
 */
export function buildMotionControlSteps(opts: {
  who?: string; aspectRatio?: string; outfit?: Outfit; allowAnimals?: boolean; extra?: string;
} = {}): PipelineStep[] {
  // Hayvon rasmida yuz elementi ishlamasligi mumkin — faqat odamlar uchun bog'laymiz
  const faceElement = !opts.allowAnimals;
  return [
    {
      label: "1-kadrda personajni almashtirish",
      endpoint: IMAGE_EDIT_ENDPOINT,
      input: {
        prompt: frameSwapPrompt(opts.who || "the main person", { outfit: opts.outfit, allowAnimals: opts.allowAnimals, extra: opts.extra }),
        image_urls: ["{{template_frame}}", "{{user_image}}"],
        aspect_ratio: opts.aspectRatio || "9:16",
        resolution: "1K",
        limit_generations: true,
        output_format: "png",
      },
      output: "image",
      costUsd: 0.08,
    },
    {
      label: "Harakatni o'tkazish (Motion Control)",
      endpoint: MOTION_CONTROL_ENDPOINT,
      input: {
        image_url: "{{prev}}",
        video_url: "{{template_video}}",
        character_orientation: "video",
        keep_original_sound: true,
        ...(faceElement ? { elements: [{ frontal_image_url: "{{user_image}}" }] } : {}),
        prompt: motionPrompt({ faceElement }),
      },
      output: "video",
      costPerSecUsd: 0.168,
    },
  ];
}

/** Effekt: mijozni yangi sahnaga joylash prompti (rasm AI) */
export function sceneImagePrompt(scene: string, extra?: string) {
  return [
    "Use the person from the photo as the main subject.",
    scene.trim(),
    "Keep their exact face, facial features, skin tone, hairstyle and identity so they are clearly recognizable.",
    "Realistic body proportions, natural pose, photorealistic, cinematic lighting, no text.",
    extra?.trim() || "",
  ].filter(Boolean).join(" ");
}

const I2V_NEGATIVE = "blur, distortion, low quality, deformed face, extra limbs, flicker, text, watermark";

function imageToVideoStep(motion: string): PipelineStep {
  return {
    label: "Jonlantirish",
    endpoint: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    input: { prompt: motion, image_url: "{{prev}}", duration: "5", negative_prompt: I2V_NEGATIVE },
    output: "video",
    costPerSecUsd: 0.07,
  };
}

function sceneStep(scene: string, aspectRatio = "9:16", extra?: string): PipelineStep {
  return {
    label: "Sahnaga joylash",
    endpoint: IMAGE_EDIT_ENDPOINT,
    input: { prompt: sceneImagePrompt(scene, extra), image_urls: ["{{user_image}}"], aspect_ratio: aspectRatio, limit_generations: true },
    output: "image",
    costUsd: 0.08,
  };
}

/** Effekt retsepti: rasm → sahna → video */
export function buildEffectSteps(scene: string, motion: string, opts: { aspectRatio?: string; extra?: string } = {}): PipelineStep[] {
  return [sceneStep(scene, opts.aspectRatio, opts.extra), imageToVideoStep(motion)];
}

function multiPrompt(pairs: string[], extra?: string) {
  const list = pairs.length > 1 ? `${pairs.slice(0, -1).join(", ")} and ${pairs[pairs.length - 1]}` : pairs[0];
  return [
    `In @Video1, replace ${list}.`,
    "Each new person must keep the exact face, facial features, skin tone, hairstyle and identity from their reference image.",
    "Keep the original motion, timing, poses, camera movement, background, lighting and outfits. Do not change any other people. Photorealistic.",
    extra?.trim() || "",
  ].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Tayyor retseptlar
// ---------------------------------------------------------------------------
export const PIPELINE_PRESETS: Record<
  "motion_control" | "character_replace" | "multi_character" | "effect" | "photoshoot",
  { title: string; description: string; needsSourceVideo: boolean; steps: PipelineStep[] }
> = {
  motion_control: {
    title: "Butun personaj — Motion Control (viral uslub)",
    description:
      "1-qadam: videoning 1-kadridagi odam mijoz bilan almashtiriladi (yuz, soch, gavda). 2-qadam: Kling Motion Control shu kadrni asl videodagi harakat bilan jonlantiradi, musiqa saqlanadi; mijoz yuzi qo'shimcha \"bog'lanadi\" (@Element1). Asl video MP4/MOV, 3–30 soniya, bitta uzluksiz kadr (montajsiz) bo'lsin.",
    needsSourceVideo: true,
    steps: buildMotionControlSteps(),
  },
  character_replace: {
    title: "Qahramonni almashtirish — Wan (arzonroq, hayvonlar ham)",
    description:
      "Shablon videodagi odam o'rniga mijoz rasmi (odam yoki hayvon) qo'yiladi. Harakat, kamera va yorug'lik saqlanadi. Motion Control'dan arzonroq, lekin yuz o'xshashligi biroz pastroq.",
    needsSourceVideo: true,
    steps: [
      {
        label: "Qahramonni almashtirish",
        endpoint: "fal-ai/wan/v2.2-14b/animate/replace",
        input: { video_url: "{{template_video}}", image_url: "{{user_image}}", resolution: "720p", video_quality: "high" },
        output: "video",
        costPerSecUsd: 0.08,
      },
    ],
  },
  multi_character: {
    title: "Ko'p personajli video (2–4 kishi)",
    description:
      "Videodagi bir nechta personaj mijozlar rasmlari bilan almashtiriladi, harakat, kamera va ovoz saqlanadi (Kling O3 Video Edit). Asl video MP4/MOV, 3–10 soniya, ikkala tomoni kamida 720 piksel bo'lishi shart. Promptda @Video1 — asl video, @Image1, @Image2 — mijoz rasmlari tartibi.",
    needsSourceVideo: true,
    steps: [
      {
        label: "Personajlarni almashtirish",
        endpoint: MULTI_EDIT_ENDPOINT,
        input: {
          prompt: multiPrompt(["the person on the left with the person from @Image1", "the person on the right with the person from @Image2"]),
          video_url: "{{template_video}}",
          image_urls: ["{{user_image_1}}", "{{user_image_2}}"],
          keep_audio: true,
        },
        output: "video",
        costPerSecUsd: 0.168,
      },
    ],
  },
  effect: {
    title: "Effekt (rasm → sahna → video)",
    description:
      "1-qadam mijozni kerakli sahnaga joylaydi, 2-qadam rasmni jonlantiradi. Promptlarni shablonga moslab yozing (ingliz tilida yaxshiroq ishlaydi).",
    needsSourceVideo: false,
    steps: buildEffectSteps(
      "Place them in a crowded baseball stadium, wearing a blue cap, looking at the camera.",
      "The person notices they are on the big screen, smiles shyly and waves, the crowd cheers, the broadcast camera slowly zooms in",
    ),
  },
  photoshoot: {
    title: "AI fotosessiya (bir nechta rasm)",
    description: "Har bir qadam alohida uslubdagi rasm yaratadi. Barcha rasmlar mijozga beriladi.",
    needsSourceVideo: false,
    steps: [
      "Professional studio portrait on a plain light grey background, soft key light, wearing a black turtleneck.",
      "Golden hour portrait in an autumn park, warm tones, shallow depth of field.",
      "Street style photo in a modern city at night, neon lights, cinematic.",
      "Elegant portrait in traditional Uzbek atlas (ikat) clothing, warm studio light.",
    ].map((scene, i) => ({
      label: `Rasm ${i + 1}`,
      endpoint: IMAGE_EDIT_ENDPOINT,
      input: { prompt: sceneImagePrompt(scene), image_urls: ["{{user_image}}"], aspect_ratio: "3:4", limit_generations: true },
      output: "image" as const,
      final: true,
      costUsd: 0.08,
    })),
  },
};

export const KIND_LABELS: Record<string, string> = {
  motion_control: "Butun personaj (Motion Control)",
  character_replace: "Qahramon almashtirish (Wan)",
  multi_character: "Ko'p personajli video",
  effect: "Effekt",
  photoshoot: "Fotosessiya",
  custom: "Maxsus",
};

/**
 * Arzon variant: faqat yuz almashtiriladi (kiyim, gavda va sahna asl videodagidek qoladi).
 * Half Moon Face Swap Video: source_face_url — mijoz yuzi, target_video_url — asl video.
 */
export const FACE_SWAP_VARIANT: TemplateVariant = {
  key: "face",
  label: "Faqat yuz",
  hint: "Arzon va tez — faqat yuz almashtiriladi, kiyim va gavda asl videodagidek qoladi",
  creditCost: 1,
  steps: [
    {
      label: "Yuzni almashtirish",
      endpoint: "half-moon-ai/ai-face-swap/faceswapvideo",
      input: { source_face_url: "{{user_image}}", target_video_url: "{{template_video}}" },
      output: "video",
      costPerSecUsd: 0.024,
    },
  ],
};

export const MAIN_VARIANT_LABEL = "Butun personaj";

export const STATUS_LABELS: Record<string, string> = {
  queued: "Navbatda",
  processing: "Tayyorlanmoqda",
  succeeded: "Tayyor",
  failed: "Xatolik",
  pending: "Kutilmoqda",
  paid: "To'langan",
  cancelled: "Bekor qilingan",
  refunded: "Qaytarilgan",
};

export function formatUzs(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n).replace(/,/g, " ") + " so'm";
}

// ---------------------------------------------------------------------------
// AI tahlil natijasidan retsept (qadamlar va promptlar) yig'ish.
// Admin keyin hammasini qo'lda o'zgartirishi mumkin.
// ---------------------------------------------------------------------------
export type AnalysisLike = {
  scene: string;
  motion: string;
  characters: { id: number; descriptionEn: string; type: "human" | "animal" }[];
  /** Admin ko'rsatmasidan kelgan qo'shimcha talablar — har bir promptga qo'shiladi */
  extraPromptEn?: string;
};

export function buildStepsFromAnalysis(
  a: AnalysisLike,
  opts: {
    mediaType: "video" | "image";
    kind: "motion_control" | "character_replace" | "effect" | "photoshoot";
    characterId: number | null;
    aspectRatio?: string;
    outfit?: Outfit;
    allowAnimals?: boolean;
  },
): PipelineStep[] {
  const ch = a.characters.find((c) => c.id === opts.characterId) || a.characters[0];
  const who = ch?.descriptionEn || "the main person";
  const extra = a.extraPromptEn?.trim() || "";
  const motion = [a.motion || "The person looks at the camera and smiles naturally, subtle camera push-in", extra].filter(Boolean).join(" ");

  if (opts.kind === "motion_control" && opts.mediaType === "video") {
    return buildMotionControlSteps({ who, aspectRatio: opts.aspectRatio, outfit: opts.outfit, allowAnimals: opts.allowAnimals || ch?.type === "animal", extra });
  }

  if (opts.kind === "character_replace" && opts.mediaType === "video") {
    return [{ ...PIPELINE_PRESETS.character_replace.steps[0], label: `Almashtirish: ${who}`.slice(0, 60) }];
  }

  if (opts.mediaType === "image") {
    // Shablon rasmidagi tanlangan personaj o'rniga mijoz qo'yiladi
    const swap: PipelineStep = {
      label: "Personajni almashtirish",
      endpoint: IMAGE_EDIT_ENDPOINT,
      input: {
        prompt: frameSwapPrompt(who, { outfit: opts.outfit, allowAnimals: opts.allowAnimals, extra }).replace("a still frame from a video", "a template photo"),
        image_urls: ["{{template_image}}", "{{user_image}}"],
        aspect_ratio: opts.aspectRatio || "auto",
        limit_generations: true,
      },
      output: "image",
      final: opts.kind === "photoshoot",
      costUsd: 0.08,
    };
    if (opts.kind === "photoshoot") return [swap];
    return [swap, imageToVideoStep(motion)];
  }

  // Video + effekt: sahna mijoz rasmidan qayta yaratiladi, keyin harakatlantiriladi
  return buildEffectSteps(
    `Place them into this scene as ${who}. Scene: ${a.scene || "the same setting as the template"}.`,
    motion,
    { aspectRatio: opts.aspectRatio, extra },
  );
}

/**
 * Ko'p personajli video: tanlangan personajlarning har biri mijozning alohida rasmi bilan almashtiriladi.
 * Tartib muhim: 1-tanlangan personaj → @Image1 → {{user_image_1}} va h.k.
 */
export function buildMultiCharacterSteps(a: AnalysisLike, characterIds: number[]): PipelineStep[] {
  const chosen = characterIds.map((id) => a.characters.find((c) => c.id === id)).filter(Boolean) as AnalysisLike["characters"];
  const pairs = chosen.map((c, i) => `${c.descriptionEn} with the person from @Image${i + 1}`);
  const base = PIPELINE_PRESETS.multi_character.steps[0];
  return [{
    ...base,
    input: {
      ...base.input,
      prompt: multiPrompt(pairs.length ? pairs : ["the main person with the person from @Image1"], a.extraPromptEn),
      image_urls: chosen.map((_, i) => `{{user_image_${i + 1}}}`),
    },
  }];
}
