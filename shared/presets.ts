import type { PipelineStep, TemplateVariant } from "./schema";

/**
 * Admin paneldagi tayyor "retseptlar". Admin shablon turini tanlaganda
 * qadamlar shu yerdan to'ldiriladi, keyin xohlagancha o'zgartirish mumkin.
 * Model nomlari fal.ai endpoint identifikatorlari.
 */
export const PIPELINE_PRESETS: Record<
  "motion_control" | "character_replace" | "multi_character" | "effect" | "photoshoot",
  { title: string; description: string; needsSourceVideo: boolean; steps: PipelineStep[] }
> = {
  motion_control: {
    title: "Butun personaj — Motion Control (viral uslub)",
    description:
      "1-qadam: videoning birinchi kadridagi odam mijoz bilan almashtiriladi (rasm AI). 2-qadam: Kling Motion Control shu kadrni asl videodagi harakat bilan jonlantiradi. Asl video va poster (1-kadr) kerak — poster avtomatik olinadi.",
    needsSourceVideo: true,
    steps: [
      {
        label: "1-kadrda personajni almashtirish",
        endpoint: "fal-ai/nano-banana/edit",
        input: {
          prompt:
            "Replace the main person in the first image with the person from the second image (face, hair, body shape). Keep the exact same pose, position, framing, clothing style, lighting, background and composition of the first image. Photorealistic, high detail.",
          image_urls: ["{{template_frame}}", "{{user_image}}"],
        },
        output: "image",
        costUsd: 0.04,
      },
      {
        label: "Harakatni o'tkazish (Motion Control)",
        endpoint: "fal-ai/kling-video/v3/pro/motion-control",
        input: { image_url: "{{prev}}", video_url: "{{template_video}}", character_orientation: "video" },
        output: "video",
        costUsd: 0.6,
      },
    ],
  },
  character_replace: {
    title: "Qahramonni almashtirish (raqs, hayvon)",
    description:
      "Shablon videodagi odam o'rniga mijoz rasmi (odam yoki hayvon) qo'yiladi. Harakat, kamera va yorug'lik saqlanadi. Asl video yuklash shart.",
    needsSourceVideo: true,
    steps: [
      {
        label: "Qahramonni almashtirish",
        endpoint: "fal-ai/wan/v2.2-14b/animate/replace",
        input: { video_url: "{{template_video}}", image_url: "{{user_image}}", resolution: "720p" },
        output: "video",
        costUsd: 0.4,
      },
    ],
  },
  multi_character: {
    title: "Ko'p personajli video (2–4 kishi)",
    description:
      "Videodagi bir nechta personaj mijozlar rasmlari bilan almashtiriladi, harakat va kamera saqlanadi (Kling O1 Video Edit). Asl video MP4/MOV, 3–10 soniya, 720p+ bo'lishi shart. Promptda @Image1, @Image2 — mijoz rasmlari tartibi.",
    needsSourceVideo: true,
    steps: [
      {
        label: "Personajlarni almashtirish",
        endpoint: "fal-ai/kling-video/o1/video-to-video/edit",
        input: {
          prompt:
            "Replace the person on the left with @Image1 and the person on the right with @Image2. Keep the exact motion, timing, camera movement, background and lighting of the original video. Keep the exact face and identity of each referenced person.",
          video_url: "{{template_video}}",
          image_urls: ["{{user_image_1}}", "{{user_image_2}}"],
          keep_audio: true,
        },
        output: "video",
        costUsd: 1.0,
      },
    ],
  },
  effect: {
    title: "Effekt (rasm → sahna → video)",
    description:
      "1-qadam mijozni kerakli sahnaga joylaydi, 2-qadam rasmni harakatlantiradi. Promptlarni shablonga moslab yozing (ingliz tilida yaxshiroq ishlaydi).",
    needsSourceVideo: false,
    steps: [
      {
        label: "Sahnaga joylash",
        endpoint: "fal-ai/nano-banana/edit",
        input: {
          prompt:
            "Place the person from the photo into a crowded baseball stadium, wearing a blue cap, looking at the camera. Photorealistic, keep the exact same face.",
          image_urls: ["{{user_image}}"],
        },
        output: "image",
        costUsd: 0.04,
      },
      {
        label: "Jonlantirish",
        endpoint: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
        input: {
          prompt: "The person notices the camera, smiles shyly and waves, crowd cheering, broadcast camera slowly zooms in",
          image_url: "{{prev}}",
          duration: "5",
        },
        output: "video",
        costUsd: 0.35,
      },
    ],
  },
  photoshoot: {
    title: "AI fotosessiya (bir nechta rasm)",
    description: "Har bir qadam alohida uslubdagi rasm yaratadi. Barcha rasmlar mijozga beriladi.",
    needsSourceVideo: false,
    steps: [
      "Professional studio portrait on a plain light grey background, soft key light, wearing a black turtleneck",
      "Golden hour portrait in an autumn park, warm tones, shallow depth of field",
      "Street style photo in a modern city at night, neon lights, cinematic",
      "Elegant portrait in traditional Uzbek atlas (ikat) clothing, warm studio light",
    ].map((scene, i) => ({
      label: `Rasm ${i + 1}`,
      endpoint: "fal-ai/nano-banana/edit",
      input: { prompt: `${scene}. Keep the exact same face and identity as in the photo. Photorealistic.`, image_urls: ["{{user_image}}"] },
      output: "image" as const,
      final: true,
      costUsd: 0.04,
    })),
  },
};

