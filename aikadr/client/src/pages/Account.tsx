import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Zap, Shield, Eye, EyeOff } from "lucide-react";
import { api, formatDate, formatPhone, formatUzs, queryClient, type Order } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { Logo } from "@/components/ClientLayout";
import { Button, Card, PageLoader, StatusBadge, clsx, useToast } from "@/components/ui";

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-line bg-card focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
      <span className="pl-4 text-sm text-white/50">+998</span>
      <input inputMode="tel" autoComplete="tel" placeholder="90 123 45 67" value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))}
        className="w-full bg-transparent px-2 py-3 text-sm outline-none placeholder:text-white/30" />
    </div>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#2a1f66_0%,_#0b0b10_60%)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <Card className="p-6">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-white/50">{subtitle}</p>
          {children}
        </Card>
      </div>
    </div>
  );
}

function useAuthSubmit(path: string) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const next = new URLSearchParams(search).get("next");
  async function submit(body: object) {
    setBusy(true);
    try {
      await api(path, { body });
      await queryClient.invalidateQueries();
      navigate(next && next.startsWith("/") ? next : "/");
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  }
  return { submit, busy, next };
}

export function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const { submit, busy, next } = useAuthSubmit("/api/auth/login");
  return (
    <AuthShell title="Xush kelibsiz" subtitle="Telefon raqamingiz va parolingiz bilan kiring">
      <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); submit({ phone: phone.replace(/\D/g, ""), password }); }}>
        <div><label className="label">Telefon</label><PhoneInput value={phone} onChange={setPhone} /></div>
        <div>
          <label className="label">Parol</label>
          <div className="relative">
            <input className="input pr-11" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" aria-label="Parolni ko'rsatish">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </div>
        <Button className="w-full" loading={busy} type="submit">Kirish</Button>
      </form>
      <p className="mt-5 text-center text-sm text-white/50">Hisobingiz yo'qmi? <Link href={`/register${next ? `?next=${next}` : ""}`} className="font-semibold text-brand-light">Ro'yxatdan o'tish</Link></p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const { submit, busy, next } = useAuthSubmit("/api/auth/register");
  return (
    <AuthShell title="Ro'yxatdan o'tish" subtitle="Birinchi video uchun bonus kredit beriladi 🎁">
      <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); submit({ name, phone: phone.replace(/\D/g, ""), password }); }}>
        <div><label className="label">Ismingiz</label><input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Telefon</label><PhoneInput value={phone} onChange={setPhone} /></div>
        <div><label className="label">Parol (kamida 6 belgi)</label><input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" loading={busy} type="submit">Ro'yxatdan o'tish</Button>
        <p className="text-center text-xs text-white/40">Ro'yxatdan o'tib, <Link href="/terms" className="underline">foydalanish shartlariga</Link> rozilik bildirasiz</p>
      </form>
      <p className="mt-5 text-center text-sm text-white/50">Hisobingiz bormi? <Link href={`/login${next ? `?next=${next}` : ""}`} className="font-semibold text-brand-light">Kirish</Link></p>
    </AuthShell>
  );
}

type CreditOverview = {
  balance: number;
  lots: { id: number; remaining: number; expiresAt: string | null; source: string }[];
  history: { id: number; delta: number; reason: string; createdAt: string }[];
};

