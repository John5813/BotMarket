import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { env } from "./env";

/**
 * Fayllar ikki joyda saqlanadi:
 *   public/  – shablon namunalari (hamma ko'radi, /media/... orqali)
 *   private/ – mijoz rasmlari va natijalar (faqat egasi, API orqali)
 * Bazada nisbiy yo'l saqlanadi: "public/templates/abc.mp4"
 */
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];

export function extFromMime(mime: string, fallback = "bin") {
  return MIME_EXT[mime.split(";")[0].trim()] || fallback;
}
export function mimeFromPath(p: string) {
  const ext = path.extname(p).slice(1).toLowerCase();
  return Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0] || "application/octet-stream";
}

export function absPath(rel: string) {
  const full = path.resolve(env.storageDir, rel);
  if (!full.startsWith(env.storageDir + path.sep)) throw new Error("Noto'g'ri fayl yo'li");
  return full;
}

export async function saveBuffer(dir: string, buf: Buffer, ext: string, name = nanoid(16)) {
  const rel = path.posix.join(dir, `${name}.${ext}`);
  const full = absPath(rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf);
  return rel;
}

export async function deleteFile(rel?: string | null) {
  if (!rel) return;
  try { await fs.unlink(absPath(rel)); } catch { /* fayl allaqachon yo'q */ }
}

export function publicUrl(rel?: string | null) {
  if (!rel) return null;
  if (!rel.startsWith("public/")) return null;
  return `/media/${rel.slice("public/".length)}`;
}

/** Tashqi URL'dan (AI natijasi) faylni yuklab, private papkaga saqlaydi */
export async function downloadToPrivate(url: string, dir: string, name: string, fallbackExt: string) {
  if (url.startsWith("local:")) {
    const src = absPath(url.slice("local:".length));
    const ext = path.extname(src).slice(1) || fallbackExt;
    const rel = path.posix.join(dir, `${name}.${ext}`);
    await fs.mkdir(path.dirname(absPath(rel)), { recursive: true });
    await fs.copyFile(src, absPath(rel));
    return rel;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`Natijani yuklab bo'lmadi (${res.status})`);
  const size = Number(res.headers.get("content-length") || 0);
  if (size > 500 * 1024 * 1024) throw new Error("Natija fayli juda katta");
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = extFromMime(res.headers.get("content-type") || "", fallbackExt);
  return saveBuffer(dir, buf, ext, name);
}

/** Brauzer turini yubormasa (application/octet-stream), kengaytmadan aniqlaymiz */
export function fileMime(file: { mimetype: string; originalname: string }) {
  if (file.mimetype && file.mimetype !== "application/octet-stream") return file.mimetype;
  return mimeFromPath(file.originalname);
}

/** Fayl ichidagi "imzo" baytlari orqali haqiqatan rasm ekanini tekshirish */
export function looksLikeImage(buf: Buffer) {
  if (buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  return jpeg || png || webp;
}