export const KIND_LABELS: Record<string, string> = {
  motion_control: "Butun personaj (Motion Control)",
  character_replace: "Qahramon almashtirish",
  multi_character: "Ko'p personajli video",
  effect: "Effekt",
  photoshoot: "Fotosessiya",
  custom: "Maxsus",
};

/**
 * Arzon variant: faqat yuz almashtiriladi (kiyim, gavda va sahna asl videodagidek qoladi).
 * Parametr nomlarini fal.ai sahifasida tekshirib oling — admin ularni tahrirlashi mumkin.
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
      costUsd: 0.15,
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
};

const KEEP_FACE = "Keep the exact face, identity, skin tone and hairstyle of the person from the user's photo. Photorealistic, high detail.";

export function buildStepsFromAnalysis(
  a: AnalysisLike,
  opts: { mediaType: "video" | "image"; kind: "motion_control" | "character_replace" | "effect" | "photoshoot"; characterId: number | null },
): PipelineStep[] {
  const ch = a.characters.find((c) => c.id === opts.characterId) || a.characters[0];
  const who = ch?.descriptionEn || "the main character";
  const motion = a.motion || "The person looks at the camera and smiles naturally, subtle camera push-in";

  if (opts.kind === "motion_control" && opts.mediaType === "video") {
    const [edit, motionStep] = PIPELINE_PRESETS.motion_control.steps;
    return [
      {
        ...edit,
        input: {
          ...edit.input,
          prompt: `In the first image, replace ${who} with the person from the second image (face, hair, body shape). Keep the exact same pose, position, framing, lighting, background and composition of the first image. Scene: ${a.scene || "unchanged"}. ${KEEP_FACE}`,
        },
      },
      motionStep,
    ];
  }

  if (opts.kind === "character_replace" && opts.mediaType === "video") {
    return [{ ...PIPELINE_PRESETS.character_replace.steps[0], label: `Almashtirish: ${who}`.slice(0, 60) }];
  }

  if (opts.mediaType === "image") {
    // Shablon rasmidagi tanlangan personaj o'rniga mijoz qo'yiladi
    const swap: PipelineStep = {
      label: "Personajni almashtirish",
      endpoint: "fal-ai/nano-banana/edit",
      input: {
        prompt: `In the first image, replace ${who} with the person from the second image. Keep the pose, clothing, composition, lighting, colors and style of the first image unchanged. ${KEEP_FACE}`,
        image_urls: ["{{template_image}}", "{{user_image}}"],
      },
      output: "image",
      final: opts.kind === "photoshoot",
      costUsd: 0.04,
    };
    if (opts.kind === "photoshoot") return [swap];
    return [
      swap,
      { label: "Jonlantirish", endpoint: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", input: { prompt: motion, image_url: "{{prev}}", duration: "5" }, output: "video", costUsd: 0.35 },
    ];
  }

  // Video + effekt: sahna mijoz rasmidan qayta yaratiladi, keyin harakatlantiriladi
  return [
    {
      label: "Sahnaga joylash",
      endpoint: "fal-ai/nano-banana/edit",
      input: {
        prompt: `Place the person from the photo into this scene as ${who}. Scene: ${a.scene || "the same setting as the template"}. Vertical 9:16 frame. ${KEEP_FACE}`,
        image_urls: ["{{user_image}}"],
      },
      output: "image",
      costUsd: 0.04,
    },
    { label: "Jonlantirish", endpoint: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", input: { prompt: motion, image_url: "{{prev}}", duration: "5" }, output: "video", costUsd: 0.35 },
  ];
}

/**
 * Ko'p personajli video: tanlangan personajlarning har biri mijozning alohida rasmi bilan almashtiriladi.
 * Tartib muhim: 1-tanlangan personaj → @Image1 → {{user_image_1}} va h.k.
 */
export function buildMultiCharacterSteps(a: AnalysisLike, characterIds: number[]): PipelineStep[] {
  const chosen = characterIds.map((id) => a.characters.find((c) => c.id === id)).filter(Boolean) as AnalysisLike["characters"];
  const parts = chosen.map((c, i) => `${c.descriptionEn} with @Image${i + 1}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] || "the main person with @Image1";
  const base = PIPELINE_PRESETS.multi_character.steps[0];
  return [{
    ...base,
    input: {
      ...base.input,
      prompt: `Replace ${list}. Keep the exact motion, timing, camera movement, background and lighting of the original video. Keep the exact face and identity of each referenced person; do not change any other people.`,
      image_urls: chosen.map((_, i) => `{{user_image_${i + 1}}}`),
    },
  }];
}
