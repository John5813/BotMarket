import crypto from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type User } from "@shared/schema";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

declare module "express-session" {
  interface SessionData { userId?: number }
}
declare global {
  namespace Express { interface Request { user?: User } }
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

/** +998 90 123 45 67 → 998901234567. Noto'g'ri bo'lsa null */
export function normalizePhone(raw: string) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  return /^998\d{9}$/.test(d) ? d : null;
}

export function publicUser(u: User) {
  return { id: u.id, phone: u.phone, name: u.name, role: u.role, createdAt: u.createdAt };
}

/** Har bir so'rovda sessiyadagi foydalanuvchini yuklaydi */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const id = req.session.userId;
  if (id) {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (u && !u.isBlocked) req.user = u;
    else delete req.session.userId;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Iltimos, avval tizimga kiring" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Iltimos, avval tizimga kiring" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Ruxsat yo'q" });
  next();
}

/** Sessiyani yangilab (session fixation hujumidan himoya), foydalanuvchini kiritadi */
export function startSession(req: Request, userId: number) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}