export function ProfilePage() {
  const { user } = useMe();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"credits" | "orders">("credits");
  const { data, isLoading } = useQuery<CreditOverview>({ queryKey: ["/api/me/credits"] });
  const { data: orders } = useQuery<Order[]>({ queryKey: ["/api/orders"], enabled: tab === "orders" });
  if (isLoading || !user) return <PageLoader />;

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    navigate("/");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-fuchsia-500 text-xl font-bold">{user.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="text-lg font-bold">{user.name}</div>
            <div className="text-sm text-white/50">{formatPhone(user.phone)}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" />Chiqish</Button>
      </Card>
      {user.role === "admin" && <Link href="/admin" className="mt-3 flex items-center gap-2 rounded-2xl border border-brand/40 bg-brand/10 p-4 text-sm font-semibold text-brand-light"><Shield className="h-4 w-4" />Admin panelga o'tish</Link>}

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-brand/30 to-fuchsia-500/20 p-5">
          <div>
            <div className="text-sm text-white/60">Balans</div>
            <div className="flex items-center gap-2 text-4xl font-extrabold"><Zap className="h-8 w-8 fill-amber-300 text-amber-300" />{data?.balance ?? 0}</div>
          </div>
          <Link href="/pricing"><Button variant="white">To'ldirish</Button></Link>
        </div>
        {!!data?.lots.length && (
          <div className="space-y-1 p-5 text-sm">
            <div className="label">Amal qilish muddatlari</div>
            {data.lots.map((l) => (
              <div key={l.id} className="flex justify-between text-white/70"><span>{l.remaining} kredit</span><span>{l.expiresAt ? `${formatDate(l.expiresAt, false)} gacha` : "Muddatsiz"}</span></div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 flex gap-2">
        {(["credits", "orders"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx("rounded-full px-4 py-2 text-sm font-medium", tab === t ? "bg-white text-black" : "bg-card text-white/60 ring-1 ring-line")}>
            {t === "credits" ? "Kredit tarixi" : "To'lovlar"}
          </button>
        ))}
      </div>
      <Card className="mt-3 divide-y divide-line">
        {tab === "credits" && (data?.history.length ? data.history.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div><div>{h.reason}</div><div className="text-xs text-white/40">{formatDate(h.createdAt)}</div></div>
            <div className={clsx("font-bold", h.delta > 0 ? "text-emerald-300" : "text-white/70")}>{h.delta > 0 ? "+" : ""}{h.delta}</div>
          </div>
        )) : <div className="p-5 text-sm text-white/50">Tarix bo'sh</div>)}
        {tab === "orders" && (orders?.length ? orders.map((o) => (
          <Link key={o.id} href={`/payment/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-white/5">
            <div><div>{o.planTitle} · {formatUzs(o.amountUzs)}</div><div className="text-xs text-white/40">#{o.id} · {o.provider} · {formatDate(o.createdAt)}</div></div>
            <StatusBadge status={o.status} />
          </Link>
        )) : <div className="p-5 text-sm text-white/50">To'lovlar yo'q</div>)}
      </Card>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="prose-invert mx-auto max-w-2xl space-y-4 text-sm leading-relaxed text-white/75">
      <h1 className="text-2xl font-extrabold text-white">Foydalanish shartlari va maxfiylik</h1>
      <p><b className="text-white">1. Rozilik.</b> Siz faqat o'zingizning rasmingizni yoki rasmdagi shaxsning aniq roziligini olgan holda rasm yuklaysiz. Voyaga yetmaganlar rasmini ota-onasining roziligisiz yuklash taqiqlanadi.</p>
      <p><b className="text-white">2. Taqiqlangan foydalanish.</b> Boshqa odamni kamsitish, tuhmat, shantaj, firibgarlik, siyosiy yoki 18+ kontent yaratish, mashhur shaxslar nomidan soxta video tarqatish qat'iyan taqiqlanadi. Qoidabuzarlik aniqlansa, hisob ogohlantirishsiz bloklanadi.</p>
      <p><b className="text-white">3. Ma'lumotlarni saqlash.</b> Yuklangan rasmlar faqat video yaratish uchun ishlatiladi va 24 soatdan keyin serverdan avtomatik o'chiriladi. Tayyor natijalarni istalgan vaqtda "Ishlarim" bo'limidan o'chirishingiz mumkin.</p>
      <p><b className="text-white">4. Sun'iy intellekt.</b> Natijalar sun'iy intellekt tomonidan yaratiladi va haqiqiy voqealarni aks ettirmaydi. Videoni tarqatishda uning AI yordamida yaratilganini ko'rsatishingizni so'raymiz.</p>
      <p><b className="text-white">5. Kreditlar.</b> Kreditlar tarifda ko'rsatilgan muddat davomida amal qiladi. Texnik sabab bilan natija chiqmasa, kredit avtomatik qaytariladi. Ishlatilmagan kreditlar bo'yicha murojaatlar qo'llab-quvvatlash xizmati orqali ko'rib chiqiladi.</p>
    </div>
  );
}
