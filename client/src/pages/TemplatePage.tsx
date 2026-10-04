import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ImagePlus, Zap, PawPrint, Sun, ScanFace, Image as ImageIcon, X, Check } from "lucide-react";
import { api, ApiError, queryClient, type TemplateCard } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { TemplatePreview } from "@/components/TemplateCard";
import { Button, Empty, PageLoader, clsx, useToast } from "@/components/ui";

const MAX_MB = 15;

/** Rasmni brauzerda tekshirish: o'lcham va hajm */
function checkImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return resolve("Faqat JPG, PNG yoki WEBP rasm yuklang");
    if (file.size > MAX_MB * 1024 * 1024) return resolve(`Rasm hajmi ${MAX_MB} MB dan oshmasin`);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const min = Math.min(img.width, img.height);
      resolve(min < 400 ? `Rasm juda kichik (${img.width}×${img.height}). Kamida 400 piksel bo'lsin — tiniqroq rasm yuklang` : null);
    };
    img.onerror = () => resolve("Rasmni o'qib bo'lmadi");
    img.src = URL.createObjectURL(file);
  });
}

/** Bitta rasm yuklash joyi (ko'p personajli shablonlarda bir nechtasi) */
function PhotoSlot({ label, hint, file, onChange, compact }: { label: string; hint?: string; file: File | null; onChange: (f: File | null) => void; compact?: boolean }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function pick(f?: File | null) {
    if (!f) return;
    const err = await checkImage(f);
    if (err) return toast(err, "error");
    onChange(f);
  }

  return (
    <div>
      <div className="label">{label}</div>
      {preview ? (
        <div className="relative w-fit">
          <img src={preview} alt={label} className={clsx("rounded-2xl border border-line object-contain", compact ? "max-h-48" : "max-h-72")} />
          <button onClick={() => onChange(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 hover:bg-black" aria-label="Rasmni o'chirish"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          className={clsx("flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 text-center transition", compact ? "py-7" : "py-10", drag ? "border-brand bg-brand/10" : "border-line bg-card hover:border-white/30")}>
          <ImagePlus className={clsx("text-brand-light", compact ? "h-8 w-8" : "h-10 w-10")} />
          <div className="font-semibold">Rasm yuklash</div>
          <div className="text-sm text-white/50">{hint || "Bosing yoki rasmni shu yerga tashlang · JPG, PNG, WEBP"}</div>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

export function TemplatePage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const toast = useToast();
  const { user, balance } = useMe();
  const { data: t, isLoading, error } = useQuery<TemplateCard>({ queryKey: [`/api/templates/${slug}`] });
  const [files, setFiles] = useState<(File | null)[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [variantKey, setVariantKey] = useState("");

  if (isLoading) return <PageLoader />;
  if (error || !t) return <Empty title="Shablon topilmadi" action={<Link href="/" className="text-brand-light">Bosh sahifaga</Link>} />;

  const slots = t.inputSlots?.length ? t.inputSlots : [{ label: "Rasmingiz" }];
  const multi = slots.length > 1;
  const allPicked = slots.every((_, i) => files[i]);
  const variants = t.variants ?? [];
  const variant = variants.find((v) => v.key === variantKey) ?? variants[0];
  const cost = variant?.creditCost ?? t.creditCost;

  async function submit() {
    if (!user) return navigate(`/login?next=/t/${slug}`);
    const missing = slots.findIndex((_, i) => !files[i]);
    if (missing >= 0) return toast(`${slots[missing].label}: rasm yuklang`, "error");
    if (!consent) return toast("Rozilik belgisini qo'ying", "error");
    const form = new FormData();
    form.append("templateSlug", t!.slug);
    form.append("consent", "true");
    if (variant?.key) form.append("variant", variant.key);
    slots.forEach((_, i) => form.append(i === 0 ? "photo" : `photo_${i + 1}`, files[i]!));
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/generations", { form });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      navigate(`/g/${r.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "NO_CREDITS") {
        toast("Kredit yetarli emas — tarif tanlang", "error");
        navigate("/pricing");
      } else toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const enough = balance >= cost;

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"><ChevronLeft className="h-4 w-4" /> Orqaga</Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-10">
        <div className="mx-auto w-full max-w-[240px] sm:max-w-[380px]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-3xl border border-white/5 bg-card">
            <TemplatePreview t={t} />
            <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs backdrop-blur">Namuna</div>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold">{t.title}</h1>
          {t.description && <p className="mt-2 text-white/60">{t.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="flex items-center gap-1 rounded-full bg-card px-3 py-1 ring-1 ring-line"><Zap className="h-4 w-4 fill-amber-300 text-amber-300" />{variants.length ? `${Math.min(...variants.map((v) => v.creditCost))} kreditdan` : `${t.creditCost} kredit`}</span>
            {t.allowAnimals && <span className="flex items-center gap-1 rounded-full bg-card px-3 py-1 ring-1 ring-line"><PawPrint className="h-4 w-4" />Hayvon rasmi ham mumkin</span>}
          </div>

          {variants.length > 1 && (
            <div className="mt-6">
              <div className="label">Variantni tanlang</div>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                {variants.map((v) => {
                  const on = v.key === variant?.key;
                  return (
                    <button key={v.key || "main"} type="button" role="radio" aria-checked={on} onClick={() => setVariantKey(v.key)}
                      className={clsx("relative rounded-2xl border p-4 text-left transition", on ? "border-brand bg-brand/10" : "border-line bg-card hover:border-white/30")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{v.label}</span>
                        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold"><Zap className="h-4 w-4 fill-amber-300 text-amber-300" />{v.creditCost}</span>
                      </div>
                      <div className="mt-1 text-xs text-white/50">{v.hint || (v.key ? "" : "Yuz, soch, gavda va kiyim to'liq almashtiriladi — viral videolar uchun eng yaxshisi")}</div>
                      {on && <Check className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-brand p-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6">
            {multi && <p className="mb-3 rounded-xl bg-brand/10 px-4 py-2.5 text-sm text-white/80">Bu videoda {slots.length} ta personaj bor — har biri uchun alohida rasm yuklang.</p>}
            <div className={multi ? "grid gap-3 sm:grid-cols-2" : ""}>
              {slots.map((slot, i) => (
                <PhotoSlot key={i} label={slot.label} hint={slot.hint} compact={multi} file={files[i] ?? null}
                  onChange={(f) => setFiles((cur) => { const n = [...cur]; n[i] = f; return n; })} />
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              [ScanFace, t.allowAnimals ? "Yuz (yoki hayvon) aniq va to'g'ri qaragan" : "Yuz aniq va to'g'ri qaragan"],
              [Sun, "Yorug' joyda, soyasiz"],
              [ImageIcon, multi ? "Har bir rasmda faqat bitta odam" : "Rasmda faqat bitta odam yoki hayvon"],
            ].map(([Icon, text], k) => {
              const I = Icon as typeof Sun;
              return <div key={k} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-xs text-white/70 ring-1 ring-line"><I className="h-4 w-4 shrink-0 text-brand-light" />{text as string}</div>;
            })}
          </div>
          {t.inputHint && <p className="mt-3 text-sm text-white/50">💡 {t.inputHint}</p>}

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-card p-4 text-sm text-white/70 ring-1 ring-line">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#7c5cff]" />
            <span>{multi ? "Rasmlardagi shaxslar — men o'zimman yoki ularning roziligini olganman." : "Rasmdagi shaxs — men o'zimman yoki uning roziligini olganman."} Bolalar va boshqa odamlarni ruxsatsiz ishlatmayman. <Link href="/terms" className="text-brand-light underline">Foydalanish shartlari</Link></span>
          </label>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" loading={busy} onClick={submit} disabled={!!user && (!allPicked || !consent)} className="w-full sm:w-auto">
              {user ? `Yaratish · ${cost} kredit` : "Kirish va yaratish"}
            </Button>
            {user && !enough && (
              <Link href="/pricing" className="text-center text-sm text-amber-300 underline">Kreditingiz {balance} ta — kredit sotib oling</Link>
            )}
          </div>
          <p className="mt-3 text-xs text-white/40">Natija 1–3 daqiqada tayyor bo'ladi. Muvaffaqiyatsiz bo'lsa kredit avtomatik qaytariladi. Yuklangan rasmlar 24 soatdan keyin o'chiriladi.</p>
        </div>
      </div>
    </div>
  );
}
