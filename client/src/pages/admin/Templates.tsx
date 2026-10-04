import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Save, FlaskConical, Info, Zap, Upload, ChevronLeft, Copy, Sparkles } from "lucide-react";
import { PIPELINE_PRESETS, KIND_LABELS, FACE_SWAP_VARIANT, MAIN_VARIANT_LABEL, buildMotionControlSteps } from "@shared/presets";
import { checkRecipe, estimateCostUsd, nearestAspectRatio, recommendedCredits } from "@shared/recipe";
import type { InputSlot, PipelineStep, SourceMeta, TemplateVariant } from "@shared/schema";
import { api, formatUzs, queryClient } from "@/lib/api";
import { Badge, Button, Card, Empty, Modal, NumInput, PageLoader, Toggle, clsx, useToast } from "@/components/ui";
import { PageHead } from "./AdminLayout";
import { MediaWizard, type WizardResult } from "./MediaWizard";
import { extOfFile, formatMeta, probeMedia, dataUrlToFile } from "./media";

type AdminTemplate = {
  id: number; slug: string; title: string; description: string; categoryId: number | null; kind: keyof typeof KIND_LABELS | string;
  previewUrl: string | null; posterUrl: string | null; sourceVideoUrl: string | null; sourceIsVideo?: boolean; sourceVideoPath?: string | null; previewPath: string | null;
  steps: PipelineStep[]; inputSlots: InputSlot[]; mainLabel: string; variants: TemplateVariant[]; creditCost: number;
  sourceMeta: SourceMeta | null; frameUrl?: string | null; checks?: { errors: string[]; warnings: string[] }; allowAnimals: boolean; inputHint: string; isActive: boolean; isFeatured: boolean;
  isNew: boolean; sortOrder: number; usageCount: number; estimatedCostUsd: number;
};
type Category = { id: number; title: string; emoji: string };
type Settings = { values: { usdToUzs: number } };
type PlanLite = { id: number; credits: number; priceUzs: number; isActive: boolean };

const isVideoUrl = (u?: string | null) => !!u && /\.(mp4|webm|mov)(\?|$)/i.test(u);

function Preview({ url, poster, className }: { url: string | null; poster?: string | null; className?: string }) {
  if (!url) return <div className={clsx("flex items-center justify-center bg-white/5 text-xs text-white/30", className)}>Namuna yo'q</div>;
  return isVideoUrl(url)
    ? <video src={url} poster={poster || undefined} muted loop autoPlay playsInline className={clsx("object-cover", className)} />
    : <img src={url} alt="" className={clsx("object-cover", className)} />;
}

