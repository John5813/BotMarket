import { QueryClient } from "@tanstack/react-query";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export async function api<T = any>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method || (opts.body || opts.form ? "POST" : "GET"),
    credentials: "include",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { message: text }; } })() : null;
  if (!res.ok) throw new ApiError(res.status, data?.message || "Xatolik yuz berdi", data?.code);
  return data as T;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => api(queryKey[0] as string),
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Turlar (server javoblari)
// ---------------------------------------------------------------------------
export type Me = { user: { id: number; phone: string; name: string; role: "user" | "admin" } | null; balance?: number };
export type SiteConfig = { siteName: string; tagline: string; supportTelegram: string; paymentProviders: ("payme" | "click" | "test")[]; aiMode: "fal" | "mock" };
export type TemplateCard = {
  id: number; slug: string; title: string; description: string; categoryId: number | null; kind: string;
  previewUrl: string | null; previewIsVideo: boolean; posterUrl: string | null; creditCost: number;
  allowAnimals: boolean; inputHint: string; isFeatured: boolean; isNew: boolean; usageCount: number;
  inputSlots?: { label: string; hint?: string }[];
  /** Bo'sh bo'lmasa: birinchisi asosiy variant (key ""), qolganlari arzonroq/boshqa variantlar */
  variants?: { key: string; label: string; hint: string; creditCost: number }[];
};
export type Catalog = { featured: TemplateCard[]; categories: { id: number; title: string; slug: string; emoji: string; templates: TemplateCard[] }[] };
export type GenerationItem = {
  id: string; status: "queued" | "processing" | "succeeded" | "failed"; createdAt: string; finishedAt: string | null;
  creditsSpent: number; templateTitle: string; templateSlug: string | null; stepIndex: number; totalSteps: number;
  outputs: { type: "video" | "image"; url: string }[]; error: string | null;
  user?: { id: number; phone: string; name: string }; costUsd?: number; rawError?: string | null; attempts?: number;
};
export type Plan = { id: number; title: string; description: string; credits: number; priceUzs: number; validityDays: number; badge: string; sortOrder: number; isActive: boolean };
export type Order = { id: number; planTitle: string; amountUzs: number; credits: number; validityDays: number; provider: string; status: string; createdAt: string; paidAt: string | null; user?: { phone: string; name: string } };

export function formatUzs(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n).replace(/[ ,]/g, " ") + " so'm";
}
export function formatDate(d: string | Date | null | undefined, withTime = true) {
  if (!d) return "—";
  const date = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  const s = `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}`;
  return withTime ? `${s} ${p(date.getHours())}:${p(date.getMinutes())}` : s;
}
export function formatPhone(p: string) {
  const m = p.match(/^998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}
