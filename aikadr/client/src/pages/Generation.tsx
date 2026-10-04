import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ChevronLeft, Download, RefreshCw, TriangleAlert, Film, Trash2, Share2 } from "lucide-react";
import { api, formatDate, queryClient, type GenerationItem } from "@/lib/api";
import { Button, Empty, PageLoader, StatusBadge, useToast } from "@/components/ui";

const STAGES = ["Rasm tekshirilmoqda", "AI sahnani tayyorlamoqda", "Video yaratilmoqda", "Yakunlanmoqda"];

function Progress({ g }: { g: GenerationItem }) {
  const pct = g.status === "queued" ? 8 : Math.min(92, 20 + Math.round((g.stepIndex / Math.max(g.totalSteps, 1)) * 70));
  return (
    <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-6 rounded-3xl border border-white/5 bg-card p-8 text-center">
      <div className="relative h-28 w-28">
        <div className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
        <div className="absolute inset-3 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{pct}%</div>
      </div>
      <div>
        <div className="text-lg font-semibold">{g.status === "queued" ? "Navbatda turibdi..." : STAGES[Math.min(g.stepIndex + 1, STAGES.length - 1)]}</div>
        <div className="mt-1 text-sm text-white/50">Odatda 1–3 daqiqa. Sahifani yopsangiz ham ish davom etadi — natija "Ishlarim" bo'limida chiqadi.</div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-brand to-fuchsia-400 transition-all duration-700" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function GenerationPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: g, isLoading } = useQuery<GenerationItem>({
    queryKey: [`/api/generations/${id}`],
    refetchInterval: (q) => (q.state.data && ["queued", "processing"].includes(q.state.data.status) ? 3000 : false),
  });
  useEffect(() => {
    if (g?.status === "failed" || g?.status === "succeeded") {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    }
  }, [g?.status]);

  if (isLoading) return <PageLoader />;
  if (!g) return <Empty title="Topilmadi" action={<Link href="/my" className="text-brand-light">Ishlarimga</Link>} />;

  async function share(url: string) {
    const abs = location.origin + url;
    try {
      const blob = await (await fetch(abs, { credentials: "include" })).blob();
      const file = new File([blob], `aikadr.${blob.type.includes("webm") ? "webm" : blob.type.includes("png") ? "png" : "mp4"}`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: g!.templateTitle });
      else toast("Ulashish uchun avval yuklab oling");
    } catch { /* foydalanuvchi bekor qildi */ }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/my" className="mb-4 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"><ChevronLeft className="h-4 w-4" /> Ishlarim</Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">{g.templateTitle}</h1>
          <div className="text-sm text-white/40">{formatDate(g.createdAt)}</div>
        </div>
        <StatusBadge status={g.status} />
      </div>

      {(g.status === "queued" || g.status === "processing") && <div className="mx-auto max-w-sm"><Progress g={g} /></div>}

      {g.status === "failed" && (
        <Empty icon={<TriangleAlert className="h-10 w-10 text-red-400" />} title="Afsuski, natija chiqmadi" text={g.error || undefined}
          action={g.templateSlug && <Link href={`/t/${g.templateSlug}`}><Button><RefreshCw className="h-4 w-4" />Qayta urinish</Button></Link>} />
      )}

      {g.status === "succeeded" && (
        <div className={g.outputs.length > 1 ? "grid grid-cols-2 gap-3" : "mx-auto max-w-sm"}>
          {g.outputs.map((o, i) => (
            <div key={i} className="space-y-2">
              <div className="overflow-hidden rounded-3xl border border-white/5 bg-black">
                {o.type === "video"
                  ? <video src={o.url} controls autoPlay loop playsInline className="w-full" />
                  : <img src={o.url} alt={`Natija ${i + 1}`} className="w-full" />}
              </div>
              <div className="flex gap-2">
                <a href={`${o.url}?download=1`} className="flex-1"><Button className="w-full"><Download className="h-4 w-4" />Yuklab olish</Button></a>
                <Button variant="secondary" onClick={() => share(o.url)} aria-label="Ulashish"><Share2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {g.status === "succeeded" && g.templateSlug && (
        <div className="mt-6 text-center"><Link href={`/t/${g.templateSlug}`} className="text-sm text-brand-light hover:underline">Boshqa rasm bilan yana yaratish →</Link></div>
      )}
    </div>
  );
}

export function MyWorksPage() {
  const toast = useToast();
  const { data, isLoading } = useQuery<GenerationItem[]>({
    queryKey: ["/api/generations"],
    refetchInterval: (q) => (q.state.data?.some((g) => ["queued", "processing"].includes(g.status)) ? 4000 : false),
  });
  if (isLoading) return <PageLoader />;

  async function remove(id: string) {
    if (!confirm("Bu ishni o'chirasizmi?")) return;
    try {
      await api(`/api/generations/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast("O'chirildi");
    } catch (e) { toast((e as Error).message, "error"); }
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold">Ishlarim</h1>
      {!data?.length ? (
        <Empty icon={<Film className="h-10 w-10" />} title="Hali hech narsa yaratmadingiz" text="Shablonni tanlang va birinchi videongizni yarating"
          action={<Link href="/"><Button>Shablonlarni ko'rish</Button></Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((g) => (
            <div key={g.id} className="group relative">
              <Link href={`/g/${g.id}`} className="relative block aspect-[9/16] overflow-hidden rounded-2xl border border-white/5 bg-card">
                {g.status === "succeeded" && g.outputs[0] ? (
                  g.outputs[0].type === "video"
                    ? <video src={g.outputs[0].url} muted loop playsInline preload="metadata" className="h-full w-full object-cover" onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
                    : <img src={g.outputs[0].url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-sm text-white/50">
                    {g.status === "failed" ? <TriangleAlert className="h-8 w-8 text-red-400" /> : <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />}
                    {g.status === "failed" ? "Xatolik" : "Tayyorlanmoqda..."}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                  <div className="truncate text-sm font-semibold">{g.templateTitle}</div>
                  <div className="text-xs text-white/50">{formatDate(g.createdAt)}</div>
                </div>
              </Link>
              {(g.status === "succeeded" || g.status === "failed") && (
                <button onClick={() => remove(g.id)} aria-label="O'chirish" className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white/70 opacity-100 backdrop-blur transition hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
