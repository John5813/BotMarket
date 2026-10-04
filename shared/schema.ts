import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb, real, bigint, index, uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Foydalanuvchilar
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"user" | "admin">().notNull().default("user"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
}, (t) => [uniqueIndex("users_phone_idx").on(t.phone)]);

// ---------------------------------------------------------------------------
// Shablonlar va kategoriyalar
// ---------------------------------------------------------------------------
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  emoji: text("emoji").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [uniqueIndex("categories_slug_idx").on(t.slug)]);

/**
 * Shablon "retsepti": ketma-ket bajariladigan AI qadamlari.
 * Kirish qiymatlaridagi o'rinbosarlar:
 *   {{user_image}}      – mijoz yuklagan rasm URL'i ({{user_image_2}}, {{user_image_3}}... — qo'shimcha rasmlar)
 *   {{template_video}}  – shablonning asl videosi (yoki rasmi) URL'i
 *   {{template_frame}}  – asl videoning to'liq o'lchamdagi 1-kadri (Motion Control uchun)
 *   {{prev}}            – oldingi qadam natijasining URL'i
 *   {{step_N}}          – N-qadam natijasi (0 dan boshlanadi)
 */
export type PipelineStep = {
  label?: string;
  endpoint: string;                      // masalan: "fal-ai/kling-video/v3/pro/motion-control"
  input: Record<string, unknown>;
  output: "video" | "image";
  final?: boolean;                       // natija mijozga ko'rsatiladimi (standart: oxirgi qadam)
  costUsd?: number;                      // qat'iy tannarx, $ (masalan rasm tahriri)
  costPerSecUsd?: number;                // video soniyasiga tannarx, $ (video modellari)
};

/** Asl video (yoki rasm) haqida brauzerda aniqlangan ma'lumot */
export type SourceMeta = { width: number; height: number; durationSec: number };

/**
 * Qo'shimcha variant (masalan arzon "Faqat yuz"). Asosiy variant — shablonning o'z steps/creditCost'i.
 * Mijoz shablon sahifasida variantni tanlaydi.
 */
export type TemplateVariant = { key: string; label: string; hint?: string; creditCost: number; steps: PipelineStep[] };

/** Mijozdan so'raladigan rasm joyi (ko'p personajli shablonlar uchun) */
export type InputSlot = { label: string; hint?: string };

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  kind: text("kind").$type<"motion_control" | "character_replace" | "multi_character" | "effect" | "photoshoot" | "custom">().notNull().default("effect"),
  previewPath: text("preview_path"),        // kartochkada ko'rinadigan namuna (video yoki rasm)
  posterPath: text("poster_path"),          // video yuklanguncha ko'rinadigan rasm
  sourceVideoPath: text("source_video_path"), // qahramon almashtirish uchun asl video
  /** Asl videoning to'liq o'lchamdagi 1-kadri ({{template_frame}}). Muqovadan alohida — muqovani almashtirish retseptni buzmaydi */
  framePath: text("frame_path"),
  sourceMeta: jsonb("source_meta").$type<SourceMeta | null>(),
  sourceFalUrl: text("source_fal_url"),
  sourceFalUploadedAt: timestamp("source_fal_uploaded_at", { withTimezone: true }),
  steps: jsonb("steps").$type<PipelineStep[]>().notNull().default([]),
  /** Bo'sh bo'lsa — bitta oddiy rasm. Har bir element {{user_image_N}} ga mos keladi */
  inputSlots: jsonb("input_slots").$type<InputSlot[]>().notNull().default([]),
  /** Asosiy variant nomi (variantlar bo'lsa ko'rsatiladi) */
  mainLabel: text("main_label").notNull().default("Butun personaj"),
  variants: jsonb("variants").$type<TemplateVariant[]>().notNull().default([]),
  creditCost: integer("credit_cost").notNull().default(1),
  allowAnimals: boolean("allow_animals").notNull().default(false),
  inputHint: text("input_hint").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isNew: boolean("is_new").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("templates_slug_idx").on(t.slug), index("templates_category_idx").on(t.categoryId)]);

// ---------------------------------------------------------------------------
// Generatsiyalar (har bir buyurtma qilingan video/rasm)
// ---------------------------------------------------------------------------
export type StepResult = { url: string; type: "video" | "image"; localPath?: string; requestId?: string };
export type CreditAllocation = { lotId: number; amount: number };

