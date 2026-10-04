import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, type Tx } from "./db";
import { creditLots, creditTransactions, type CreditAllocation } from "@shared/schema";

/**
 * Kredit tizimi:
 *  - Har bir to'ldirish (sotib olish, bonus, admin) — alohida "lot", o'z amal qilish muddati bilan.
 *  - Sarflashda avval muddati eng yaqin tugaydigan lotdan yechiladi (FIFO).
 *  - Har bir harakat credit_transactions jadvaliga yoziladi (to'liq tarix).
 */
export class InsufficientCreditsError extends Error {
  constructor(public balance: number, public needed: number) {
    super("Kredit yetarli emas");
  }
}

const notExpired = () => or(isNull(creditLots.expiresAt), gt(creditLots.expiresAt, sql`now()`));

export async function getBalance(userId: number, tx: Tx | typeof db = db) {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${creditLots.remaining}), 0)::int` })
    .from(creditLots)
    .where(and(eq(creditLots.userId, userId), gt(creditLots.remaining, 0), notExpired()));
  return row?.total ?? 0;
}

export async function grantCredits(
  tx: Tx,
  opts: { userId: number; amount: number; days: number | null; source: "signup" | "purchase" | "admin" | "refund"; orderId?: number; reason: string; actorId?: number },
) {
  if (opts.amount <= 0) return null;
  const expiresAt = opts.days ? new Date(Date.now() + opts.days * 86_400_000) : null;
  const [lot] = await tx.insert(creditLots).values({
    userId: opts.userId, amount: opts.amount, remaining: opts.amount, expiresAt, source: opts.source, orderId: opts.orderId,
  }).returning();
  await tx.insert(creditTransactions).values({
    userId: opts.userId, delta: opts.amount, reason: opts.reason, ref: opts.orderId ? `order:${opts.orderId}` : null, actorId: opts.actorId,
  });
  return lot;
}

/** Kreditni yechadi va qaysi lotlardan yechilganini qaytaradi (keyin qaytarish uchun) */
export async function consumeCredits(tx: Tx, userId: number, amount: number, reason: string, ref?: string, actorId?: number) {
  if (amount <= 0) return [] as CreditAllocation[];
  const lots = await tx.select().from(creditLots)
    .where(and(eq(creditLots.userId, userId), gt(creditLots.remaining, 0), notExpired()))
    .orderBy(sql`${creditLots.expiresAt} asc nulls last`, asc(creditLots.id))
    .for("update");
  const balance = lots.reduce((s, l) => s + l.remaining, 0);
  if (balance < amount) throw new InsufficientCreditsError(balance, amount);

  let left = amount;
  const allocations: CreditAllocation[] = [];
  for (const lot of lots) {
    if (left === 0) break;
    const take = Math.min(lot.remaining, left);
    await tx.update(creditLots).set({ remaining: lot.remaining - take }).where(eq(creditLots.id, lot.id));
    allocations.push({ lotId: lot.id, amount: take });
    left -= take;
  }
  await tx.insert(creditTransactions).values({ userId, delta: -amount, reason, ref, actorId });
  return allocations;
}

/** Muvaffaqiyatsiz generatsiya uchun kreditni o'sha lotlarga qaytaradi */
export async function refundCredits(tx: Tx, userId: number, allocations: CreditAllocation[], reason: string, ref?: string) {
  const total = allocations.reduce((s, a) => s + a.amount, 0);
  if (total <= 0) return;
  for (const a of allocations) {
    await tx.update(creditLots).set({ remaining: sql`${creditLots.remaining} + ${a.amount}` }).where(eq(creditLots.id, a.lotId));
  }
  await tx.insert(creditTransactions).values({ userId, delta: total, reason, ref });
}

/**
 * Payme to'lovni bekor qilganda: buyurtma orqali berilgan kreditlarni qaytarib oladi.
 * Agar kreditlar allaqachon ishlatilgan bo'lsa — false (to'lovni bekor qilib bo'lmaydi).
 */
export async function revokeOrderCredits(tx: Tx, orderId: number, userId: number) {
  const [lot] = await tx.select().from(creditLots).where(eq(creditLots.orderId, orderId)).for("update");
  if (!lot) return true;
  if (lot.remaining < lot.amount) return false;
  await tx.update(creditLots).set({ remaining: 0 }).where(eq(creditLots.id, lot.id));
  await tx.insert(creditTransactions).values({ userId, delta: -lot.amount, reason: "To'lov bekor qilindi", ref: `order:${orderId}` });
  return true;
}

export async function getCreditOverview(userId: number) {
  const balance = await getBalance(userId);
  const lots = await db.select().from(creditLots)
    .where(and(eq(creditLots.userId, userId), gt(creditLots.remaining, 0), notExpired()))
    .orderBy(sql`${creditLots.expiresAt} asc nulls last`);
  const history = await db.select().from(creditTransactions)
    .where(eq(creditTransactions.userId, userId)).orderBy(desc(creditTransactions.createdAt)).limit(50);
  return { balance, lots, history };
}
