import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Check, Zap, CircleCheck, Clock, CircleX, FlaskConical } from "lucide-react";
import { api, formatUzs, queryClient, type Order, type Plan } from "@/lib/api";
import { useConfig, useMe } from "@/lib/hooks";
import { Button, Empty, Modal, PageLoader, clsx, useToast } from "@/components/ui";

const PROVIDERS = {
  payme: { title: "Payme", desc: "Uzcard, Humo, Visa", color: "from-[#00CCCC] to-[#33a8b5]" },
  click: { title: "Click", desc: "Uzcard, Humo", color: "from-[#0099ff] to-[#0066cc]" },
  test: { title: "Sinov to'lovi", desc: "Faqat ishlab chiqish uchun", color: "from-amber-500 to-orange-600" },
} as const;

export function PricingPage() {
  const { data: plans, isLoading } = useQuery<Plan[]>({ queryKey: ["/api/plans"] });
  const { data: cfg } = useConfig();
  const { user, balance } = useMe();
  const [, navigate] = useLocation();
  const toast = useToast();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading) return <PageLoader />;
  const perVideo = (p: Plan) => Math.round(p.priceUzs / p.credits);
  const base = plans?.length ? Math.max(...plans.map(perVideo)) : 0;

  async function pay(provider: "payme" | "click" | "test") {
    if (!plan) return;
    setBusy(provider);
    try {
      const r = await api<{ orderId: number; redirectUrl: string }>("/api/orders", { body: { planId: plan.id, provider } });
      if (provider === "test") navigate(`/payment/${r.orderId}`);
      else window.location.href = r.redirectUrl;
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Kredit sotib olish</h1>
        <p className="mt-2 text-white/60">1 kredit = 1 ta oddiy video. Muvaffaqiyatsiz natija uchun kredit qaytariladi.</p>
        {user && <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-sm ring-1 ring-line">Hozirgi balans: <Zap className="h-4 w-4 fill-amber-300 text-amber-300" /><b>{balance}</b></div>}
      </div>
      {!plans?.length ? <Empty title="Tariflar hali qo'shilmagan" /> : (
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const save = base ? Math.round((1 - perVideo(p) / base) * 100) : 0;
            const hot = !!p.badge;
            return (
              <div key={p.id} className={clsx("relative flex flex-col rounded-3xl border p-6", hot ? "border-brand bg-gradient-to-b from-brand/15 to-card shadow-xl shadow-brand/10" : "border-line bg-card")}>
                {p.badge && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-xs font-bold">{p.badge}</span>}
                <div className="text-lg font-bold">{p.title}</div>
                <div className="mt-1 min-h-[2.5rem] text-sm text-white/50">{p.description}</div>
                <div className="mt-4 text-3xl font-extrabold">{formatUzs(p.priceUzs)}</div>
                <div className="mt-1 text-sm text-white/50">{formatUzs(perVideo(p))} / video {save > 0 && <span className="text-emerald-300">· {save}% tejash</span>}</div>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-white/80">
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-light" />{p.credits} ta kredit</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-light" />{p.validityDays} kun amal qiladi</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-light" />Suv belgisiz, HD sifat</li>
                </ul>
                <Button className="mt-6 w-full" variant={hot ? "primary" : "secondary"} onClick={() => (user ? setPlan(p) : navigate("/login?next=/pricing"))}>Tanlash</Button>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!plan} onClose={() => { setPlan(null); setBusy(null); }} title="To'lov usulini tanlang">
        {plan && (
          <>
            <div className="mb-4 rounded-2xl bg-white/5 p-4 text-sm">
              <div className="flex justify-between"><span className="text-white/60">Tarif</span><b>{plan.title}</b></div>
              <div className="mt-1 flex justify-between"><span className="text-white/60">Kredit</span><b>{plan.credits} ta · {plan.validityDays} kun</b></div>
              <div className="mt-1 flex justify-between"><span className="text-white/60">Summa</span><b>{formatUzs(plan.priceUzs)}</b></div>
            </div>
            <div className="space-y-2">
              {(cfg?.paymentProviders || []).map((p) => (
                <button key={p} disabled={!!busy} onClick={() => pay(p)}
                  className={`flex w-full items-center justify-between rounded-2xl bg-gradient-to-r ${PROVIDERS[p].color} px-5 py-4 text-left font-semibold transition hover:brightness-110 disabled:opacity-60`}>
                  <span className="flex items-center gap-2">{p === "test" && <FlaskConical className="h-4 w-4" />}{PROVIDERS[p].title}</span>
                  <span className="text-xs font-normal opacity-80">{busy === p ? "Yo'naltirilmoqda..." : PROVIDERS[p].desc}</span>
                </button>
              ))}
              {!cfg?.paymentProviders.length && <p className="text-sm text-white/50">To'lov tizimlari hali ulanmagan.</p>}
            </div>
            <p className="mt-4 text-xs text-white/40">To'lov xavfsiz sahifada amalga oshiriladi. Karta ma'lumotlaringiz bizga ko'rinmaydi.</p>
          </>
        )}
      </Modal>
    </div>
  );
}

export function PaymentReturnPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const { data: o, isLoading, refetch } = useQuery<Order>({
    queryKey: [`/api/orders/${id}`],
    refetchInterval: (q) => (q.state.data?.status === "pending" && q.state.data.provider !== "test" ? 3000 : false),
  });
  useEffect(() => {
    if (o?.status === "paid") queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [o?.status]);
  if (isLoading) return <PageLoader />;
  if (!o) return <Empty title="Buyurtma topilmadi" />;

  async function testPay() {
    setPaying(true);
    try { await api(`/api/orders/${id}/test-pay`, { method: "POST" }); await refetch(); toast("Sinov to'lovi bajarildi"); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setPaying(false); }
  }

  return (
    <div className="mx-auto max-w-md pt-6 text-center">
      {o.status === "paid" ? (
        <>
          <CircleCheck className="mx-auto h-16 w-16 text-emerald-400" />
          <h1 className="mt-4 text-2xl font-extrabold">To'lov qabul qilindi!</h1>
          <p className="mt-2 text-white/60">Hisobingizga {o.credits} ta kredit qo'shildi ({o.validityDays} kun amal qiladi).</p>
          <Link href="/"><Button className="mt-6">Video yaratish</Button></Link>
        </>
      ) : o.status === "pending" ? (
        <>
          <Clock className="mx-auto h-16 w-16 text-amber-300" />
          <h1 className="mt-4 text-2xl font-extrabold">To'lov kutilmoqda</h1>
          <p className="mt-2 text-white/60">{o.planTitle} · {formatUzs(o.amountUzs)}</p>
          {o.provider === "test" ? (
            <Button className="mt-6" loading={paying} onClick={testPay}><FlaskConical className="h-4 w-4" />Sinov to'lovini bajarish</Button>
          ) : <p className="mt-4 text-sm text-white/40">To'lov tizimidan tasdiq kelishi bilan sahifa yangilanadi...</p>}
        </>
      ) : (
        <>
          <CircleX className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-extrabold">To'lov bekor qilingan</h1>
          <Link href="/pricing"><Button className="mt-6" variant="secondary">Qayta urinish</Button></Link>
        </>
      )}
    </div>
  );
}
