import { useEffect, useRef, useState } from "react";
import { Sparkles, PenLine, User, PawPrint, TriangleAlert, ChevronLeft, Film, Image as ImageIcon } from "lucide-react";
import { api } from "@/lib/api";
import { FACE_SWAP_VARIANT, MAIN_VARIANT_LABEL, buildMultiCharacterSteps, buildStepsFromAnalysis } from "@shared/presets";
import type { InputSlot, PipelineStep, TemplateVariant } from "@shared/schema";
import { Button, Modal, Spinner, Toggle, clsx, useToast } from "@/components/ui";

export type Analysis = {
  titleUz: string; descriptionUz: string; inputHintUz: string;
  recommendedKind: "character_replace" | "effect" | "photoshoot"; allowAnimals: boolean;
  scene: string; motion: string;
  characters: { id: number; labelUz: string; descriptionEn: string; type: "human" | "animal"; frame: number; box: [number, number, number, number] | null; isMain: boolean }[];
  mainCharacterId: number | null; warningsUz: string[]; model: string; mock?: boolean;
};

export type WizardResult = {
  file: File;
  poster: File | null;
  mediaType: "video" | "image";
  /** AI tahlil qilingan bo'lsa — formaga qo'llanadigan qiymatlar */
  fill?: { title: string; description: string; inputHint: string; allowAnimals: boolean; kind: Kind; steps: PipelineStep[]; inputSlots: InputSlot[]; mainLabel?: string; variants?: TemplateVariant[] };
};

type Kind = "motion_control" | "character_replace" | "multi_character" | "effect" | "photoshoot";
const MAX_SIDE = 768;
const MAX_MULTI = 4; // Kling O1 Video Edit: ko'pi bilan 4 ta rasm

function drawToJpeg(src: CanvasImageSource, w: number, h: number) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

function once(el: HTMLElement, ev: string, timeout = 8000) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Video o'qilmadi")), timeout);
    el.addEventListener(ev, () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/**
 * Brauzerning o'zida videodan 4 ta kadr (yoki rasmdan 1 ta) ajratib olish.
 * first — videoning eng birinchi kadri: Motion Control shu kadrdan boshlanadi, shuning uchun poster aynan u bo'ladi.
 */
async function extractFrames(file: File): Promise<{ frames: string[]; first: string | null }> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { frames: [drawToJpeg(img, img.naturalWidth, img.naturalHeight)], first: null };
    }
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    await once(v, "loadeddata");
    let duration = v.duration;
    if (!Number.isFinite(duration)) {
      // Ba'zi webm fayllarda davomiylik yozilmagan — oxiriga o'tib aniqlaymiz
      v.currentTime = 1e7;
      await once(v, "seeked").catch(() => {});
      duration = Number.isFinite(v.duration) ? v.duration : 4;
    }
    v.currentTime = Math.min(0.05, duration / 10);
    await once(v, "seeked");
    const first = drawToJpeg(v, v.videoWidth, v.videoHeight);
    const frames: string[] = [];
    for (const p of [0.08, 0.35, 0.62, 0.88]) {
      v.currentTime = Math.max(0, duration * p);
      await once(v, "seeked");
      frames.push(drawToJpeg(v, v.videoWidth, v.videoHeight));
    }
    return { frames, first };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function dataUrlToFile(dataUrl: string, name: string) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: "image/jpeg" });
}

const KIND_OPTIONS = {
  video: [
    ["motion_control", "Butun personaj (viral)", "1-kadrda odam to'liq almashtiriladi, Kling Motion Control harakatni aynan o'tkazadi"],
    ["character_replace", "Bitta qahramon (Wan)", "Bitta odam almashtiriladi, harakat aynan saqlanadi (raqs, yurish)"],
    ["multi_character", "Ko'p personajli", "2–4 kishi, har biri mijozning alohida rasmi bilan almashtiriladi"],
    ["effect", "Effekt", "Sahna mijoz rasmidan qayta yaratiladi va jonlantiriladi"],
  ],
  image: [
    ["effect", "Rasm → video", "Personaj almashtiriladi, keyin rasm jonlantiriladi"],
    ["photoshoot", "Faqat rasm", "Personaj almashtirilgan tayyor rasm beriladi"],
  ],
} as const;

