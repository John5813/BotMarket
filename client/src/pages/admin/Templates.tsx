import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Save, FlaskConical, Info, Zap, Upload, ChevronLeft, Copy } from "lucide-react";
import { PIPELINE_PRESETS, KIND_LABELS } from "@shared/presets";
import type { PipelineStep } from "@shared/schema";
import { api, formatUzs, queryClient } from "@/lib/api";
import { Badge, Button, Card, Empty, Modal, PageLoader, Toggle, clsx, useToast } from "@/components/ui";
import { PageHead } from "./AdminLayout";

type AdminTemplate = {
  id: number; slug: string; title: string; description: string; categoryId: number | null; kind: keyof typeof KIND_LABELS | string;
  previewUrl: string | null; posterUrl: string | null; sourceVideoUrl: string | null; previewPath: string | null;
  steps: PipelineStep[]; creditCost: number; allowAnimals: boolean; inputHint: string; isActive: boolean; isFeatured: boolean;
  isNew: boolean; sortOrder: number; usageCount: number; estimatedCostUsd: number;
};
type Category = { id: number; title: string; emoji: string };
type Settings = { values: { usdToUzs: number } };

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
type Form = Omit<AdminTemplate, "id" | "previewUrl" | "posterUrl" | "sourceVideoUrl" | "previewPath" | "usageCount" | "estimatedCostUsd">;
const EMPTY: Form = {
  title: "", slug: "", description: "", categoryId: null, kind: "effect", steps: PIPELINE_PRESETS.effect.steps,
  creditCost: 1, allowAnimals: false, inputHint: "", isActive: false, isFeatured: false, isNew: true, sortOrder: 0,
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
  useEffect(() => { setDrafts(steps.map((s) => JSON.stringify(s.input, null, 2))); }, [steps.length]); // eslint-disable-line

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
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_110px]">
            <div><div className="label">Model (fal.ai endpoint)</div><input className="input font-mono text-xs" value={s.endpoint} onChange={(e) => update(i, { endpoint: e.target.value.trim() })} /></div>
            <div><div className="label">Natija</div>
              <select className="input" value={s.output} onChange={(e) => update(i, { output: e.target.value as "video" | "image" })}><option value="video">Video</option><option value="image">Rasm</option></select></div>
            <div><div className="label">Narxi ($)</div><input className="input" type="number" step="0.01" min="0" value={s.costUsd ?? 0} onChange={(e) => update(i, { costUsd: Number(e.target.value) })} /></div>
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
        <Button type="button" size="sm" variant="secondary" onClick={() => { onChange([...steps, { label: "Yangi qadam", endpoint: "fal-ai/nano-banana/edit", input: { prompt: "", image_urls: ["{{user_image}}"] }, output: "image", costUsd: 0.04 }]); }}>
          <Plus className="h-4 w-4" />Qadam qo'shish</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setRawText(JSON.stringify(steps, null, 2)); setRaw(true); }}>JSON ko'rinishida tahrirlash</Button>
      </div>
    </div>
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
  const [files, setFiles] = useState<{ preview: File | null; poster: File | null; sourceVideo: File | null }>({ preview: null, poster: null, sourceVideo: null });
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (existing) {
      const { id: _i, previewUrl: _p, posterUrl: _po, sourceVideoUrl: _s, previewPath: _pp, usageCount: _u, estimatedCostUsd: _e, ...rest } = existing;
      setF(rest as Form);
    }
  }, [existing]);

  if (!isNew && isLoading) return <PageLoader />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const needsVideo = JSON.stringify(f.steps).includes("{{template_video}}");
  const costUsd = f.steps.reduce((s, x) => s + (Number(x.costUsd) || 0), 0);
  const costUzs = Math.round(costUsd * (settings?.values.usdToUzs || 12500));

  function applyPreset(kind: Form["kind"]) {
    set("kind", kind);
    const preset = PIPELINE_PRESETS[kind as keyof typeof PIPELINE_PRESETS];
    if (preset && (isNew || confirm(`"${preset.title}" andozasi qadamlarini qo'llaymi? Hozirgi qadamlar almashtiriladi.`))) {
      set("steps", JSON.parse(JSON.stringify(preset.steps)));
      if (kind === "character_replace") set("allowAnimals", true);
    }
  }

  async function save() {
    const form = new FormData();
    form.append("data", JSON.stringify(f));
    if (files.preview) form.append("preview", files.preview);
    if (files.poster) form.append("poster", files.poster);
    if (files.sourceVideo) form.append("sourceVideo", files.sourceVideo);
    setSaving(true);
    try {
      const t = await api<AdminTemplate>(isNew ? "/api/admin/templates" : `/api/admin/templates/${id}`, { method: isNew ? "POST" : "PUT", form });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/templates/${t.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      setFiles({ preview: null, poster: null, sourceVideo: null });
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
    setTesting(true);
    try {
      const r = await api<{ id: string }>("/api/generations?test=1", { form });
      navigate(`/g/${r.id}`);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setTesting(false); }
  }

  const preset = PIPELINE_PRESETS[f.kind as keyof typeof PIPELINE_PRESETS];

  return (
    <div className="max-w-5xl">
      <Link href="/admin/templates" className="mb-3 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"><ChevronLeft className="h-4 w-4" />Shablonlar</Link>
      <PageHead title={isNew ? "Yangi shablon" : f.title || "Shablon"} subtitle={isNew ? "Avval ma'lumotlarni to'ldiring, saqlang, keyin sinab ko'ring" : `/${f.slug}`}
        action={<div className="flex gap-2">
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
              <div><label className="label">Narxi (kredit)</label><input className="input" type="number" min={0} value={f.creditCost} onChange={(e) => set("creditCost", Number(e.target.value))} /></div>
              <div><label className="label">Tartib raqami</label><input className="input" type="number" value={f.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></div>
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
            <StepEditor steps={f.steps} onChange={(s) => set("steps", s)} />
            <details className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-white/60">
              <summary className="flex cursor-pointer items-center gap-2 font-medium text-white/80"><Info className="h-4 w-4" />O'rinbosarlar va maslahatlar</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><code>{"{{user_image}}"}</code> — mijoz yuklagan rasm</li>
                <li><code>{"{{template_video}}"}</code> — o'ng tomonda yuklangan asl video</li>
                <li><code>{"{{prev}}"}</code> — oldingi qadam natijasi, <code>{"{{step_0}}"}</code> — 1-qadam natijasi</li>
                <li>Promptlarni ingliz tilida yozing va "keep the exact same face" qo'shing — yuz o'xshashligi yaxshilanadi</li>
                <li>Har bir modelni avval fal.ai Playground'da sinab, eng yaxshi parametrlarni shu yerga ko'chiring</li>
              </ul>
            </details>
          </Card>
        </div>

        <div className="space-y-5">
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
              onFile={(x) => setFiles((s) => ({ ...s, poster: x }))} hint="Video yuklanguncha ko'rinadi" />
            {(needsVideo || existing?.sourceVideoUrl) && (
              <FilePick label={`Asl video${needsVideo ? " *" : ""}`} accept="video/mp4,video/webm,video/quicktime" current={existing?.sourceVideoUrl ?? null} file={files.sourceVideo}
                forceVideo onFile={(x) => setFiles((s) => ({ ...s, sourceVideo: x }))} hint="Bitta raqqos, butun gavda, kamera qimirlamaydi. Mijozlarga ko'rinmaydi" />
            )}
          </Card>
          <Card className="p-5 text-sm">
            <div className="label">Iqtisodiyot</div>
            <div className="flex justify-between"><span className="text-white/60">AI tannarxi</span><b>${costUsd.toFixed(2)} ≈ {formatUzs(costUzs)}</b></div>
            <div className="mt-1 flex justify-between"><span className="text-white/60">Mijoz to'laydi</span><b>{f.creditCost} kredit</b></div>
            <p className="mt-2 text-xs text-white/40">1 kredit narxi tarifga qarab ~10 000–15 000 so'm. Tannarx kredit narxining 50% idan oshmasligi tavsiya etiladi.</p>
          </Card>
          {!isNew && existing && (
            <Card className="p-5 text-sm">
              <div className="label">Havola</div>
              <button className="flex items-center gap-2 text-brand-light" onClick={() => { navigator.clipboard.writeText(`${location.origin}/t/${existing.slug}`); toast("Nusxa olindi"); }}><Copy className="h-4 w-4" />/t/{existing.slug}</button>
            </Card>
          )}
        </div>
      </div>

      <Modal open={testOpen} onClose={() => setTestOpen(false)} title="Shablonni sinab ko'rish">
        <p className="mb-4 text-sm text-white/60">Rasm yuklang — generatsiya sizning hisobingizdan <b>kreditsiz</b> bajariladi (yashirin shablon ham ishlaydi). Haqiqiy AI rejimida fal.ai hisobidan pul yechiladi.</p>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setTestFile(e.target.files?.[0] || null)} className="mb-4 block w-full text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white" />
        <Button className="w-full" loading={testing} disabled={!testFile} onClick={runTest}><FlaskConical className="h-4 w-4" />Sinovni boshlash</Button>
      </Modal>
    </div>
  );
}
