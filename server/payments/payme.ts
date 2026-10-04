import crypto from "node:crypto";
import type { Request, Response } from "express";
import { and, between, eq, ne } from "drizzle-orm";
import { db, type Tx } from "../db";
import { orders, paymeTransactions, settings } from "@shared/schema";
import { env } from "../env";
import { markOrderPaid } from "./orders";
import { revokeOrderCredits } from "../credits";

/**
 * Payme Merchant API (JSON-RPC). Payme serveri shu endpointga so'rov yuboradi:
 *   POST {PUBLIC_URL}/api/payments/payme
 * Kabinetda "Endpoint URL" sifatida shu manzil ko'rsatiladi.
 * Hisob (account) maydoni: order_id
 */
const TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 soat — Payme talabi

const MSG = {
  auth: { ru: "Недостаточно привилегий", uz: "Ruxsat yo'q", en: "Insufficient privileges" },
  amount: { ru: "Неверная сумма", uz: "Noto'g'ri summa", en: "Invalid amount" },
  order: { ru: "Заказ не найден", uz: "Buyurtma topilmadi", en: "Order not found" },
  orderState: { ru: "Заказ уже оплачен или отменён", uz: "Buyurtma allaqachon to'langan yoki bekor qilingan", en: "Order already paid or cancelled" },
  busy: { ru: "Заказ ожидает оплаты в другой транзакции", uz: "Buyurtma boshqa tranzaksiyada kutilmoqda", en: "Order has another pending transaction" },
  txNotFound: { ru: "Транзакция не найдена", uz: "Tranzaksiya topilmadi", en: "Transaction not found" },
  cantPerform: { ru: "Невозможно выполнить операцию", uz: "Amalni bajarib bo'lmaydi", en: "Unable to perform operation" },
  cantCancel: { ru: "Невозможно отменить транзакцию", uz: "Tranzaksiyani bekor qilib bo'lmaydi", en: "Unable to cancel transaction" },
  method: { ru: "Метод не найден", uz: "Metod topilmadi", en: "Method not found" },
  parse: { ru: "Ошибка разбора JSON", uz: "JSON xatosi", en: "Parse error" },
};

class PaymeError extends Error {
  constructor(public code: number, public msg: { ru: string; uz: string; en: string }, public data?: string) {
    super(msg.en);
  }
}

/**
 * Kassa kaliti. Payme kabinetida kalit almashtirilsa, Payme "ChangePassword" yuboradi —
 * yangi kalit bazaga yoziladi. Agar admin .env dagi PAYME_KEY ni keyin o'zi o'zgartirsa, .env ustun turadi.
 */
const KEY_SETTING = "payme_key_override";
async function currentKey() {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY_SETTING));
  const v = row?.value as { key?: string; envKey?: string } | undefined;
  return v?.key && v.envKey === env.payme.key ? v.key : env.payme.key;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function checkAuth(req: Request) {
  const header = req.headers.authorization || "";
  const [type, encoded] = header.split(" ");
  if (type !== "Basic" || !encoded) return false;
  const [login, ...rest] = Buffer.from(encoded, "base64").toString().split(":");
  const key = await currentKey();
  return login === "Paycom" && key.length > 0 && safeEqual(rest.join(":"), key);
}

async function findOrder(account: Record<string, unknown> | undefined, amount: number, tx: Tx | typeof db = db) {
  const id = Number(account?.order_id);
  if (!Number.isInteger(id) || id <= 0) throw new PaymeError(-31050, MSG.order, "order_id");
  const [order] = await tx.select().from(orders).where(eq(orders.id, id));
  if (!order || order.provider !== "payme") throw new PaymeError(-31050, MSG.order, "order_id");
  if (order.status !== "pending") throw new PaymeError(-31051, MSG.orderState, "order_id");
  if (order.amountUzs * 100 !== Number(amount)) throw new PaymeError(-31001, MSG.amount);
  return order;
}

/** Fiskal chek ma'lumoti (soliq talabi). MXIK/IKPU kodi .env'da ko'rsatilsa qo'shiladi */
function receiptDetail(title: string, amountTiyin: number) {
  const ikpu = process.env.PAYME_IKPU_CODE;
  const packageCode = process.env.PAYME_PACKAGE_CODE;
  if (!ikpu || !packageCode) return undefined;
  return {
    receipt_type: 0,
    items: [{
      title: title.slice(0, 120), price: amountTiyin, count: 1, code: ikpu, package_code: packageCode,
      vat_percent: Number(process.env.PAYME_VAT_PERCENT || 0),
    }],
  };
}

const txView = (t: typeof paymeTransactions.$inferSelect) => ({
  create_time: t.createTime, perform_time: t.performTime, cancel_time: t.cancelTime,
  transaction: String(t.id), state: t.state, reason: t.reason ?? null,
});

async function cancelExpired(tx: Tx, t: typeof paymeTransactions.$inferSelect) {
  await tx.update(paymeTransactions).set({ state: -1, cancelTime: Date.now(), reason: 4 }).where(eq(paymeTransactions.id, t.id));
  await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(and(eq(orders.id, t.orderId), eq(orders.status, "pending")));
}

