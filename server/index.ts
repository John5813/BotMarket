import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { env } from "./env";
import { pool } from "./db";
import { loadUser } from "./auth";
import { publicRouter } from "./routes/public";
import { clientRouter } from "./routes/client";
import { adminRouter } from "./routes/admin";
import { errorHandler } from "./routes/helpers";
import { paymeHandler } from "./payments/payme";
import { clickComplete, clickPrepare } from "./payments/click";
import { startWorker } from "./worker";

const app = express();
if (env.trustProxy) app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: env.isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      formAction: ["'self'", "https://checkout.paycom.uz", "https://checkout.test.paycom.uz", "https://my.click.uz"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

// To'lov tizimlari callback'lari (sessiyasiz, o'z autentifikatsiyasi bilan)
app.post("/api/payments/payme", express.json({ limit: "100kb" }), paymeHandler);
app.post("/api/payments/click/prepare", express.urlencoded({ extended: false }), clickPrepare);
app.post("/api/payments/click/complete", express.urlencoded({ extended: false }), clickComplete);

app.use("/api/admin/analyze", express.json({ limit: "12mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

const PgStore = connectPg(session);
app.use(session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  name: "aikadr.sid",
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: "lax", secure: env.isProd, maxAge: 30 * 86_400_000 },
}));
app.use(loadUser);

// Shablon namunalari (hamma uchun ochiq)
app.use("/media", express.static(path.join(env.storageDir, "public"), { maxAge: "7d", fallthrough: false }));

app.use("/api", publicRouter);
app.use("/api/admin", adminRouter);
app.use("/api", clientRouter);
app.use("/api", (_req, res) => res.status(404).json({ message: "Topilmadi" }));
app.use(errorHandler);

async function start() {
  fs.mkdirSync(path.join(env.storageDir, "public"), { recursive: true });
  fs.mkdirSync(path.join(env.storageDir, "private"), { recursive: true });

  if (env.isProd) {
    const dist = path.resolve(import.meta.dirname, "public");
    app.use(express.static(dist, { maxAge: "1h", index: false }));
    app.use((_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ configFile: path.resolve(import.meta.dirname, "../vite.config.ts"), server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(env.port, () => {
    console.log(`AIKadr ishga tushdi: ${env.publicUrl}`);
    if (env.testPayments) console.log("⚠️  Sinov to'lovlari YOQILGAN (PAYMENTS_TEST_MODE). Production'da o'chiring!");
  });
  if (process.env.DISABLE_WORKER !== "1") startWorker();
}

start();
