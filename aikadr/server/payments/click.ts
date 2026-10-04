import crypto from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { clickTransactions, orders } from "@shared/schema";
import { env } from "../env";
import { markOrderPaid } from "./orders";

/**
 * Click SHOP API. Click kabinetida ko'rsatiladigan manzillar:
 *   Prepare URL:  {PUBLIC_URL}/api/payments/click/prepare
 *   Complete URL: {PUBLIC_URL}/api/payments/click/complete
 * merchant_trans_id = bizning buyurtma ID'miz.
 */
const E = {
  OK: [0, "Success"],
  SIGN: [-1, "SIGN CHECK FAILED!"],
  AMOUNT: [-2, "Incorrect parameter amount"],
  ACTION: [-3, "Action not found"],
  ALREADY_PAID: [-4, "Already paid"],
  ORDER: [-5, "User does not exist"],
  TX: [-6, "Transaction does not exist"],
  REQUEST: [-8, "Error in request from click"],
  CANCELLED: [-9, "Transaction cancelled"],
} as const;

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

function base(body: Record<string, string>, err: readonly [number, string], extra: Record<string, unknown> = {}) {
  return {
    click_trans_id: body.click_trans_id ? Number(body.click_trans_id) : null,
    merchant_trans_id: body.merchant_trans_id ?? null,
    ...extra,
    error: err[0],
    error_note: err[1],
  };
}

function required(body: Record<string, string>, keys: string[]) {
  return keys.every((k) => body[k] !== undefined && body[k] !== "");
}

export async function clickPrepare(req: Request, res: Response) {
  const b = (req.body || {}) as Record<string, string>;
  if (!required(b, ["click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time", "sign_string"])) {
    return res.json(base(b, E.REQUEST));
  }
  const sign = md5(`${b.click_trans_id}${b.service_id}${env.click.secretKey}${b.merchant_trans_id}${b.amount}${b.action}${b.sign_time}`);
  if (sign !== b.sign_string || b.service_id !== env.click.serviceId) return res.json(base(b, E.SIGN));
  if (b.action !== "0") return res.json(base(b, E.ACTION));

  const orderId = Number(b.merchant_trans_id);
  const [order] = Number.isInteger(orderId) ? await db.select().from(orders).where(eq(orders.id, orderId)) : [];
  if (!order || order.provider !== "click") return res.json(base(b, E.ORDER));
  if (order.status === "paid") return res.json(base(b, E.ALREADY_PAID));
  if (order.status !== "pending") return res.json(base(b, E.CANCELLED));
  if (Math.abs(parseFloat(b.amount) - order.amountUzs) > 0.01) return res.json(base(b, E.AMOUNT));

  const [existing] = await db.select().from(clickTransactions).where(eq(clickTransactions.clickTransId, b.click_trans_id));
  const tx = existing ?? (await db.insert(clickTransactions).values({
    clickTransId: b.click_trans_id, clickPaydocId: b.click_paydoc_id, orderId, amount: parseFloat(b.amount), status: "prepared",
  }).returning())[0];
  return res.json(base(b, E.OK, { merchant_prepare_id: tx.id }));
}

export async function clickComplete(req: Request, res: Response) {
  const b = (req.body || {}) as Record<string, string>;
  if (!required(b, ["click_trans_id", "service_id", "merchant_trans_id", "merchant_prepare_id", "amount", "action", "sign_time", "sign_string"])) {
    return res.json(base(b, E.REQUEST));
  }
  const sign = md5(`${b.click_trans_id}${b.service_id}${env.click.secretKey}${b.merchant_trans_id}${b.merchant_prepare_id}${b.amount}${b.action}${b.sign_time}`);
  if (sign !== b.sign_string || b.service_id !== env.click.serviceId) return res.json(base(b, E.SIGN));
  if (b.action !== "1") return res.json(base(b, E.ACTION));

  try {
    const result = await db.transaction(async (tx) => {
      const prepareId = Number(b.merchant_prepare_id);
      const [ct] = Number.isInteger(prepareId)
        ? await tx.select().from(clickTransactions).where(eq(clickTransactions.id, prepareId)).for("update")
        : [];
      if (!ct || ct.clickTransId !== b.click_trans_id) return E.TX;
      if (String(ct.orderId) !== b.merchant_trans_id) return E.TX;
      if (ct.status === "completed") return E.ALREADY_PAID;
      if (ct.status === "cancelled") return E.CANCELLED;
      if (Math.abs(parseFloat(b.amount) - ct.amount) > 0.01) return E.AMOUNT;

      // Click tomonida xatolik bo'lsa (error < 0) — tranzaksiya bekor qilinadi
      if (Number(b.error) < 0) {
        await tx.update(clickTransactions).set({ status: "cancelled" }).where(eq(clickTransactions.id, ct.id));
        await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, ct.orderId));
        return E.CANCELLED;
      }
      await markOrderPaid(tx, ct.orderId);
      await tx.update(clickTransactions).set({ status: "completed", completedAt: new Date() }).where(eq(clickTransactions.id, ct.id));
      return E.OK;
    });
    return res.json(base(b, result, { merchant_confirm_id: Number(b.merchant_prepare_id) }));
  } catch (e) {
    console.error("[click]", e);
    return res.json(base(b, [-7, "Failed to update user"] as const));
  }
}