export function MediaWizard({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (r: WizardResult) => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [withFace, setWithFace] = useState(true);
  const [stage, setStage] = useState<"pick" | "frames" | "analyzing" | "result">("pick");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [charId, setCharId] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("effect");
  const [multiIds, setMultiIds] = useState<number[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setFile(null); setPreview(null); setFrames([]); setFirstFrame(null); setWithFace(true); setStage("pick"); setAnalysis(null); setCharId(null); setFrameIdx(0); setMultiIds([]);
  }, [open]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const mediaType: "video" | "image" = file?.type.startsWith("image/") ? "image" : "video";

  async function pick(f?: File | null) {
    if (!f) return;
    if (!/^(video\/(mp4|webm|quicktime)|image\/(jpeg|png|webp))$/.test(f.type)) return toast("Video (MP4, WEBM, MOV) yoki rasm (JPG, PNG, WEBP) yuklang", "error");
    if (f.size > 60 * 1024 * 1024) return toast("Fayl 60 MB dan katta bo'lmasin", "error");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStage("frames");
    try {
      const r = await extractFrames(f);
      setFrames(r.frames);
      setFirstFrame(r.first);
    } catch {
      setFrames([]);
      setFirstFrame(null);
      toast("Kadrlarni ajratib bo'lmadi — qo'lda kiritishingiz mumkin", "error");
    }
  }

  async function analyze() {
    if (!frames.length) return;
    setStage("analyzing");
    try {
      const a = await api<Analysis>("/api/admin/analyze", { body: { mediaType, frames } });
      setAnalysis(a);
      setCharId(a.mainCharacterId);
      const rk = a.recommendedKind;
      const humans = a.characters.filter((c) => c.type === "human");
      if (mediaType === "video" && a.characters.length >= 2) {
        // Bir nechta personaj — ko'p personajli rejim tavsiya qilinadi, asosiylari oldindan belgilanadi
        setKind("multi_character");
        setMultiIds((humans.length >= 2 ? humans : a.characters).slice(0, Math.min(2, MAX_MULTI)).map((c) => c.id));
      } else {
        setKind(mediaType === "image" ? (rk === "photoshoot" ? "photoshoot" : "effect") : rk === "character_replace" ? "motion_control" : "effect");
      }
      const main = a.characters.find((c) => c.id === a.mainCharacterId);
      setFrameIdx(main?.frame ?? 0);
      setStage("result");
    } catch (e) {
      toast((e as Error).message, "error");
      setStage("frames");
    }
  }

  async function finish(useAi: boolean) {
    if (!file) return;
    const posterSrc = firstFrame || frames[0];
    const poster = posterSrc ? await dataUrlToFile(posterSrc, "poster.jpg") : null;
    if (!useAi || !analysis) {
      onDone({
        file, poster, mediaType,
        fill: mediaType === "image"
          ? { title: "", description: "", inputHint: "", allowAnimals: false, kind: "effect", inputSlots: [], steps: buildStepsFromAnalysis({ scene: "", motion: "", characters: [] }, { mediaType, kind: "effect", characterId: null }) }
          : undefined,
      });
      return;
    }
    if (kind === "multi_character") {
      if (multiIds.length < 2) return toast("Kamida 2 ta personajni tanlang (yoki 'Bitta qahramon' turini tanlang)", "error");
      const chosen = multiIds.map((id) => analysis.characters.find((c) => c.id === id)!);
      onDone({
        file, poster, mediaType,
        fill: {
          title: analysis.titleUz, description: analysis.descriptionUz,
          inputHint: "Har bir personaj uchun yuzi aniq ko'ringan alohida rasm yuklang",
          allowAnimals: chosen.some((c) => c.type === "animal"),
          kind, steps: buildMultiCharacterSteps(analysis, multiIds),
          inputSlots: chosen.map((c) => ({ label: c.labelUz.slice(0, 40), hint: c.type === "animal" ? "Hayvon rasmi" : "Yuzi aniq ko'ringan rasm" })),
        },
      });
      return;
    }
    const ch = analysis.characters.find((c) => c.id === charId);
    const faceOk = mediaType === "video" && (kind === "motion_control" || kind === "character_replace");
    onDone({
      file, poster, mediaType,
      fill: {
        title: analysis.titleUz, description: analysis.descriptionUz, inputHint: analysis.inputHintUz,
        allowAnimals: analysis.allowAnimals || ch?.type === "animal",
        kind, steps: buildStepsFromAnalysis(analysis, { mediaType, kind: kind as "motion_control" | "character_replace" | "effect" | "photoshoot", characterId: charId }),
        inputSlots: [],
        mainLabel: MAIN_VARIANT_LABEL,
        variants: faceOk && withFace ? [structuredClone(FACE_SWAP_VARIANT)] : [],
      },
    });
  }

  const shownFrame = frames[frameIdx] || frames[0];
  const multi = kind === "multi_character";
  const isSelected = (id: number) => (multi ? multiIds.includes(id) : id === charId);
  const slotNo = (id: number) => multiIds.indexOf(id) + 1;
  function choose(id: number) {
    if (!multi) return setCharId(id);
    setMultiIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_MULTI ? (toast(`Ko'pi bilan ${MAX_MULTI} ta personaj`, "error"), cur) : [...cur, id]);
  }
  const notMp4 = multi && file && !/^video\/(mp4|quicktime)$/.test(file.type);

  return (
    <Modal open={open} onClose={onClose} title={stage === "result" ? "AI tahlil natijasi" : "Shablon mediasini yuklang"} wide>
      {stage === "pick" && (
        <div>
          <button type="button" onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-card px-6 py-12 text-center hover:border-brand">
            <div className="flex gap-2 text-brand-light"><Film className="h-9 w-9" /><ImageIcon className="h-9 w-9" /></div>
            <div className="font-semibold">Video yoki rasm tanlang</div>
            <div className="max-w-sm text-sm text-white/50">Trend videoning o'zi (9:16, 5–10 soniya) yoki shablon rasmi. Keyin AI uni ko'rib, personajlarni topadi va promptlarni yozib beradi.</div>
          </button>
          <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}

      {(stage === "frames" || stage === "analyzing") && file && (
        <div>
          <div className="flex gap-4">
            <div className="w-32 shrink-0 overflow-hidden rounded-xl bg-black">
              {preview && (mediaType === "video" ? <video src={preview} muted autoPlay loop playsInline className="w-full" /> : <img src={preview} alt="" className="w-full" />)}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-semibold">{file.name}</div>
              <div className="text-white/50">{mediaType === "video" ? "Video" : "Rasm"} · {(file.size / 1024 / 1024).toFixed(1)} MB</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {frames.length ? frames.map((f, i) => <img key={i} src={f} alt="" className="h-16 rounded-md" />) : <span className="flex items-center gap-2 text-white/50"><Spinner className="h-4 w-4" />Kadrlar ajratilmoqda...</span>}
              </div>
            </div>
          </div>
          {stage === "analyzing" ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-brand/10 p-6 text-center">
              <Spinner className="h-8 w-8" />
              <div className="font-semibold">AI videoni ko'rib chiqmoqda...</div>
              <div className="text-sm text-white/50">Personajlar, sahna va harakat aniqlanmoqda (10–30 soniya)</div>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button size="lg" onClick={analyze} disabled={!frames.length}><Sparkles className="h-5 w-5" />AI tahlil qilsin</Button>
              <Button size="lg" variant="secondary" onClick={() => finish(false)}><PenLine className="h-5 w-5" />Qo'lda kiritaman</Button>
              <button className="text-left text-xs text-white/40 sm:col-span-2" onClick={() => setStage("pick")}>← Boshqa fayl tanlash</button>
            </div>
          )}
        </div>
      )}

      {stage === "result" && analysis && (
        <div className="space-y-5">
          {analysis.warningsUz.length > 0 && (
            <div className="space-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              {analysis.warningsUz.map((w, i) => <div key={i} className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{w}</div>)}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <div>
              <div className="relative overflow-hidden rounded-xl bg-black">
                {shownFrame && <img src={shownFrame} alt="" className="w-full" />}
                {analysis.characters.filter((c) => c.box && c.frame === frameIdx).map((c) => {
                  const [y0, x0, y1, x1] = c.box!;
                  return (
                    <button key={c.id} onClick={() => choose(c.id)}
                      className={clsx("absolute rounded-md border-2 transition", isSelected(c.id) ? "border-brand bg-brand/20 shadow-[0_0_0_2px_rgba(124,92,255,.4)]" : "border-white/70 bg-white/5")}
                      style={{ top: `${y0 / 10}%`, left: `${x0 / 10}%`, height: `${(y1 - y0) / 10}%`, width: `${(x1 - x0) / 10}%` }}>
                      <span className={clsx("absolute -top-0.5 left-0 -translate-y-full rounded px-1 text-[10px] font-bold", isSelected(c.id) ? "bg-brand" : "bg-black/70")}>{multi && isSelected(c.id) ? `Rasm ${slotNo(c.id)}` : c.id}</span>
                    </button>
                  );
                })}
              </div>
              {frames.length > 1 && (
                <div className="mt-2 flex gap-1">
                  {frames.map((f, i) => <button key={i} onClick={() => setFrameIdx(i)} className={clsx("overflow-hidden rounded ring-2", i === frameIdx ? "ring-brand" : "ring-transparent")}><img src={f} alt="" className="h-12" /></button>)}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="label">{multi ? "Qaysi personajlar almashtiriladi? (tartib = rasm tartibi)" : "Qaysi personaj almashtiriladi?"}</div>
                {analysis.characters.length === 0 && <p className="text-sm text-white/50">AI personaj topmadi — promptlarni qo'lda tahrirlang.</p>}
                <div className="space-y-2">
                  {analysis.characters.map((c) => (
                    <button key={c.id} onClick={() => { choose(c.id); setFrameIdx(c.frame); }}
                      className={clsx("flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition", isSelected(c.id) ? "border-brand bg-brand/10" : "border-line hover:border-white/30")}>
                      <span className={clsx("mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold", multi && isSelected(c.id) ? "bg-brand" : "bg-white/10")}>{multi ? (isSelected(c.id) ? `Rasm ${slotNo(c.id)}` : "+") : c.id}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-medium">{c.type === "animal" ? <PawPrint className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}{c.labelUz}{c.isMain && <span className="rounded bg-white/10 px-1.5 text-[10px]">asosiy</span>}</span>
                        <span className="block text-xs text-white/40">{c.descriptionEn}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="label">Retsept turi</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {KIND_OPTIONS[mediaType].map(([k, t, d]) => (
                    <button key={k} onClick={() => setKind(k)} className={clsx("rounded-xl border p-3 text-left text-sm", kind === k ? "border-brand bg-brand/10" : "border-line hover:border-white/30")}>
                      <div className="font-medium">{t}{(analysis.recommendedKind === "character_replace" && mediaType === "video" ? "motion_control" : analysis.recommendedKind) === k && <span className="ml-1.5 text-xs text-brand-light">· AI tavsiyasi</span>}</div>
                      <div className="text-xs text-white/50">{d}</div>
                    </button>
                  ))}
                </div>
                {multi && (
                  <p className="mt-2 text-xs text-white/50">Mijozdan {multiIds.length} ta rasm so'raladi: {multiIds.map((id, i) => `${i + 1}) ${analysis.characters.find((c) => c.id === id)?.labelUz}`).join(", ")}</p>
                )}
                {notMp4 && (
                  <p className="mt-2 text-xs text-red-300">Ko'p personajli model (Kling O1) faqat MP4 yoki MOV videoni qabul qiladi. Bu faylni MP4 ga o'tkazib yuklang, aks holda generatsiya xato beradi.</p>
                )}
                {mediaType === "video" && (kind === "motion_control" || kind === "character_replace") && (
                  <div className="mt-3 rounded-xl border border-line p-3">
                    <Toggle checked={withFace} onChange={setWithFace} label="Arzon variant ham bo'lsin: «Faqat yuz»" />
                    <p className="mt-1 text-xs text-white/50">Mijoz o'zi tanlaydi: «Butun personaj» (yuz + gavda + kiyim, qimmatroq) yoki «Faqat yuz» (arzon, tez). Narxlarni keyin formada belgilaysiz.</p>
                  </div>
                )}
                {kind === "character_replace" && analysis.characters.length > 1 && (
                  <p className="mt-2 text-xs text-amber-200">Eslatma: "Qahramonni almashtirish" modeli videodagi eng ko'zga tashlanadigan personajni o'zi tanlaydi. Bir nechta odam bo'lsa, natijani albatta sinab ko'ring.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-4 text-sm">
            <div className="label">AI taklifi (keyin o'zgartirishingiz mumkin)</div>
            <div><b>{analysis.titleUz}</b> — {analysis.descriptionUz}</div>
            <div className="mt-2 text-white/50"><b className="text-white/70">Sahna:</b> {analysis.scene}</div>
            <div className="mt-1 text-white/50"><b className="text-white/70">Harakat:</b> {analysis.motion}</div>
            <div className="mt-2 text-[11px] text-white/30">Model: {analysis.model}</div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => finish(true)}><Sparkles className="h-4 w-4" />Formaga qo'llash</Button>
            <Button variant="secondary" onClick={() => finish(false)}><PenLine className="h-4 w-4" />Qo'lda kiritaman</Button>
            <Button variant="ghost" onClick={() => setStage("frames")}><ChevronLeft className="h-4 w-4" />Orqaga</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
