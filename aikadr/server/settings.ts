import { db } from "./db";
import { settings } from "@shared/schema";

export const DEFAULT_SETTINGS = {
  siteName: "AIKadr",
  tagline: "Bir rasm — tayyor trend video",
  signupBonusCredits: 1,
  signupBonusDays: 7,
  inputRetentionHours: 24,
  usdToUzs: 12500,
  supportTelegram: "",
  generationTimeoutMinutes: 20,
};
export type SiteSettings = typeof DEFAULT_SETTINGS;

let cache: { value: SiteSettings; at: number } | null = null;

export async function getSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const rows = await db.select().from(settings);
  const value = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) value[r.key] = r.value;
  cache = { value: value as SiteSettings, at: Date.now() };
  return cache.value;
}

export async function updateSettings(patch: Partial<SiteSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const def = (DEFAULT_SETTINGS as Record<string, unknown>)[key];
    if (typeof def !== typeof value) continue;
    await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  cache = null;
  return getSettings();
}
