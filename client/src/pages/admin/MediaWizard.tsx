import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, PenLine, User, PawPrint, TriangleAlert, ChevronLeft, Film, Image as ImageIcon, Target, RefreshCw, Shirt } from "lucide-react";
import { api } from "@/lib/api";
import { FACE_SWAP_VARIANT, MAIN_VARIANT_LABEL, buildMultiCharacterSteps, buildStepsFromAnalysis, type Outfit } from "@shared/presets";
import { checkRecipe, nearestAspectRatio } from "@shared/recipe";
import type { InputSlot, PipelineStep, SourceMeta, TemplateVariant } from "@shared/schema";
import { Button, Modal, Spinner, Toggle, clsx, useToast } from "@/components/ui";
import { dataUrlToFile, extOfFile, formatMeta, probeMedia } from "./media";

export type Analysis = {
  titleUz: string; descriptionUz: string; inputHintUz: string;
  recommendedKind: "motion_control" | "multi_character" | "character_replace" | "effect" | "photoshoot"; allowAnimals: boolean;
  scene: string; motion: string; framing?: "full_body" | "upper_body" | "close_up"; hasCuts?: boolean;
  characters: { id: number; labelUz: string; descriptionEn: string; type: "human" | "animal"; frame: number; box: [number, number, number, number] | null; isMain: boolean }[];
  mainCharacterId: number | null; targetCharacterIds: number[]; extraPromptEn: string; instructionNoteUz: string;
  warningsUz: string[]; model: string; mock?: boolean;
};

export type WizardResult = {
  file: File;
  poster: File | null;
  /** Videoning to'liq o'lchamdagi 1-kadri ({{template_frame}}) */
  frame: File | null;
  meta: SourceMeta | null;
  mediaType: "video" | "image";
  /** AI tahlil qilingan bo'lsa — formaga qo'llanadigan qiymatlar */
  fill?: { title: string; description: string; inputHint: string; allowAnimals: boolean; kind: Kind; steps: PipelineStep[]; inputSlots: InputSlot[]; mainLabel?: string; variants?: TemplateVariant[] };
};

type Kind = "motion_control" | "character_replace" | "multi_character" | "effect" | "photoshoot";
const MAX_MULTI = 4; // Kling O3 Video Edit: ko'pi bilan 4 ta rasm

