import type { PipelineStep } from "./schema";

/**
 * Admin paneldagi tayyor "retseptlar". Admin shablon turini tanlaganda
 * qadamlar shu yerdan to'ldiriladi, keyin xohlagancha o'zgartirish mumkin.
 * Model nomlari fal.ai endpoint identifikatorlari.
 */
export const PIPELINE_PRESETS: Record<
  "character_replace" | "effect" | "photoshoot",
  { title: string; description: string; needsSourceVideo: boolean; steps: PipelineStep[] }
> = {
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
  character_replace: "Qahramon almashtirish",
  effect: "Effekt",
  photoshoot: "Fotosessiya",
  custom: "Maxsus",
};

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
