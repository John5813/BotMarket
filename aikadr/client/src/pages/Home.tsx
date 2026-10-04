import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Sparkles, Zap } from "lucide-react";
import type { Catalog } from "@/lib/api";
import { useConfig } from "@/lib/hooks";
import { TemplateCard, TemplatePreview } from "@/components/TemplateCard";
import { Empty, clsx } from "@/components/ui";

function HeroCarousel({ items }: { items: Catalog["featured"] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [items.length]);
  const t = items[i];
  if (!t) return null;
  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-white/5 bg-card">
      <div className="grid sm:grid-cols-[1fr_300px]">
        <div className="relative order-2 flex flex-col justify-end gap-3 p-6 sm:order-1 sm:p-10">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand/20 px-3 py-1 text-xs font-semibold text-brand-light">
            <Sparkles className="h-3.5 w-3.5" /> Hozir trendda
          </span>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">{t.title}</h1>
          <p className="max-w-md text-white/60">{t.description}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link href={`/t/${t.slug}`} className="rounded-full bg-white px-7 py-3 font-semibold text-black transition hover:bg-white/90">Sinab ko'rish</Link>
            <span className="flex items-center gap-1 text-sm text-white/50"><Zap className="h-4 w-4 fill-amber-300 text-amber-300" />{t.creditCost} kredit</span>
          </div>
          {items.length > 1 && (
            <div className="mt-4 flex items-center gap-3">
              <button aria-label="Oldingi" onClick={() => setI((i - 1 + items.length) % items.length)} className="rounded-full border border-line p-2 hover:bg-white/5"><ChevronLeft className="h-4 w-4" /></button>
              <div className="flex gap-1.5">
                {items.map((_, k) => <button key={k} aria-label={`${k + 1}`} onClick={() => setI(k)} className={clsx("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-white" : "w-1.5 bg-white/30")} />)}
              </div>
              <button aria-label="Keyingi" onClick={() => setI((i + 1) % items.length)} className="rounded-full border border-line p-2 hover:bg-white/5"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
        <Link href={`/t/${t.slug}`} className="relative order-1 block aspect-[4/3] sm:order-2 sm:aspect-[9/16]">
          <TemplatePreview key={t.id} t={t} />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent sm:bg-gradient-to-r" />
        </Link>
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-8">
      <div className="shimmer h-72 rounded-3xl" />
      {[0, 1].map((r) => (
        <div key={r}>
          <div className="shimmer mb-3 h-6 w-40 rounded-lg" />
          <div className="scroll-row">{[0, 1, 2, 3, 4].map((k) => <div key={k} className="shimmer aspect-[9/16] w-[42vw] max-w-[200px] shrink-0 rounded-2xl sm:w-[180px]" />)}</div>
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const { data, isLoading } = useQuery<Catalog>({ queryKey: ["/api/catalog"] });
  const { data: cfg } = useConfig();
  if (isLoading) return <SkeletonRows />;
  if (!data || data.categories.length === 0) return <Empty title="Hozircha shablonlar yo'q" text="Tez orada yangi trend videolar qo'shiladi" />;

  return (
    <div>
      {data.featured.length > 0 ? <HeroCarousel items={data.featured} /> : (
        <h1 className="mb-6 text-2xl font-extrabold">{cfg?.tagline}</h1>
      )}
      <div className="space-y-9">
        {data.categories.map((c) => (
          <section key={c.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">{c.title} {c.emoji}</h2>
              <Link href={`/c/${c.slug}`} className="rounded-full border border-line px-4 py-1.5 text-sm text-white/80 hover:bg-white/5">Hammasi</Link>
            </div>
            <div className="scroll-row -mx-4 px-4">
              {c.templates.map((t) => <TemplateCard key={t.id} t={t} />)}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-12 grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Shablonni tanlang", "Trenddagi video yoki effektni tanlang"],
          ["2", "Rasm yuklang", "Yuzingiz yoki uy hayvoningiz aniq ko'ringan rasm"],
          ["3", "Videoni oling", "1–3 daqiqada tayyor, yuklab olib ulashing"],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-2xl border border-line bg-card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand/20 font-bold text-brand-light">{n}</div>
            <div className="font-semibold">{t}</div>
            <div className="mt-1 text-sm text-white/50">{d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useQuery<Catalog>({ queryKey: ["/api/catalog"] });
  if (isLoading) return <SkeletonRows />;
  const cat = data?.categories.find((c) => c.slug === slug);
  if (!cat) return <Empty title="Kategoriya topilmadi" action={<Link href="/" className="text-brand-light">Bosh sahifaga</Link>} />;
  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"><ChevronLeft className="h-4 w-4" /> Orqaga</Link>
      <h1 className="mb-5 text-2xl font-extrabold">{cat.title} {cat.emoji}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {cat.templates.map((t) => <TemplateCard key={t.id} t={t} size="lg" />)}
      </div>
    </div>
  );
}
