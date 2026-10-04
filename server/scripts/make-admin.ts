/**
 * Admin yaratish yoki mavjud foydalanuvchini admin qilish:
 *   npm run make-admin -- +998901234567 "Parol123" "Ism"
 */
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { users } from "@shared/schema";
import { hashPassword, normalizePhone } from "../auth";

const [rawPhone, password, name = "Admin"] = process.argv.slice(2);
const phone = normalizePhone(rawPhone || "");
if (!phone || !password || password.length < 8) {
  console.error('Foydalanish: npm run make-admin -- +998901234567 "KamidaSakkizBelgi" "Ism"');
  process.exit(1);
}

const [existing] = await db.select().from(users).where(eq(users.phone, phone));
if (existing) {
  await db.update(users).set({ role: "admin", passwordHash: await hashPassword(password), isBlocked: false }).where(eq(users.id, existing.id));
  console.log(`✅ ${phone} admin qilindi (parol yangilandi)`);
} else {
  await db.insert(users).values({ phone, name, role: "admin", passwordHash: await hashPassword(password) });
  console.log(`✅ Yangi admin yaratildi: ${phone}`);
}
await pool.end();