// ---------------------------------------------------------------------------
// Ro'yxat
// ---------------------------------------------------------------------------
export function AdminTemplates() {
  const toast = useToast();
  const { data, isLoading } = useQuery<AdminTemplate[]>({ queryKey: ["/api/admin/templates"] });
  const { data: cats } = useQuery<Category[]>({ queryKey: ["/api/admin/categories"] });
  const [filter, setFilter] = useState<"all" | "active" | "hidden">("all");

  async function patch(t: AdminTemplate, body: object) {
    try {
      await api(`/api/admin/templates/${t.id}`, { method: "PATCH", body });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
    } catch (e) { toast((e as Error).message, "error"); }
  }
  async function remove(t: AdminTemplate) {
    if (!confirm(`"${t.title}" shablonini butunlay o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    await api(`/api/admin/templates/${t.id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
    toast("Shablon o'chirildi");
  }

  if (isLoading) return <PageLoader />;
  const list = (data || []).filter((t) => filter === "all" || (filter === "active" ? t.isActive : !t.isActive));

  return (
    <div>
      <PageHead title="Shablonlar" subtitle="Yangi trend chiqqanda shu yerdan qo'shing — kod yozish shart emas"
        action={<Link href="/admin/templates/new"><Button><Plus className="h-4 w-4" />Yangi shablon</Button></Link>} />
      <div className="mb-4 flex gap-2">
        {([["all", "Hammasi"], ["active", "Faol"], ["hidden", "Yashirin"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={clsx("rounded-full px-4 py-1.5 text-sm", filter === k ? "bg-white text-black" : "bg-card text-white/60 ring-1 ring-line")}>{l}</button>
        ))}
      </div>
      {!list.length ? <Empty title="Shablon yo'q" action={<Link href="/admin/templates/new"><Button>Birinchi shablonni qo'shish</Button></Link>} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <Card key={t.id} className="flex gap-4 p-3">
              <Link href={`/admin/templates/${t.id}`} className="shrink-0"><Preview url={t.previewUrl} poster={t.posterUrl} className="h-36 w-[81px] rounded-xl" /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/admin/templates/${t.id}`} className="truncate font-semibold hover:text-brand-light">{t.title}</Link>
                  <span className="flex shrink-0 items-center gap-0.5 text-xs text-white/60"><Zap className="h-3 w-3 fill-amber-300 text-amber-300" />{t.creditCost}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge>{KIND_LABELS[t.kind] || t.kind}</Badge>
                  {cats?.find((c) => c.id === t.categoryId) && <Badge color="blue">{cats.find((c) => c.id === t.categoryId)!.title}</Badge>}
                  {t.isNew && <Badge color="brand">Yangi</Badge>}
                </div>
                <div className="mt-1 text-xs text-white/40">{t.steps.length} qadam · ~${t.estimatedCostUsd.toFixed(2)} · {t.usageCount} marta</div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex flex-col gap-1.5">
                    <Toggle checked={t.isActive} onChange={(v) => patch(t, { isActive: v })} label={<span className="text-xs text-white/60">Faol</span>} />
                    <Toggle checked={t.isFeatured} onChange={(v) => patch(t, { isFeatured: v })} label={<span className="text-xs text-white/60">Bosh sahifada</span>} />
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/admin/templates/${t.id}`} className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white" aria-label="Tahrirlash"><Pencil className="h-4 w-4" /></Link>
                    <button onClick={() => remove(t)} className="rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-300" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Muharrir
// ---------------------------------------------------------------------------
type Form = Omit<AdminTemplate, "id" | "previewUrl" | "posterUrl" | "sourceVideoUrl" | "previewPath" | "usageCount" | "estimatedCostUsd" | "frameUrl" | "checks">;
const EMPTY: Form = {
  title: "", slug: "", description: "", categoryId: null, kind: "effect", steps: PIPELINE_PRESETS.effect.steps,
  inputSlots: [], mainLabel: MAIN_VARIANT_LABEL, variants: [], sourceMeta: null, creditCost: 1, allowAnimals: false, inputHint: "", isActive: false, isFeatured: false, isNew: true, sortOrder: 0,
};

function FilePick({ label, accept, current, file, onFile, hint, forceVideo }: { label: string; accept: string; current: string | null; file: File | null; onFile: (f: File | null) => void; hint?: string; forceVideo?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const local = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);
  const shown = local || current;
  const video = file ? file.type.startsWith("video") : forceVideo || isVideoUrl(current);
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex items-center gap-3">
        <div className="h-28 w-[63px] shrink-0 overflow-hidden rounded-xl bg-white/5">
          {shown && (video ? <video src={shown} muted loop autoPlay playsInline className="h-full w-full object-cover" /> : <img src={shown} alt="" className="h-full w-full object-cover" />)}
        </div>
        <div className="min-w-0">
          <Button type="button" size="sm" variant="secondary" onClick={() => ref.current?.click()}><Upload className="h-4 w-4" />{shown ? "Almashtirish" : "Yuklash"}</Button>
          {file && <div className="mt-1 truncate text-xs text-white/50">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</div>}
          {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
        </div>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { onFile(e.target.files?.[0] || null); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function StepEditor({ steps, onChange }: { steps: PipelineStep[]; onChange: (s: PipelineStep[]) => void }) {
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState("");
  const [drafts, setDrafts] = useState<string[]>([]);
  // Qadamlar tashqaridan o'zgarsa (andoza, AI tahlil) — matn maydonlarini yangilaymiz,
  // admin hozir yozayotgan (mos keladigan) matnga tegmaymiz
  useEffect(() => {
    setDrafts((prev) => steps.map((s, i) => {
      try { if (prev[i] !== undefined && JSON.stringify(JSON.parse(prev[i])) === JSON.stringify(s.input)) return prev[i]; } catch { /* yozilmoqda */ }
      return JSON.stringify(s.input, null, 2);
    }));
  }, [steps]);

  const update = (i: number, patch: Partial<PipelineStep>) => onChange(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= steps.length) return;
    const next = [...steps]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
    const nd = [...drafts]; [nd[i], nd[j]] = [nd[j], nd[i]]; setDrafts(nd);
  };

  if (raw) {
    return (
      <div>
        <textarea className="input min-h-[420px] font-mono text-xs" value={rawText} onChange={(e) => setRawText(e.target.value)} spellCheck={false} />
        <div className="mt-2 flex gap-2">
          <Button size="sm" type="button" onClick={() => { try { const v = JSON.parse(rawText); if (!Array.isArray(v)) throw 0; onChange(v); setDrafts(v.map((s: PipelineStep) => JSON.stringify(s.input, null, 2))); setRaw(false); } catch { alert("JSON noto'g'ri yoki massiv emas"); } }}>Qo'llash</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setRaw(false)}>Bekor qilish</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={i} className="rounded-2xl border border-line bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/30 text-xs font-bold">{i + 1}</span>
              <input className="w-48 bg-transparent text-sm font-semibold outline-none" value={s.label || ""} placeholder="Qadam nomi" onChange={(e) => update(i, { label: e.target.value })} /></div>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} className="rounded p-1 text-white/50 hover:bg-white/5" aria-label="Yuqoriga"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(i, 1)} className="rounded p-1 text-white/50 hover:bg-white/5" aria-label="Pastga"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => { onChange(steps.filter((_, k) => k !== i)); setDrafts(drafts.filter((_, k) => k !== i)); }} className="rounded p-1 text-white/50 hover:bg-red-500/10 hover:text-red-300" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_110px_95px_95px]">
            <div><div className="label">Model (fal.ai endpoint)</div><input className="input font-mono text-xs" value={s.endpoint} onChange={(e) => update(i, { endpoint: e.target.value.trim() })} /></div>
            <div><div className="label">Natija</div>
              <select className="input" value={s.output} onChange={(e) => update(i, { output: e.target.value as "video" | "image" })}><option value="video">Video</option><option value="image">Rasm</option></select></div>
            <div><div className="label" title="Qat'iy narx (masalan rasm tahriri)">Narx, $</div><NumInput decimal value={s.costUsd ?? 0} onChange={(n) => update(i, { costUsd: n || undefined })} /></div>
            <div><div className="label" title="Video modellari soniyasiga narxlanadi">$ / soniya</div><NumInput decimal value={s.costPerSecUsd ?? 0} onChange={(n) => update(i, { costPerSecUsd: n || undefined })} /></div>
          </div>
          <div className="mt-3">
            <div className="label">Kirish parametrlari (JSON)</div>
            <textarea spellCheck={false} className={clsx("input min-h-[120px] font-mono text-xs", (() => { try { JSON.parse(drafts[i] ?? "{}"); return ""; } catch { return "border-red-500"; } })())}
              value={drafts[i] ?? JSON.stringify(s.input, null, 2)}
              onChange={(e) => { const nd = [...drafts]; nd[i] = e.target.value; setDrafts(nd); try { update(i, { input: JSON.parse(e.target.value) }); } catch { /* yozilmoqda */ } }} />
          </div>
          <div className="mt-2"><Toggle checked={!!s.final} onChange={(v) => update(i, { final: v })} label={<span className="text-xs text-white/60">Natija mijozga beriladi (fotosessiyada har bir rasm uchun yoqing)</span>} /></div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => { onChange([...steps, { label: "Yangi qadam", endpoint: "fal-ai/nano-banana-2/edit", input: { prompt: "", image_urls: ["{{user_image}}"] }, output: "image", costUsd: 0.08 }]); }}>
          <Plus className="h-4 w-4" />Qadam qo'shish</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setRawText(JSON.stringify(steps, null, 2)); setRaw(true); }}>JSON ko'rinishida tahrirlash</Button>
      </div>
    </div>
  );
}

/** Mijozdan nechta va qanday rasm so'ralishi (ko'p personajli shablonlar) */
function SlotEditor({ slots, onChange }: { slots: InputSlot[]; onChange: (s: InputSlot[]) => void }) {
  const list = slots.length ? slots : [{ label: "Rasmingiz" }];
  const update = (i: number, patch: Partial<InputSlot>) => onChange(list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <Card className="p-5">
      <div className="label">Mijozdan so'raladigan rasmlar</div>
      <div className="space-y-2">
        {list.map((sl, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-white/40">{list.length > 1 ? `@Image${i + 1}` : "rasm"}</span>
            <input className="input py-2" value={sl.label} placeholder="Masalan: Kuyov" onChange={(e) => update(i, { label: e.target.value })} />
            {list.length > 1 && (
              <button type="button" onClick={() => onChange(list.filter((_, k) => k !== i))} className="rounded-lg p-2 text-white/50 hover:text-red-300" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        ))}
      </div>
      {list.length < 4 && (
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => onChange([...list, { label: `${list.length + 1}-personaj` }])}>
          <Plus className="h-4 w-4" />Rasm joyi qo'shish
        </Button>
      )}
      <p className="mt-1 text-xs text-white/40">Bir nechta personajli videolar uchun. Har bir joy retseptda <code>{"{{user_image_N}}"}</code> ga mos keladi.</p>
    </Card>
  );
}

export function AdminTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const [, navigate] = useLocation();
  const toast = useToast();
  const { data: existing, isLoading } = useQuery<AdminTemplate>({ queryKey: [`/api/admin/templates/${id}`], enabled: !isNew });
  const { data: cats } = useQuery<Category[]>({ queryKey: ["/api/admin/categories"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/admin/settings"] });
  const [f, setF] = useState<Form>(EMPTY);
  const { data: plans } = useQuery<PlanLite[]>({ queryKey: ["/api/admin/plans"] });
  const [files, setFiles] = useState<{ preview: File | null; poster: File | null; sourceVideo: File | null; frame: File | null }>({ preview: null, poster: null, sourceVideo: null, frame: null });
  const [framePreview, setFramePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [testVariant, setTestVariant] = useState("");
  const [wizard, setWizard] = useState(isNew);

  useEffect(() => {
    if (existing) {
      const { id: _i, previewUrl: _p, posterUrl: _po, sourceVideoUrl: _s, sourceIsVideo: _sv, previewPath: _pp, usageCount: _u, estimatedCostUsd: _e, frameUrl: _fu, checks: _c, ...rest } = existing;
      setF({ ...(rest as Form), sourceMeta: existing.sourceMeta ?? null });
    }
  }, [existing]);

  if (!isNew && isLoading) return <PageLoader />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const needsVideo = /\{\{template_(video|image)\}\}/.test(JSON.stringify(f.steps));
  const usdToUzs = settings?.values.usdToUzs || 12500;
  const duration = f.sourceMeta?.durationSec || null;
  const costUsd = estimateCostUsd(f.steps, duration);
  // Eng arzon tarifdagi 1 kredit narxi — eng yomon holatdagi tushum
  const activePlans = (plans || []).filter((p) => p.isActive && p.credits > 0);
  const minCreditUzs = activePlans.length ? Math.min(...activePlans.map((p) => p.priceUzs / p.credits)) : 0;
  /** Retsept uchun tavsiya etilgan kredit (tariflar yuklanmagan bo'lsa — fallback) */
  const recFor = (steps: PipelineStep[], meta: SourceMeta | null, fallback: number) =>
    minCreditUzs ? recommendedCredits(estimateCostUsd(steps, meta?.durationSec), usdToUzs, minCreditUzs) : fallback;
  const marginOf = (credits: number, usd: number) => (minCreditUzs && credits > 0 ? 1 - (usd * usdToUzs) / (credits * minCreditUzs) : null);
  const sourceExt = files.sourceVideo ? extOfFile(files.sourceVideo) : existing?.sourceVideoPath?.split(".").pop()?.toLowerCase() || null;
  const hasFrame = !!files.frame || (!files.sourceVideo && !!(existing?.frameUrl || existing?.posterUrl || files.poster));
  const live = (() => {
    const src = { ext: sourceExt, meta: f.sourceMeta, hasFrame };
    const main = checkRecipe(f.steps, src);
    const vs = f.variants.map((v) => ({ label: v.label, ...checkRecipe(v.steps, src) }));
    const errors = [...main.errors, ...vs.flatMap((v) => v.errors.filter((e) => !main.errors.includes(e)).map((e) => `«${v.label}»: ${e}`))];
    const warnings = [...main.warnings, ...vs.flatMap((v) => v.warnings.filter((w) => !main.warnings.includes(w)).map((w) => `«${v.label}»: ${w}`))];
    if (f.allowAnimals && JSON.stringify([f.steps, f.variants]).includes('"elements"')) {
      warnings.push("Retseptda mijoz yuzini bog'lash (elements) bor — hayvon rasmi bilan xato berishi mumkin. Hayvonlar uchun Wan retseptini ishlating yoki \"elements\"ni olib tashlang");
    }
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  })();

  /** Asl video tanlanganda: 1-kadr va o'lcham/davomiylik brauzerda aniqlanadi */
  async function onSourcePicked(file: File | null) {
    setFiles((s) => ({ ...s, sourceVideo: file, frame: null }));
    setFramePreview(null);
    if (!file) return;
    try {
      const r = await probeMedia(file, { analysisFrames: false });
      const frame = r.firstFull ? await dataUrlToFile(r.firstFull, "frame.jpg") : null;
      setFiles((s) => ({ ...s, frame }));
      setFramePreview(r.firstFull);
      setF((s) => ({ ...s, sourceMeta: r.meta }));
    } catch {
      toast("Videoni o'qib bo'lmadi — MP4 formatida yuklab ko'ring", "error");
      setF((s) => ({ ...s, sourceMeta: null }));
    }
  }

  function applyWizard(r: WizardResult) {
    setFiles((s) => ({ ...s, preview: r.file, sourceVideo: r.file, poster: r.poster ?? s.poster, frame: r.frame }));
    setFramePreview(null);
    if (r.frame) { const u = URL.createObjectURL(r.frame); setFramePreview(u); }
    setF((s) => ({ ...s, sourceMeta: r.meta }));
    if (r.fill) {
      const fill = r.fill;
      setF((s) => ({
        ...s,
        title: fill.title || s.title, description: fill.description || s.description, inputHint: fill.inputHint || s.inputHint,
        allowAnimals: fill.allowAnimals, kind: fill.kind, steps: fill.steps, inputSlots: fill.inputSlots,
        mainLabel: fill.mainLabel || s.mainLabel,
        variants: (fill.variants ?? (fill.kind === "multi_character" ? [] : s.variants)).map((v) => ({ ...v, creditCost: recFor(v.steps, r.meta, v.creditCost) })),
        creditCost: recFor(fill.steps, r.meta, fill.kind === "multi_character" ? 4 : 3),
      }));
    } else if (r.mediaType === "video" && isNew) {
      const aspectRatio = r.meta ? nearestAspectRatio(r.meta.width, r.meta.height) : undefined;
      const steps = buildMotionControlSteps({ aspectRatio });
      setF((s) => ({ ...s, kind: "motion_control", allowAnimals: false, steps,
        mainLabel: MAIN_VARIANT_LABEL, variants: [{ ...structuredClone(FACE_SWAP_VARIANT), creditCost: recFor(FACE_SWAP_VARIANT.steps, r.meta, 1) }],
        creditCost: recFor(steps, r.meta, 3) }));
    }
    setWizard(false);
    toast(r.fill?.title ? "AI taklifi formaga qo'llandi — tekshirib, saqlang" : "Media qo'shildi — ma'lumotlarni kiriting");
  }

  function applyPreset(kind: Form["kind"]) {
    set("kind", kind);
    const preset = PIPELINE_PRESETS[kind as keyof typeof PIPELINE_PRESETS];
    if (preset && (isNew || confirm(`"${preset.title}" andozasi qadamlarini qo'llaymi? Hozirgi qadamlar almashtiriladi.`))) {
      const aspectRatio = f.sourceMeta ? nearestAspectRatio(f.sourceMeta.width, f.sourceMeta.height) : undefined;
      const steps = kind === "motion_control" ? buildMotionControlSteps({ aspectRatio }) : structuredClone(preset.steps);
      setF((s) => ({ ...s, steps, creditCost: recFor(steps, s.sourceMeta, s.creditCost) }));
      if (kind === "character_replace") set("allowAnimals", true);
      if (kind === "motion_control") set("allowAnimals", false);
      if (kind === "multi_character") {
        setF((s) => ({ ...s, variants: [],
          inputSlots: s.inputSlots.length >= 2 ? s.inputSlots : [{ label: "1-personaj" }, { label: "2-personaj" }] }));
      }
    }
  }

  async function save() {
    const form = new FormData();
    form.append("data", JSON.stringify(f));
    if (files.preview) form.append("preview", files.preview);
    if (files.poster) form.append("poster", files.poster);
    if (files.sourceVideo) form.append("sourceVideo", files.sourceVideo);
    if (files.frame) form.append("frame", files.frame);
    setSaving(true);
    try {
      const t = await api<AdminTemplate>(isNew ? "/api/admin/templates" : `/api/admin/templates/${id}`, { method: isNew ? "POST" : "PUT", form });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/templates/${t.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      setFiles({ preview: null, poster: null, sourceVideo: null, frame: null });
      toast("Saqlandi");
      if (isNew) navigate(`/admin/templates/${t.id}`);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setSaving(false); }
  }

  async function runTest() {
    if (!testFile || !existing) return;
    const form = new FormData();
    form.append("templateSlug", existing.slug);
    form.append("consent", "true");
    form.append("photo", testFile);
    if (testVariant) form.append("variant", testVariant);
    setTesting(true);
    try {
      const r = await api<{ id: string }>("/api/generations?test=1", { form });
      navigate(`/g/${r.id}`);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setTesting(false); }
  }

  const preset = PIPELINE_PRESETS[f.kind as keyof typeof PIPELINE_PRESETS];
  const hasFace = f.variants.some((v) => v.key === FACE_SWAP_VARIANT.key);
  const faceAllowed = f.kind !== "multi_character" && f.inputSlots.length <= 1;
  function toggleFace(on: boolean) {
    setF((s) => ({
      ...s,
      variants: on
        ? [...s.variants, { ...structuredClone(FACE_SWAP_VARIANT), creditCost: recFor(FACE_SWAP_VARIANT.steps, s.sourceMeta, 1) }]
        : s.variants.filter((v) => v.key !== FACE_SWAP_VARIANT.key),
    }));
  }
  const setVariant = (i: number, patch: Partial<TemplateVariant>) =>
    setF((s) => ({ ...s, variants: s.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)) }));
  const variantCost = (v: TemplateVariant) => estimateCostUsd(v.steps, duration);
  const frameShown = framePreview || (!files.sourceVideo ? existing?.frameUrl : null);
  const needsFrame = /template_frame/.test(JSON.stringify([f.steps, f.variants]));

  /** Bitta narx qatori: tannarx, mijoz to'laydigan kredit, foyda va tavsiya */
  function economyRow(key: string, label: string, usd: number, credits: number) {
    const margin = marginOf(credits, usd);
    const rec = recommendedCredits(usd, usdToUzs, minCreditUzs);
    return (
      <div key={key} className="border-t border-white/5 py-2 first:border-0 first:pt-0">
        <div className="flex justify-between gap-2"><span className="text-white/60">{label}</span><b>{credits} kredit</b></div>
        <div className="flex justify-between gap-2 text-xs text-white/50"><span>Tannarx ${usd.toFixed(2)} ≈ {formatUzs(Math.round(usd * usdToUzs))}</span>
          {margin !== null && <span className={margin < 0.2 ? "text-red-300" : margin < 0.45 ? "text-amber-200" : "text-emerald-300"}>foyda {Math.round(margin * 100)}%</span>}</div>
        {margin !== null && credits < rec && <div className="mt-1 text-xs text-amber-200">Tavsiya: kamida {rec} kredit (eng arzon tarifda ham zarar bo'lmasligi uchun)</div>}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Link href="/admin/templates" className="mb-3 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"><ChevronLeft className="h-4 w-4" />Shablonlar</Link>
      <PageHead title={isNew ? "Yangi shablon" : f.title || "Shablon"} subtitle={isNew ? "Avval ma'lumotlarni to'ldiring, saqlang, keyin sinab ko'ring" : `/${f.slug}`}
        action={<div className="flex gap-2">
          <Button variant="secondary" onClick={() => setWizard(true)}><Sparkles className="h-4 w-4" />AI tahlil</Button>
          {!isNew && <Button variant="secondary" onClick={() => setTestOpen(true)}><FlaskConical className="h-4 w-4" />Sinab ko'rish</Button>}
          <Button loading={saving} onClick={save}><Save className="h-4 w-4" />Saqlash</Button>
        </div>} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Nomi *</label><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Masalan: Lazgi raqsi" /></div>
              <div><label className="label">Manzil (slug)</label><input className="input" value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="avtomatik" /></div>
            </div>
            <div><label className="label">Tavsif</label><textarea className="input min-h-[70px]" value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">Kategoriya</label>
                <select className="input" value={f.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— tanlanmagan —</option>
                  {cats?.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}
                </select></div>
              <div><label className="label">Narxi (kredit)</label><NumInput value={f.creditCost} onChange={(n) => set("creditCost", n)} /></div>
              <div><label className="label">Tartib raqami</label><NumInput value={f.sortOrder} onChange={(n) => set("sortOrder", n)} /></div>
            </div>
            <div><label className="label">Mijozga maslahat</label><input className="input" value={f.inputHint} onChange={(e) => set("inputHint", e.target.value)} placeholder="Masalan: Butun gavdangiz ko'rinadigan rasm yuklang" /></div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="font-semibold">AI retsepti</div>
              <select className="input w-auto" value={f.kind} onChange={(e) => applyPreset(e.target.value)}>
                {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {preset && <p className="mb-4 rounded-xl bg-brand/10 p-3 text-sm text-white/70">{preset.description}</p>}
            {(live.errors.length > 0 || live.warnings.length > 0) && (
              <div className="mb-4 space-y-1 rounded-xl border border-line p-3 text-sm">
                {live.errors.map((e) => <div key={e} className="text-red-300">✕ {e}</div>)}
                {live.warnings.map((w) => <div key={w} className="text-amber-200">! {w}</div>)}
                {live.errors.length > 0 && <div className="pt-1 text-xs text-white/40">Xatolar tuzatilmaguncha shablon saqlanmaydi — aks holda mijoz puli AI xatosiga ketadi.</div>}
              </div>
            )}
            <StepEditor steps={f.steps} onChange={(s) => set("steps", s)} />
            <details className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-white/60">
              <summary className="flex cursor-pointer items-center gap-2 font-medium text-white/80"><Info className="h-4 w-4" />O'rinbosarlar va maslahatlar</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><code>{"{{user_image}}"}</code> — mijoz yuklagan rasm. Bir nechta rasm joyi bo'lsa: <code>{"{{user_image_1}}"}</code>, <code>{"{{user_image_2}}"}</code>...</li>
                <li>Kling O1 promptida mijoz rasmlari <code>@Image1</code>, <code>@Image2</code> deb yoziladi (image_urls tartibida)</li>
                <li><code>{"{{template_video}}"}</code> / <code>{"{{template_image}}"}</code> — o'ng tomonda yuklangan asl video yoki rasm</li>
                <li><code>{"{{template_frame}}"}</code> — muqova rasm (videoning 1-kadri). Motion Control: shu kadrda odam almashtiriladi, keyin video harakati o'tkaziladi</li>
                <li><code>{"{{prev}}"}</code> — oldingi qadam natijasi, <code>{"{{step_0}}"}</code> — 1-qadam natijasi</li>
                <li>Promptlarni ingliz tilida yozing va "keep the exact same face" qo'shing — yuz o'xshashligi yaxshilanadi</li>
                <li>Har bir modelni avval fal.ai Playground'da sinab, eng yaxshi parametrlarni shu yerga ko'chiring</li>
              </ul>
            </details>
          </Card>

          <Card className="p-5">
            <div className="mb-1 font-semibold">Mijozga variantlar</div>
            <p className="mb-4 text-sm text-white/50">Mijoz shablon sahifasida variantni o'zi tanlaydi va narxini ko'radi. Asosiy variant — yuqoridagi retsept.</p>
            {faceAllowed ? (
              <Toggle checked={hasFace} onChange={toggleFace} label="Arzon «Faqat yuz» variantini qo'shish" />
            ) : (
              <p className="text-sm text-white/40">Ko'p personajli shablonlarda variantlar o'chirilgan.</p>
            )}
            {f.variants.length > 0 && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-line p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <div><label className="label">Asosiy variant nomi</label><input className="input" value={f.mainLabel} maxLength={40} onChange={(e) => set("mainLabel", e.target.value)} /></div>
                    <div><label className="label">Narxi</label><div className="input flex items-center gap-1 text-white/60"><Zap className="h-4 w-4 fill-amber-300 text-amber-300" />{f.creditCost} kredit</div></div>
                  </div>
                </div>
                {f.variants.map((v, i) => (
                  <div key={v.key} className="space-y-3 rounded-xl border border-brand/40 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                      <div><label className="label">Variant nomi</label><input className="input" value={v.label} maxLength={40} onChange={(e) => setVariant(i, { label: e.target.value })} /></div>
                      <div><label className="label">Narxi (kredit)</label><NumInput value={v.creditCost} onChange={(n) => setVariant(i, { creditCost: n })} /></div>
                    </div>
                    <div><label className="label">Izoh (mijozga)</label><input className="input" value={v.hint ?? ""} maxLength={120} onChange={(e) => setVariant(i, { hint: e.target.value })} /></div>
                    <StepEditor steps={v.steps} onChange={(st) => setVariant(i, { steps: st })} />
                    <p className="text-xs text-white/40">Tannarx: ${variantCost(v).toFixed(2)}{duration ? ` (${duration.toFixed(1)} s video uchun)` : " (5 s video uchun)"}.</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <SlotEditor slots={f.inputSlots} onChange={(v) => set("inputSlots", v)} />
          <Card className="space-y-3 p-5">
            <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} label="Faol (mijozlarga ko'rinadi)" />
            <Toggle checked={f.isFeatured} onChange={(v) => set("isFeatured", v)} label="Bosh sahifa bannerida" />
            <Toggle checked={f.isNew} onChange={(v) => set("isNew", v)} label={`"Yangi" belgisi`} />
            <Toggle checked={f.allowAnimals} onChange={(v) => set("allowAnimals", v)} label="Hayvon rasmi ham mumkin" />
          </Card>
          <Card className="space-y-5 p-5">
            <FilePick label="Namuna video (kartochkada)" accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" current={existing?.previewUrl ?? null} file={files.preview}
              onFile={(x) => setFiles((s) => ({ ...s, preview: x }))} hint="9:16, 5–10 soniya, 10 MB gacha" />
            <FilePick label="Muqova rasm (ixtiyoriy)" accept="image/jpeg,image/png,image/webp" current={existing?.posterUrl ?? null} file={files.poster}
              onFile={(x) => setFiles((s) => ({ ...s, poster: x }))} hint={/\{\{template_frame\}\}/.test(JSON.stringify(f.steps)) ? "Motion Control uchun shart: videoning 1-kadri (AI tahlil avtomatik qo'yadi)" : "Video yuklanguncha ko'rinadi"} />
            {(needsVideo || existing?.sourceVideoUrl) && (
              <div>
                <FilePick label={`Asl media (video yoki rasm)${needsVideo ? " *" : ""}`} accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp" current={existing?.sourceVideoUrl ?? null} file={files.sourceVideo}
                  forceVideo={existing?.sourceIsVideo} onFile={onSourcePicked} hint="MP4, 5–10 soniya, 720p+, bitta uzluksiz kadr. Mijozlarga ko'rinmaydi" />
                {f.sourceMeta && <div className="mt-2 text-xs text-white/50">{(sourceExt || "").toUpperCase()} · {formatMeta(f.sourceMeta)}</div>}
              </div>
            )}
            {needsFrame && (
              <FilePick label="Videoning 1-kadri (Motion Control)" accept="image/jpeg,image/png,image/webp" current={frameShown ?? null} file={files.frame}
                onFile={(x) => { setFiles((s) => ({ ...s, frame: x })); setFramePreview(null); }}
                hint={frameShown || files.frame ? "Asl videodan avtomatik olindi" : "Brauzer videoni o'qiy olmadi — videoning eng birinchi kadrini rasm qilib yuklang"} />
            )}
          </Card>
          <Card className="p-5 text-sm">
            <div className="label">Iqtisodiyot{duration ? ` · ${duration.toFixed(1)} s video` : ""}</div>
            {economyRow("main", f.variants.length ? `«${f.mainLabel}»` : "Mijoz to'laydi", costUsd, f.creditCost)}
            {f.variants.map((v) => economyRow(v.key, `«${v.label}»`, variantCost(v), v.creditCost))}
            <p className="mt-2 text-xs text-white/40">
              {minCreditUzs ? `Eng arzon tarifda 1 kredit ≈ ${formatUzs(Math.round(minCreditUzs))}. ` : "Tariflar qo'shilmagan. "}
              Video modellari soniyasiga narxlanadi{duration ? "" : " (davomiylik noma'lum — 5 soniya deb hisoblandi)"}. Tannarx tushumning 50% idan oshmasligi tavsiya etiladi.
            </p>
          </Card>
          {!isNew && existing && (
            <Card className="p-5 text-sm">
              <div className="label">Havola</div>
              <button className="flex items-center gap-2 text-brand-light" onClick={() => { navigator.clipboard.writeText(`${location.origin}/t/${existing.slug}`); toast("Nusxa olindi"); }}><Copy className="h-4 w-4" />/t/{existing.slug}</button>
            </Card>
          )}
        </div>
      </div>

      <MediaWizard open={wizard} onClose={() => setWizard(false)} onDone={applyWizard} />

      <Modal open={testOpen} onClose={() => setTestOpen(false)} title="Shablonni sinab ko'rish">
        <p className="mb-4 text-sm text-white/60">Rasm yuklang — generatsiya sizning hisobingizdan <b>kreditsiz</b> bajariladi (yashirin shablon ham ishlaydi). Haqiqiy AI rejimida fal.ai hisobidan pul yechiladi.</p>
        {f.variants.length > 0 && (
          <select className="input mb-3" value={testVariant} onChange={(e) => setTestVariant(e.target.value)}>
            <option value="">{f.mainLabel}</option>
            {f.variants.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setTestFile(e.target.files?.[0] || null)} className="mb-4 block w-full text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white" />
        <Button className="w-full" loading={testing} disabled={!testFile} onClick={runTest}><FlaskConical className="h-4 w-4" />Sinovni boshlash</Button>
      </Modal>
    </div>
  );
}