const KIND_OPTIONS = {
  video: [
    ["motion_control", "Butun personaj (viral)", "1-kadrda odam to'liq almashtiriladi, Kling Motion Control harakatni aynan o'tkazadi"],
    ["character_replace", "Arzon almashtirish (Wan)", "Arzonroq, hayvon rasmi ham bo'ladi; model asosiy odamni o'zi tanlaydi"],
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
  const [firstFull, setFirstFull] = useState<string | null>(null);
  const [meta, setMeta] = useState<SourceMeta | null>(null);
  const [outfit, setOutfit] = useState<Outfit>("template");
  const [withFace, setWithFace] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [stage, setStage] = useState<"pick" | "frames" | "analyzing" | "result">("pick");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [charId, setCharId] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("effect");
  const [multiIds, setMultiIds] = useState<number[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setFile(null); setPreview(null); setFrames([]); setFirstFull(null); setMeta(null); setOutfit("template"); setWithFace(true); setInstruction(""); setStage("pick"); setAnalysis(null); setCharId(null); setFrameIdx(0); setMultiIds([]);
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
      const r = await probeMedia(f);
      setFrames(r.frames);
      setFirstFull(r.firstFull);
      setMeta(r.meta);
    } catch {
      setFrames([]);
      setFirstFull(null);
      setMeta(null);
      toast("Kadrlarni ajratib bo'lmadi — boshqa formatda (MP4) yuklab ko'ring", "error");
    }
  }

  async function analyze() {
    if (!frames.length) return;
    setStage("analyzing");
    try {
      const a = await api<Analysis>("/api/admin/analyze", { body: { mediaType, frames, instruction: instruction.trim() } });
      setAnalysis(a);
      setCharId(a.mainCharacterId);
      const rk = a.recommendedKind;
      const humans = a.characters.filter((c) => c.type === "human");
      const targets = a.targetCharacterIds ?? [];
      if (instruction.trim() && mediaType === "video" && targets.length >= 2) {
        // Admin bir nechta aniq personajni ko'rsatgan — aynan ular, aytilgan tartibda
        setKind("multi_character");
        setMultiIds(targets.slice(0, MAX_MULTI));
      } else if (instruction.trim() && targets.length === 1) {
        // Admin bitta "target" personajni ko'rsatgan — boshqalar qancha bo'lsa ham faqat u almashtiriladi
        setCharId(targets[0]);
        setKind(mediaType === "image" ? (rk === "photoshoot" ? "photoshoot" : "effect") : "motion_control");
      } else if (mediaType === "video" && a.characters.length >= 2) {
        // Bir nechta personaj — ko'p personajli rejim tavsiya qilinadi, asosiylari oldindan belgilanadi
        setKind("multi_character");
        setMultiIds((humans.length >= 2 ? humans : a.characters).slice(0, Math.min(2, MAX_MULTI)).map((c) => c.id));
      } else if (mediaType === "image") {
        setKind(rk === "photoshoot" ? "photoshoot" : "effect");
      } else {
        // Montajli (bir nechta sahna) videoni Motion Control yaxshi takrorlay olmaydi — effekt tavsiya qilinadi
        setKind(rk === "effect" || a.hasCuts ? "effect" : "motion_control");
      }
      const main = a.characters.find((c) => c.id === (targets[0] ?? a.mainCharacterId));
      setFrameIdx(main?.frame ?? 0);
      setStage("result");
    } catch (e) {
      toast((e as Error).message, "error");
      setStage("frames");
    }
  }

  const aspectRatio = meta ? nearestAspectRatio(meta.width, meta.height) : undefined;

  /** Tanlangan tur bo'yicha qadamlar (oldindan ko'rish va formaga qo'llash uchun) */
  function buildSteps(): PipelineStep[] {
    if (!analysis) return [];
    if (kind === "multi_character") return buildMultiCharacterSteps(analysis, multiIds);
    const ch = analysis.characters.find((c) => c.id === charId);
    return buildStepsFromAnalysis(analysis, {
      mediaType, kind: kind as "motion_control" | "character_replace" | "effect" | "photoshoot", characterId: charId,
      aspectRatio, outfit, allowAnimals: ch?.type === "animal",
    });
  }
  const faceOk = mediaType === "video" && (kind === "motion_control" || kind === "character_replace");
  const preCheck = useMemo(() => {
    if (!analysis || !file) return null;
    const steps = buildSteps();
    const variants = faceOk && withFace ? [FACE_SWAP_VARIANT] : [];
    const src = { ext: extOfFile(file), meta, hasFrame: !!firstFull || mediaType === "image" };
    const main = checkRecipe(steps, src);
    const v = variants.map((x) => checkRecipe(x.steps, src));
    const uniq = (l: string[]) => [...new Set(l)];
    return { errors: uniq([...main.errors, ...v.flatMap((r) => r.errors)]), warnings: uniq([...main.warnings, ...v.flatMap((r) => r.warnings)]) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, kind, charId, multiIds, outfit, withFace, meta, firstFull, file]);

  async function finish(useAi: boolean) {
    if (!file) return;
    const poster = frames[0] ? await dataUrlToFile(frames[0], "poster.jpg") : null;
    const frame = firstFull ? await dataUrlToFile(firstFull, "frame.jpg") : null;
    const base = { file, poster, frame, meta, mediaType };
    if (!useAi || !analysis) {
      onDone({
        ...base,
        fill: mediaType === "image"
          ? { title: "", description: "", inputHint: "", allowAnimals: false, kind: "effect", inputSlots: [], steps: buildStepsFromAnalysis({ scene: "", motion: "", characters: [] }, { mediaType, kind: "effect", characterId: null, aspectRatio }) }
          : undefined,
      });
      return;
    }
    if (kind === "multi_character") {
      if (multiIds.length < 2) return toast("Kamida 2 ta personajni tanlang (yoki 'Butun personaj' turini tanlang)", "error");
      const chosen = multiIds.map((id) => analysis.characters.find((c) => c.id === id)!);
      onDone({
        ...base,
        fill: {
          title: analysis.titleUz, description: analysis.descriptionUz,
          inputHint: "Har bir personaj uchun yuzi aniq ko'ringan alohida rasm yuklang",
          allowAnimals: chosen.some((c) => c.type === "animal"),
          kind, steps: buildSteps(),
          inputSlots: chosen.map((c) => ({ label: c.labelUz.slice(0, 40), hint: c.type === "animal" ? "Hayvon rasmi" : "Yuzi aniq ko'ringan rasm" })),
        },
      });
      return;
    }
    const ch = analysis.characters.find((c) => c.id === charId);
    onDone({
      ...base,
      fill: {
        title: analysis.titleUz, description: analysis.descriptionUz, inputHint: analysis.inputHintUz,
        allowAnimals: ch?.type === "animal" || (kind === "character_replace" && analysis.allowAnimals),
        kind, steps: buildSteps(),
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
              <div className="text-white/50">{mediaType === "video" ? "Video" : "Rasm"} · {extOfFile(file).toUpperCase()} · {(file.size / 1024 / 1024).toFixed(1)} MB{meta ? ` · ${formatMeta(meta)}` : ""}</div>
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
              <div className="sm:col-span-2">
                <InstructionBox value={instruction} onChange={setInstruction} />
              </div>
              <Button size="lg" onClick={analyze} disabled={!frames.length}><Sparkles className="h-5 w-5" />AI tahlil qilsin</Button>
              <Button size="lg" variant="secondary" onClick={() => finish(false)}><PenLine className="h-5 w-5" />Qo'lda kiritaman</Button>
              <button className="text-left text-xs text-white/40 sm:col-span-2" onClick={() => setStage("pick")}>← Boshqa fayl tanlash</button>
            </div>
          )}
        </div>
      )}

      {stage === "result" && analysis && (
        <div className="space-y-5">
          {analysis.instructionNoteUz && (
            <div className="flex gap-2 rounded-2xl border border-brand/40 bg-brand/10 p-3 text-sm">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
              <div>
                <div>{analysis.instructionNoteUz}</div>
                {analysis.extraPromptEn && <div className="mt-1 text-xs text-white/50">Promptlarga qo'shiladi: {analysis.extraPromptEn}</div>}
              </div>
            </div>
          )}
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
                {kind === "motion_control" && (
                  <div className="mt-3 rounded-xl border border-line p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Shirt className="h-4 w-4" />Kiyim</div>
                    <div className="grid grid-cols-2 gap-2">
                      {([["template", "Videodagi kiyim", "Trend obrazi saqlanadi (tavsiya)"], ["user", "Mijoz kiyimi", "Rasmdagi kiyimi bilan chiqadi"]] as const).map(([k, t, d]) => (
                        <button key={k} onClick={() => setOutfit(k)} className={clsx("rounded-lg border p-2 text-left text-xs", outfit === k ? "border-brand bg-brand/10" : "border-line hover:border-white/30")}>
                          <div className="font-medium text-white">{t}</div><div className="text-white/50">{d}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {faceOk && (
                  <div className="mt-3 rounded-xl border border-line p-3">
                    <Toggle checked={withFace} onChange={setWithFace} label="Arzon variant ham bo'lsin: «Faqat yuz»" />
                    <p className="mt-1 text-xs text-white/50">Mijoz o'zi tanlaydi: «Butun personaj» (yuz, soch, gavda — qimmatroq) yoki «Faqat yuz» (arzon, tez). Narxlarni keyin formada belgilaysiz.</p>
                  </div>
                )}
                {kind === "character_replace" && analysis.characters.length > 1 && (
                  <p className="mt-2 text-xs text-amber-200">Eslatma: Wan modeli videodagi eng ko'zga tashlanadigan personajni o'zi tanlaydi. Bir nechta odam bo'lsa, «Butun personaj» (Motion Control) aniqroq — u aynan tanlangan odamni almashtiradi.</p>
                )}
                {kind === "motion_control" && analysis.hasCuts && (
                  <p className="mt-2 text-xs text-amber-200">Videoda montaj (sahna almashishi) bor — Motion Control bitta uzluksiz kadrda yaxshi ishlaydi. Videoni bitta sahnaga qisqartiring.</p>
                )}
              </div>
            </div>
          </div>

          {preCheck && (preCheck.errors.length > 0 || preCheck.warnings.length > 0) && (
            <div className="space-y-1 rounded-2xl border border-line p-3 text-sm">
              {preCheck.errors.map((e) => <div key={e} className="flex gap-2 text-red-300"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{e}</div>)}
              {preCheck.warnings.map((w) => <div key={w} className="flex gap-2 text-amber-200"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{w}</div>)}
              {preCheck.errors.length > 0 && <div className="pt-1 text-xs text-white/50">Bu xatolar bilan shablonni saqlab bo'lmaydi: videoni tuzating (masalan MP4 ga o'tkazing yoki qisqartiring) yoki boshqa retsept turini tanlang.</div>}
            </div>
          )}

          <div className="rounded-2xl bg-white/5 p-4 text-sm">
            <div className="label">AI taklifi (keyin o'zgartirishingiz mumkin)</div>
            <div><b>{analysis.titleUz}</b> — {analysis.descriptionUz}</div>
            <div className="mt-2 text-white/50"><b className="text-white/70">Sahna:</b> {analysis.scene}</div>
            <div className="mt-1 text-white/50"><b className="text-white/70">Harakat:</b> {analysis.motion}</div>
            <div className="mt-2 text-[11px] text-white/30">Model: {analysis.model}</div>
          </div>

          <details className="rounded-2xl border border-line p-3" open={!!instruction && !analysis.instructionNoteUz}>
            <summary className="cursor-pointer text-sm font-medium">AI noto'g'ri tanladimi? Ko'rsatma yozib qayta tahlil qiling</summary>
            <div className="mt-3 space-y-2">
              <InstructionBox value={instruction} onChange={setInstruction} />
              <Button variant="secondary" onClick={analyze} disabled={!instruction.trim()}><RefreshCw className="h-4 w-4" />Qayta tahlil qilish</Button>
            </div>
          </details>

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

const INSTRUCTION_EXAMPLES = [
  "Sahna o'rtasidagi qizil ko'ylakli qizni almashtir, boshqalarga tegma",
  "Keyingi kadrdagi kostyumli yigitni almashtir",
  "Kelin va kuyovni almashtir: 1-rasm kuyov, 2-rasm kelin",
];

/** Admin AI ga o'z so'zi bilan qaysi personaj kerakligini aytadi */
function InstructionBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5"><Target className="h-3.5 w-3.5" />AI uchun ko'rsatma (ixtiyoriy)</label>
      <textarea className="input min-h-[72px] text-sm" maxLength={1000} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Masalan: videoda ko'p odam bor, lekin faqat sahna o'rtasidagi qizni almashtir. Qo'shimcha talablar ham yozish mumkin" />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {INSTRUCTION_EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => onChange(ex)} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10">{ex}</button>
        ))}
      </div>
    </div>
  );
}
