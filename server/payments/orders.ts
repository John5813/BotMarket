import { eq } from "drizzle-orm";
import { db, type Tx } from "../db";
import { orders, plans, type Order } from "@shared/schema";
import { grantCredits } from "../credits";
import { env } from "../env";

export type Provider = "payme" | "click" | "test";

export function enabledProviders(): Provider[] {
  const list: Provider[] = [];
  if (env.payme.enabled) list.push("payme");
  if (env.click.enabled) list.push("click");
  if (env.testPayments) list.push("test");
  return list;
}

export async function createOrder(userId: number, planId: number, provider: Provider) {
  if (!enabledProviders().includes(provider)) throw new Error("Bu to'lov usuli yoqilmagan");
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!plan || !plan.isActive) throw new Error("Tarif topilmadi");
  const [order] = await db.insert(orders).values({
    userId, planId: plan.id, planTitle: plan.title, amountUzs: plan.priceUzs,
    credits: plan.credits, validityDays: plan.validityDays, provider,
  }).returning();
  return order;
}

/** Mijoz to'lov sahifasiga yo'naltiriladigan havola */
export function checkoutUrl(order: Order) {
  const returnUrl = `${env.publicUrl}/payment/${order.id}`;
  if (order.provider === "payme") {
    // Payme: base64("m=...;ac.order_id=...;a=<tiyin>;c=<qaytish URL>")
    const params = `m=${env.payme.merchantId};ac.order_id=${order.id};a=${order.amountUzs * 100};l=uz;c=${returnUrl}`;
    const base = env.payme.testMode ? "https://checkout.test.paycom.uz" : "https://checkout.paycom.uz";
    return `${base}/${Buffer.from(params).toString("base64")}`;
  }
  if (order.provider === "click") {
    const q = new URLSearchParams({
      service_id: env.click.serviceId,
      merchant_id: env.click.merchantId,
      amount: String(order.amountUzs),
      transaction_param: String(order.id),
      return_url: returnUrl,
    });
    return `https://my.click.uz/services/pay?${q}`;
  }
  return returnUrl; // test rejimi — o'z sahifamiz
}

/** Buyurtmani to'langan deb belgilaydi va kreditlarni beradi. Ikki marta chaqirilsa ham xavfsiz. */
export async function markOrderPaid(tx: Tx, orderId: number) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new Error("Buyurtma topilmadi");
  if (order.status === "paid") return order;
  if (order.status !== "pending") throw new Error("Buyurtma holati to'lov uchun mos emas");
  const [updated] = await tx.update(orders).set({ status: "paid", paidAt: new Date() }).where(eq(orders.id, orderId)).returning();
  await grantCredits(tx, {
    userId: order.userId, amount: order.credits, days: order.validityDays, source: "purchase",
    orderId: order.id, reason: `"${order.planTitle}" tarifi sotib olindi`,
  });
  return updated;
}