const methods: Record<string, (p: any) => Promise<unknown>> = {
  async CheckPerformTransaction(p) {
    const order = await findOrder(p.account, p.amount);
    return { allow: true, detail: receiptDetail(order.planTitle, order.amountUzs * 100) };
  },

  async CreateTransaction(p) {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(paymeTransactions).where(eq(paymeTransactions.paymeId, String(p.id))).for("update");
      if (existing) {
        if (existing.state !== 1) throw new PaymeError(-31008, MSG.cantPerform);
        if (Date.now() - existing.createTime > TIMEOUT_MS) {
          await cancelExpired(tx, existing);
          throw new PaymeError(-31008, MSG.cantPerform);
        }
        return { create_time: existing.createTime, transaction: String(existing.id), state: existing.state };
      }
      const order = await findOrder(p.account, p.amount, tx);
      await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
      const [other] = await tx.select().from(paymeTransactions)
        .where(and(eq(paymeTransactions.orderId, order.id), eq(paymeTransactions.state, 1), ne(paymeTransactions.paymeId, String(p.id))));
      if (other) throw new PaymeError(-31099, MSG.busy, "order_id");
      const [created] = await tx.insert(paymeTransactions).values({
        paymeId: String(p.id), orderId: order.id, amount: Number(p.amount), state: 1,
        paymeTime: Number(p.time), createTime: Date.now(),
      }).returning();
      return { create_time: created.createTime, transaction: String(created.id), state: 1 };
    });
  },

  async PerformTransaction(p) {
    return db.transaction(async (tx) => {
      const [t] = await tx.select().from(paymeTransactions).where(eq(paymeTransactions.paymeId, String(p.id))).for("update");
      if (!t) throw new PaymeError(-31003, MSG.txNotFound);
      if (t.state === 2) return { transaction: String(t.id), perform_time: t.performTime, state: 2 };
      if (t.state !== 1) throw new PaymeError(-31008, MSG.cantPerform);
      if (Date.now() - t.createTime > TIMEOUT_MS) {
        await cancelExpired(tx, t);
        throw new PaymeError(-31008, MSG.cantPerform);
      }
      await markOrderPaid(tx, t.orderId);
      const performTime = Date.now();
      await tx.update(paymeTransactions).set({ state: 2, performTime }).where(eq(paymeTransactions.id, t.id));
      return { transaction: String(t.id), perform_time: performTime, state: 2 };
    });
  },

  async CancelTransaction(p) {
    return db.transaction(async (tx) => {
      const [t] = await tx.select().from(paymeTransactions).where(eq(paymeTransactions.paymeId, String(p.id))).for("update");
      if (!t) throw new PaymeError(-31003, MSG.txNotFound);
      if (t.state === -1 || t.state === -2) return { transaction: String(t.id), cancel_time: t.cancelTime, state: t.state };
      const cancelTime = Date.now();
      if (t.state === 1) {
        await tx.update(paymeTransactions).set({ state: -1, cancelTime, reason: Number(p.reason) || null }).where(eq(paymeTransactions.id, t.id));
        await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(and(eq(orders.id, t.orderId), eq(orders.status, "pending")));
        return { transaction: String(t.id), cancel_time: cancelTime, state: -1 };
      }
      // state === 2: to'lov bajarilgan — kreditlar ishlatilmagan bo'lsagina qaytarish mumkin
      const [order] = await tx.select().from(orders).where(eq(orders.id, t.orderId));
      const ok = await revokeOrderCredits(tx, t.orderId, order.userId);
      if (!ok) throw new PaymeError(-31007, MSG.cantCancel);
      await tx.update(paymeTransactions).set({ state: -2, cancelTime, reason: Number(p.reason) || null }).where(eq(paymeTransactions.id, t.id));
      await tx.update(orders).set({ status: "refunded", cancelledAt: new Date() }).where(eq(orders.id, t.orderId));
      return { transaction: String(t.id), cancel_time: cancelTime, state: -2 };
    });
  },

  async CheckTransaction(p) {
    const [t] = await db.select().from(paymeTransactions).where(eq(paymeTransactions.paymeId, String(p.id)));
    if (!t) throw new PaymeError(-31003, MSG.txNotFound);
    return txView(t);
  },

  async ChangePassword(p) {
    const password = String(p.password || "");
    if (password.length < 8) throw new PaymeError(-32400, { ru: "Неверный пароль", uz: "Parol noto'g'ri", en: "Invalid password" });
    const value = { key: password, envKey: env.payme.key };
    await db.insert(settings).values({ key: KEY_SETTING, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
    console.log("[payme] kassa kaliti yangilandi (ChangePassword)");
    return { success: true };
  },

  async GetStatement(p) {
    const list = await db.select().from(paymeTransactions)
      .where(between(paymeTransactions.paymeTime, Number(p.from), Number(p.to)))
      .orderBy(paymeTransactions.paymeTime);
    return {
      transactions: list.map((t) => ({
        id: t.paymeId, time: t.paymeTime, amount: t.amount, account: { order_id: String(t.orderId) }, ...txView(t),
      })),
    };
  },
};

export async function paymeHandler(req: Request, res: Response) {
  const body = req.body || {};
  const id = body.id ?? null;
  const reply = (payload: object) => res.status(200).json({ jsonrpc: "2.0", id, ...payload });
  try {
    if (!(await checkAuth(req))) throw new PaymeError(-32504, MSG.auth);
    if (typeof body.method !== "string") throw new PaymeError(-32600, MSG.parse);
    const fn = methods[body.method];
    if (!fn) throw new PaymeError(-32601, MSG.method, body.method);
    const result = await fn(body.params || {});
    return reply({ result });
  } catch (e) {
    if (e instanceof PaymeError) return reply({ error: { code: e.code, message: e.msg, data: e.data } });
    console.error("[payme]", e);
    return reply({ error: { code: -32400, message: { ru: "Системная ошибка", uz: "Tizim xatoligi", en: "System error" } } });
  }
}
