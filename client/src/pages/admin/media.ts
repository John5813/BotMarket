import type { SourceMeta } from "@shared/schema";

/**
 * Shablon mediasi bilan brauzerning o'zida ishlash: kadrlar, 1-kadr va o'lcham/davomiylik.
 * Serverda ffmpeg shart emas — hammasi admin brauzerida bajariladi.
 */
const ANALYSIS_SIDE = 768;   // AI tahlil uchun kichik kadrlar (tez yuboriladi)
const FRAME_SIDE = 1920;     // Motion Control uchun 1-kadr — to'liq sifat

function drawToJpeg(src: CanvasImageSource, w: number, h: number, maxSide: number, quality: number) {
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

function once(el: HTMLElement, ev: string, timeout = 8000) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Video o'qilmadi")), timeout);
    el.addEventListener(ev, () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

async function openVideo(url: string) {
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  await once(v, "loadeddata");
  let duration = v.duration;
  if (!Number.isFinite(duration)) {
    // Ba'zi webm fayllarda davomiylik yozilmagan — oxiriga o'tib aniqlaymiz
    v.currentTime = 1e7;
    await once(v, "seeked").catch(() => {});
    duration = Number.isFinite(v.duration) ? v.duration : 0;
  }
  return { v, duration };
}

async function seek(v: HTMLVideoElement, t: number) {
  v.currentTime = t;
  await once(v, "seeked");
}

export type ProbeResult = {
  /** AI tahlil uchun kadrlar (videodan 6 ta, rasmdan 1 ta) */
  frames: string[];
  /** Videoning eng birinchi kadri, to'liq o'lchamda ({{template_frame}}) */
  firstFull: string | null;
  meta: SourceMeta;
};

/** Videodan 6 ta tahlil kadri + to'liq o'lchamdagi 1-kadr + o'lcham/davomiylik */
export async function probeMedia(file: File, opts: { analysisFrames?: boolean } = { analysisFrames: true }): Promise<ProbeResult> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.src = url;
      await img.decode();
      return {
        frames: [drawToJpeg(img, img.naturalWidth, img.naturalHeight, ANALYSIS_SIDE, 0.82)],
        firstFull: null,
        meta: { width: img.naturalWidth, height: img.naturalHeight, durationSec: 0 },
      };
    }
    const { v, duration } = await openVideo(url);
    const meta = { width: v.videoWidth, height: v.videoHeight, durationSec: Math.round(duration * 100) / 100 };
    // Eng birinchi kadr (0 soniyada ba'zi brauzerlar qora kadr beradi — 0.04 s olamiz)
    await seek(v, Math.min(0.04, duration / 10 || 0));
    const firstFull = drawToJpeg(v, v.videoWidth, v.videoHeight, FRAME_SIDE, 0.92);
    const frames: string[] = [];
    if (opts.analysisFrames !== false) {
      for (const p of [0.06, 0.22, 0.4, 0.58, 0.76, 0.92]) {
        await seek(v, Math.max(0, (duration || 4) * p));
        frames.push(drawToJpeg(v, v.videoWidth, v.videoHeight, ANALYSIS_SIDE, 0.82));
      }
    }
    return { frames, firstFull, meta };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function dataUrlToFile(dataUrl: string, name: string) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: "image/jpeg" });
}

export function extOfFile(f: File) {
  const byType: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  return byType[f.type] || f.name.split(".").pop()?.toLowerCase() || "";
}

export function formatMeta(m?: SourceMeta | null) {
  if (!m) return "";
  return `${m.width}×${m.height}${m.durationSec ? ` · ${m.durationSec.toFixed(1)} s` : ""}`;
}
