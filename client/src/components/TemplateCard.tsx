import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { PawPrint, Zap } from "lucide-react";
import type { TemplateCard as T } from "@/lib/api";
import { clsx } from "./ui";

/** Ko'rinish maydoniga kirganda o'z-o'zidan ijro etiladigan video */
export function AutoVideo({ src, poster, className }: { src: string; poster?: string | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, [src]);
  return <video ref={ref} src={src} poster={poster || undefined} muted loop playsInline preload="metadata" className={className} />;
}

export function TemplatePreview({ t, className }: { t: Pick<T, "previewUrl" | "previewIsVideo" | "posterUrl" | "title">; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (t.previewUrl && t.previewIsVideo && !failed) {
    return <AutoVideo src={t.previewUrl} poster={t.posterUrl} className={clsx("h-full w-full object-cover", className)} />;
  }
  const img = t.posterUrl || (t.previewIsVideo ? null : t.previewUrl);
  return img
    ? <img src={img} alt={t.title} loading="lazy" onError={() => setFailed(true)} className={clsx("h-full w-full object-cover", className)} />
    : <div className="h-full w-full bg-gradient-to-br from-brand/40 to-fuchsia-500/30" />;
}

export function TemplateCard({ t, size = "md" }: { t: T; size?: "md" | "lg" }) {
  return (
    <Link href={`/t/${t.slug}`}
      className={clsx("group relative block shrink-0 snap-start overflow-hidden rounded-2xl bg-card ring-1 ring-white/5 transition hover:ring-brand/60",
        size === "md" ? "aspect-[9/16] w-[42vw] max-w-[200px] sm:w-[180px]" : "aspect-[9/16] w-full")}>
      <TemplatePreview t={t} className="transition duration-500 group-hover:scale-105" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <div className="absolute left-2 top-2 flex gap-1">
        {t.isNew && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase">Yangi</span>}
        {t.allowAnimals && <span className="rounded-full bg-black/50 p-1 backdrop-blur" title="Hayvon rasmi ham mumkin"><PawPrint className="h-3 w-3" /></span>}
      </div>
      <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
        <Zap className="h-3 w-3 fill-amber-300 text-amber-300" />{t.variants?.length ? `${Math.min(...t.variants.map((v) => v.creditCost))}+` : t.creditCost}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="line-clamp-2 text-center text-sm font-bold leading-tight drop-shadow">{t.title}</div>
      </div>
    </Link>
  );
}
