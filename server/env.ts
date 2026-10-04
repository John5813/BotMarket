import "dotenv/config";
import path from "node:path";

function bool(v: string | undefined, def = false) {
  if (v === undefined || v === "") return def;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

const isProd = process.env.NODE_ENV === "production";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL o'rnatilmagan (.env faylini tekshiring)");
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("Production rejimida SESSION_SECRET kamida 32 belgidan iborat bo'lishi shart");
}

export const env = {
  isProd,
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-change-me-dev-secret-change-me",
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, ""),
  storageDir: path.resolve(process.env.STORAGE_DIR || "storage"),
  trustProxy: bool(process.env.TRUST_PROXY, isProd),

  // AI: FAL_KEY bo'lmasa avtomatik "mock" (sinov) rejimi
  falKey: process.env.FAL_KEY || "",
  aiMode: (process.env.AI_MODE || (process.env.FAL_KEY ? "fal" : "mock")) as "fal" | "mock",
  // Production'da sinov (mock) AI bilan mijozdan kredit olinmaydi. Faqat demo uchun: ALLOW_MOCK_AI=1
  allowMockAi: bool(process.env.ALLOW_MOCK_AI, false),
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 4),

  // Admin "AI tahlil" (shablon videosini ko'rib personaj va promptlarni taklif qiladi)
  openrouter: {
    key: process.env.OPENROUTER_API_KEY || "",
    model: process.env.OPENROUTER_MODEL || "google/gemini-3.8-flash",
  },

  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID || "",
    key: process.env.PAYME_KEY || "",
    // Sinov kassasi (checkout.test.paycom.uz). Production'da sukut bo'yicha O'CHIQ
    testMode: bool(process.env.PAYME_TEST_MODE, !isProd),
    get enabled() { return Boolean(this.merchantId && this.key); },
  },
  click: {
    serviceId: process.env.CLICK_SERVICE_ID || "",
    merchantId: process.env.CLICK_MERCHANT_ID || "",
    secretKey: process.env.CLICK_SECRET_KEY || "",
    get enabled() { return Boolean(this.serviceId && this.merchantId && this.secretKey); },
  },
  // Faqat ishlab chiqish uchun: tugma bosilganda buyurtma darhol "to'langan" bo'ladi
  testPayments: bool(process.env.PAYMENTS_TEST_MODE, !isProd),
};
