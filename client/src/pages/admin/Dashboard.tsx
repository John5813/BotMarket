import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, Wallet, Layers, TriangleAlert, Cpu, Activity } from "lucide-react";
import { formatUzs } from "@/lib/api";
import { Card, PageLoader } from "@/components/ui";
import { PageHead } from "./AdminLayout";

type Stats = {
  users: { total: number; last30: number };
  generations: { total: number; ok: number; failed: number; active: number };
  today: { generations: number; revenue: number };
  revenue: { total: number; last30: number };
  aiCost: { last30Usd: number; last30Uzs: number };
  daily: { day: string; revenue: number; generations: number; users: number }[];
  topTemplates: { id: number; title: string; usage: number }[];
  aiMode: "fal" | "mock";
};

function Stat({ icon: Icon, label, value, sub, tone = "brand" }: { icon: typeof Users; label: string; value: string | number; sub?: string; tone?: "brand" | "green" | "amber" | "red" }) {
  const tones = { brand: "bg-brand/15 text-brand-light", green: "bg-emerald-500/15 text-emerald-300", amber: "bg-amber-500/15 text-amber-300", red: "bg-red-500/15 text-red-300" };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between"><span className="text-sm text-white/50">{label}</span><span className={`rounded-xl p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div>
      <div className="mt-3 text-2xl font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-xs text-white/40">{sub}</div>}
    </Card>
  );
}

const tooltipStyle = { background: "#16161f", border: "1px solid #26263a", borderRadius: 12, fontSize: 12 };

export function AdminDashboard() {
  const { data: s, isLoading } = useQuery<Stats>({ queryKey: ["/api/admin/stats"], refetchInterval: 30_000 });
  if (isLoading || !s) return <PageLoader />;
  const successRate = s.generations.total ? Math.round((s.generations.ok / s.generations.total) * 100) : 0;
  const margin = s.revenue.last30 - s.aiCost.last30Uzs;

  return (
    <div>
      <PageHead title="Dashboard" subtitle="Oxirgi 30 kunlik ko'rsatkichlar" />
      {s.aiMode === "mock" && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>AI <b>sinov rejimida</b> ishlayapti — haqiqiy video yaratilmaydi. Serverdagi <code className="rounded bg-black/30 px-1">.env</code> fayliga <code className="rounded bg-black/30 px-1">FAL_KEY</code> qo'shib, serverni qayta ishga tushiring.</div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label="Daromad (30 kun)" value={formatUzs(s.revenue.last30)} sub={`Bugun: ${formatUzs(s.today.revenue)} · Jami: ${formatUzs(s.revenue.total)}`} tone="green" />
        <Stat icon={Cpu} label="AI xarajati (30 kun)" value={`$${s.aiCost.last30Usd.toFixed(2)}`} sub={`≈ ${formatUzs(s.aiCost.last30Uzs)} · Foyda ≈ ${formatUzs(margin)}`} tone="amber" />
        <Stat icon={Layers} label="Generatsiyalar" value={s.generations.total} sub={`Bugun: ${s.today.generations} · Muvaffaqiyat: ${successRate}%`} />
        <Stat icon={Users} label="Foydalanuvchilar" value={s.users.total} sub={`30 kunda yangi: ${s.users.last30}`} />
      </div>
      {(s.generations.active > 0 || s.generations.failed > 0) && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {s.generations.active > 0 && <Link href="/admin/generations?status=processing" className="flex items-center gap-2 rounded-full bg-brand/15 px-4 py-2 text-brand-light"><Activity className="h-4 w-4" />Hozir {s.generations.active} ta ish bajarilmoqda</Link>}
          {s.generations.failed > 0 && <Link href="/admin/generations?status=failed" className="flex items-center gap-2 rounded-full bg-red-500/15 px-4 py-2 text-red-300"><TriangleAlert className="h-4 w-4" />{s.generations.failed} ta xatolik</Link>}
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 font-semibold">Daromad (so'm)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={s.daily}>
                <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} /><stop offset="100%" stopColor="#7c5cff" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#26263a" vertical={false} />
                <XAxis dataKey="day" stroke="#ffffff55" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff55" fontSize={11} tickLine={false} axisLine={false} width={70} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatUzs(Number(v)), "Daromad"]} />
                <Area type="monotone" dataKey="revenue" stroke="#a28bff" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-4 font-semibold">Eng ommabop shablonlar</div>
          <div className="space-y-3">
            {s.topTemplates.map((t, i) => {
              const max = Math.max(1, ...s.topTemplates.map((x) => x.usage));
              return (
                <div key={t.id}>
                  <div className="mb-1 flex justify-between text-sm"><span className="truncate">{i + 1}. {t.title}</span><span className="text-white/50">{t.usage}</span></div>
                  <div className="h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full bg-brand" style={{ width: `${(t.usage / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-5 xl:col-span-3">
          <div className="mb-4 font-semibold">Kunlik generatsiyalar va yangi foydalanuvchilar</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={s.daily}>
                <CartesianGrid stroke="#26263a" vertical={false} />
                <XAxis dataKey="day" stroke="#ffffff55" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff55" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="generations" name="Generatsiyalar" fill="#7c5cff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="users" name="Yangi foydalanuvchilar" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
