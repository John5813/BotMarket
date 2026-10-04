import fs from "node:fs/promises";
import { createFalClient } from "@fal-ai/client";
import { env } from "../env";
import { absPath, mimeFromPath } from "../files";

export type CheckResult =
  | { status: "pending"; queuePosition?: number }
  | { status: "done"; data: unknown }
  | { status: "error"; error: string };

export type SubmitContext = {
  /** Sinov rejimida video natija o'rnida qaytariladigan fayl (shablon namunasi) */
  mockVideoPath?: string | null;
  /** Sinov rejimida rasm natija o'rnida qaytariladigan fayl */
  mockImagePath?: string | null;
};

export interface AiProvider {
  name: "fal" | "mock";
  uploadFile(relPath: string): Promise<string>;
  submit(endpoint: string, input: Record<string, unknown>, ctx: SubmitContext): Promise<string>;
  check(endpoint: string, requestId: string): Promise<CheckResult>;
}

// ---------------------------------------------------------------------------
// fal.ai — haqiqiy AI
// ---------------------------------------------------------------------------
function falErrorMessage(e: unknown): string {
  const err = e as { status?: number; body?: { detail?: unknown }; message?: string };
  const detail = err?.body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d?.msg || JSON.stringify(d)).join("; ");
  return err?.message || String(e);
}

function createFalProvider(): AiProvider {
  const fal = createFalClient({ credentials: env.falKey });
  return {
    name: "fal",
    async uploadFile(relPath) {
      const buf = await fs.readFile(absPath(relPath));
      return fal.storage.upload(new Blob([buf], { type: mimeFromPath(relPath) }));
    },
    async submit(endpoint, input) {
      try {
        const res = await fal.queue.submit(endpoint, { input });
        return res.request_id;
      } catch (e) {
        throw new Error(`AI so'rovini yuborib bo'lmadi: ${falErrorMessage(e)}`);
      }
    },
    async check(endpoint, requestId) {
      try {
        const st = await fal.queue.status(endpoint, { requestId });
        if (st.status !== "COMPLETED") {
          return { status: "pending", queuePosition: st.status === "IN_QUEUE" ? st.queue_position : undefined };
        }
        const result = await fal.queue.result(endpoint, { requestId });
        return { status: "done", data: result.data };
      } catch (e) {
        const status = (e as { status?: number }).status;
        // Tarmoq yoki 5xx xatolari vaqtinchalik bo'lishi mumkin — keyingi tekshiruvda qayta urinamiz
        if (!status || status >= 500) return { status: "pending" };
        return { status: "error", error: falErrorMessage(e) };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Sinov (mock) — FAL_KEY bo'lmaganda. Pul sarflamaydi, ~6 soniyada
// shablon namunasini "natija" sifatida qaytaradi. Butun oqimni sinash uchun.
// ---------------------------------------------------------------------------
function createMockProvider(): AiProvider {
  const MOCK_DELAY_MS = 6000;
  return {
    name: "mock",
    async uploadFile(relPath) { return `local:${relPath}`; },
    async submit(endpoint, input, ctx) {
      const firstUrl = (v: unknown): string | undefined =>
        typeof v === "string" && v.startsWith("local:") ? v : Array.isArray(v) ? v.map(firstUrl).find(Boolean) : undefined;
      const inputImage = Object.values(input).map(firstUrl).find(Boolean);
      const payload = {
        t: Date.now(),
        video: ctx.mockVideoPath ? `local:${ctx.mockVideoPath}` : null,
        image: ctx.mockImagePath ? `local:${ctx.mockImagePath}` : inputImage || null,
        fail: /fail/i.test(endpoint),
      };
      return "mock_" + Buffer.from(JSON.stringify(payload)).toString("base64url");
    },
    async check(_endpoint, requestId) {
      const p = JSON.parse(Buffer.from(requestId.slice(5), "base64url").toString());
      if (Date.now() - p.t < MOCK_DELAY_MS) return { status: "pending" };
      if (p.fail) return { status: "error", error: "Sinov xatoligi (endpoint nomida 'fail' bor)" };
      return {
        status: "done",
        data: {
          video: p.video ? { url: p.video } : undefined,
          images: p.image ? [{ url: p.image }] : [],
        },
      };
    },
  };
}

export const ai: AiProvider = env.aiMode === "fal" && env.falKey ? createFalProvider() : createMockProvider();