export const generations = pgTable("generations", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateId: integer("template_id").references(() => templates.id, { onDelete: "set null" }),
  status: text("status").$type<"queued" | "processing" | "succeeded" | "failed">().notNull().default("queued"),
  inputPath: text("input_path"),
  inputFalUrl: text("input_fal_url"),
  inputDeleted: boolean("input_deleted").notNull().default(false),
  /** 2-, 3-... rasmlar (ko'p personajli shablonlar) */
  extraInputs: jsonb("extra_inputs").$type<{ path: string; falUrl?: string | null }[]>().notNull().default([]),
  /** null — asosiy variant, aks holda templates.variants[].key */
  variantKey: text("variant_key"),
  stepIndex: integer("step_index").notNull().default(0),
  stepResults: jsonb("step_results").$type<StepResult[]>().notNull().default([]),
  currentRequestId: text("current_request_id"),
  currentEndpoint: text("current_endpoint"),
  outputs: jsonb("outputs").$type<{ path: string; type: "video" | "image" }[]>().notNull().default([]),
  error: text("error"),
  creditsSpent: integer("credits_spent").notNull().default(0),
  creditAllocations: jsonb("credit_allocations").$type<CreditAllocation[]>().notNull().default([]),
  costUsd: real("cost_usd").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [index("generations_user_idx").on(t.userId, t.createdAt), index("generations_status_idx").on(t.status)]);

// ---------------------------------------------------------------------------
// Kreditlar: har bir to'ldirish alohida "lot" (o'z muddati bilan),
// har bir harakat esa tarix jadvaliga yoziladi.
// ---------------------------------------------------------------------------
export const creditLots = pgTable("credit_lots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  remaining: integer("remaining").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  source: text("source").$type<"signup" | "purchase" | "admin" | "refund">().notNull(),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("credit_lots_user_idx").on(t.userId)]);

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  ref: text("ref"),
  actorId: integer("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("credit_tx_user_idx").on(t.userId, t.createdAt)]);

// ---------------------------------------------------------------------------
// Tariflar, buyurtmalar va to'lov tizimlari
// ---------------------------------------------------------------------------
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  credits: integer("credits").notNull(),
  priceUzs: integer("price_uzs").notNull(),
  validityDays: integer("validity_days").notNull(),
  badge: text("badge").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  planTitle: text("plan_title").notNull(),
  amountUzs: integer("amount_uzs").notNull(),
  credits: integer("credits").notNull(),
  validityDays: integer("validity_days").notNull(),
  provider: text("provider").$type<"payme" | "click" | "test">().notNull(),
  status: text("status").$type<"pending" | "paid" | "cancelled" | "refunded">().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
}, (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)]);

export const paymeTransactions = pgTable("payme_transactions", {
  id: serial("id").primaryKey(),
  paymeId: text("payme_id").notNull(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  amount: bigint("amount", { mode: "number" }).notNull(), // tiyinda
  state: integer("state").notNull(),
  paymeTime: bigint("payme_time", { mode: "number" }).notNull(),
  createTime: bigint("create_time", { mode: "number" }).notNull(),
  performTime: bigint("perform_time", { mode: "number" }).notNull().default(0),
  cancelTime: bigint("cancel_time", { mode: "number" }).notNull().default(0),
  reason: integer("reason"),
}, (t) => [uniqueIndex("payme_tx_id_idx").on(t.paymeId), index("payme_tx_order_idx").on(t.orderId)]);

export const clickTransactions = pgTable("click_transactions", {
  id: serial("id").primaryKey(),
  clickTransId: text("click_trans_id").notNull(),
  clickPaydocId: text("click_paydoc_id"),
  orderId: integer("order_id").notNull().references(() => orders.id),
  amount: real("amount").notNull(),
  status: text("status").$type<"prepared" | "completed" | "cancelled">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("click_tx_id_idx").on(t.clickTransId)]);

// ---------------------------------------------------------------------------
// Sozlamalar (admin paneldan o'zgartiriladi)
// ---------------------------------------------------------------------------
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Order = typeof orders.$inferSelect;
