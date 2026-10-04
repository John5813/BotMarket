import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Zap, Shield, Ban, Eye, RefreshCw } from "lucide-react";
import { api, formatDate, formatPhone, formatUzs, queryClient, type GenerationItem, type Order, type Plan } from "@/lib/api";
import { Badge, Button, Card, Empty, Modal, PageLoader, StatusBadge, Toggle, clsx, useToast } from "@/components/ui";
import { PageHead } from "./AdminLayout";

function useSave(keys: string[]) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, okText = "Saqlandi") {
    setBusy(true);
    try {
      await fn();
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast(okText);
      return true;
    } catch (e) { toast((e as Error).message, "error"); return false; }
    finally { setBusy(false); }
  }
  return { run, busy };
}

// ---------------------------------------------------------------------------
// Kategoriyalar
// ---------------------------------------------------------------------------
type Cat = { id: number; title: string; slug: string; emoji: string; sortOrder: number; isActive: boolean; templateCount: number };

export function AdminCategories() {
  const { data, isLoading } = useQuery<Cat[]>({ queryKey: ["/api/admin/categories"] });
  const [edit, setEdit] = useState<Partial<Cat> | null>(null);
  const { run, busy } = useSave(["/api/admin/categories", "/api/catalog"]);
  if (isLoading) return <PageLoader />;

  async function save() {
    const body = { title: edit!.title, slug: edit!.slug, emoji: edit!.emoji || "", sortOrder: Number(edit!.sortOrder || 0), isActive: edit!.isActive ?? true };
    if (await run(() => api(edit!.id ? `/api/admin/categories/${edit!.id}` : "/api/admin/categories", { method: edit!.id ? "PUT" : "POST", body }))) setEdit(null);
  }

  return (
    <div>
      <PageHead title="Kategoriyalar" subtitle="Bosh sahifadagi bo'limlar (masalan: Raqslar, Effektlar)"
        action={<Button onClick={() => setEdit({ isActive: true, sortOrder: (data?.length || 0) })}><Plus className="h-4 w-4" />Qo'shish</Button>} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nomi</th><th>Slug</th><th>Shablonlar</th><th>Tartib</th><th>Holat</th><th /></tr></thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.emoji} {c.title}</td><td className="text-white/50">{c.slug}</td><td>{c.templateCount}</td><td>{c.sortOrder}</td>
                <td>{c.isActive ? <Badge color="green">Faol</Badge> : <Badge>Yashirin</Badge>}</td>
                <td className="text-right">
                  <button onClick={() => setEdit(c)} className="rounded-lg p-2 text-white/60 hover:bg-white/5" aria-label="Tahrirlash"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => confirm(`"${c.title}" o'chirilsinmi? Shablonlar kategoriyasiz qoladi.`) && run(() => api(`/api/admin/categories/${c.id}`, { method: "DELETE" }), "O'chirildi")} className="rounded-lg p-2 text-white/60 hover:text-red-300" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}>
        {edit && <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div><label className="label">Emoji</label><input className="input text-center" value={edit.emoji || ""} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} /></div>
            <div><label className="label">Nomi</label><input className="input" value={edit.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Slug</label><input className="input" value={edit.slug || ""} placeholder="avtomatik" onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></div>
            <div><label className="label">Tartib</label><input className="input" type="number" value={edit.sortOrder ?? 0} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></div>
          </div>
          <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Faol" />
          <Button className="w-full" loading={busy} onClick={save}>Saqlash</Button>
        </div>}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tariflar
// ---------------------------------------------------------------------------
export function AdminPlans() {
  const { data, isLoading } = useQuery<Plan[]>({ queryKey: ["/api/admin/plans"] });
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const { run, busy } = useSave(["/api/admin/plans", "/api/plans"]);
  if (isLoading) return <PageLoader />;

  async function save() {
    const p = edit!;
    const body = { title: p.title, description: p.description || "", credits: Number(p.credits), priceUzs: Number(p.priceUzs), validityDays: Number(p.validityDays), badge: p.badge || "", sortOrder: Number(p.sortOrder || 0), isActive: p.isActive ?? true };
    if (await run(() => api(p.id ? `/api/admin/plans/${p.id}` : "/api/admin/plans", { method: p.id ? "PUT" : "POST", body }))) setEdit(null);
  }

  return (
    <div>
      <PageHead title="Tariflar" subtitle="Kredit paketlari: haftalik, oylik, yillik va hokazo"
        action={<Button onClick={() => setEdit({ isActive: true, validityDays: 30, credits: 10, sortOrder: data?.length || 0 })}><Plus className="h-4 w-4" />Qo'shish</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data?.map((p) => (
          <Card key={p.id} className={clsx("p-5", !p.isActive && "opacity-50")}>
            <div className="flex items-start justify-between">
              <div className="font-bold">{p.title}</div>
              {p.badge && <Badge color="brand">{p.badge}</Badge>}
            </div>
            <div className="mt-2 text-2xl font-extrabold">{formatUzs(p.priceUzs)}</div>
            <div className="mt-1 text-sm text-white/50">{p.credits} kredit · {p.validityDays} kun · {formatUzs(Math.round(p.priceUzs / p.credits))}/kredit</div>
            <div className="mt-4 flex items-center justify-between">
              {p.isActive ? <Badge color="green">Faol</Badge> : <Badge>O'chirilgan</Badge>}
              <div>
                <button onClick={() => setEdit(p)} className="rounded-lg p-2 text-white/60 hover:bg-white/5" aria-label="Tahrirlash"><Pencil className="h-4 w-4" /></button>
                {p.isActive && <button onClick={() => confirm("Tarifni o'chirasizmi? (sotib olinganlar saqlanadi)") && run(() => api(`/api/admin/plans/${p.id}`, { method: "DELETE" }), "O'chirildi")} className="rounded-lg p-2 text-white/60 hover:text-red-300" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Tarifni tahrirlash" : "Yangi tarif"}>
        {edit && <div className="space-y-4">
          <div><label className="label">Nomi</label><input className="input" value={edit.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
          <div><label className="label">Tavsif</label><input className="input" value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Kredit</label><input className="input" type="number" value={edit.credits ?? ""} onChange={(e) => setEdit({ ...edit, credits: Number(e.target.value) })} /></div>
            <div><label className="label">Narx (so'm)</label><input className="input" type="number" value={edit.priceUzs ?? ""} onChange={(e) => setEdit({ ...edit, priceUzs: Number(e.target.value) })} /></div>
            <div><label className="label">Muddat (kun)</label><input className="input" type="number" value={edit.validityDays ?? ""} onChange={(e) => setEdit({ ...edit, validityDays: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Belgi (badge)</label><input className="input" value={edit.badge || ""} placeholder="Ommabop" onChange={(e) => setEdit({ ...edit, badge: e.target.value })} /></div>
            <div><label className="label">Tartib</label><input className="input" type="number" value={edit.sortOrder ?? 0} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></div>
          </div>
          <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Faol" />
          <Button className="w-full" loading={busy} onClick={save}>Saqlash</Button>
        </div>}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Foydalanuvchilar
// ---------------------------------------------------------------------------
type AdminUser = { id: number; phone: string; name: string; role: "user" | "admin"; isBlocked: boolean; createdAt: string; lastLoginAt: string | null; balance: number; generations: number; spent: number };

export function AdminUsers() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => { const t = setTimeout(() => setQuery(q), 350); return () => clearTimeout(t); }, [q]);
  const { data, isLoading } = useQuery<AdminUser[]>({ queryKey: [`/api/admin/users?q=${encodeURIComponent(query)}`] });
  const [credit, setCredit] = useState<{ user: AdminUser; delta: string; days: string; note: string } | null>(null);
  const keys = [`/api/admin/users?q=${encodeURIComponent(query)}`];
  const { run, busy } = useSave(keys);

  return (
    <div>
      <PageHead title="Foydalanuvchilar" subtitle="Kredit qo'shish, bloklash, admin tayinlash" />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input className="input pl-10" placeholder="Telefon yoki ism bo'yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? <PageLoader /> : !data?.length ? <Empty title="Topilmadi" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Foydalanuvchi</th><th>Balans</th><th>Ishlar</th><th>To'lagan</th><th>Ro'yxatdan</th><th>Holat</th><th /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td><div className="font-medium">{u.name} {u.role === "admin" && <Badge color="brand">admin</Badge>}</div><div className="text-xs text-white/50">{formatPhone(u.phone)}</div></td>
                  <td><span className="flex items-center gap-1 font-semibold"><Zap className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />{u.balance}</span></td>
                  <td><Link href={`/admin/generations?userId=${u.id}`} className="text-brand-light hover:underline">{u.generations}</Link></td>
                  <td>{formatUzs(u.spent)}</td>
                  <td className="whitespace-nowrap text-white/60">{formatDate(u.createdAt, false)}</td>
                  <td>{u.isBlocked ? <Badge color="red">Bloklangan</Badge> : <Badge color="green">Faol</Badge>}</td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="secondary" onClick={() => setCredit({ user: u, delta: "5", days: "30", note: "" })}><Zap className="h-3.5 w-3.5" />Kredit</Button>
                    <button title={u.role === "admin" ? "Adminlikdan olish" : "Admin qilish"} onClick={() => confirm(u.role === "admin" ? "Adminlikdan olinsinmi?" : "Admin qilinsinmi? Admin barcha ma'lumotlarni ko'radi") && run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { role: u.role === "admin" ? "user" : "admin" } }))} className="ml-1 rounded-lg p-2 text-white/60 hover:bg-white/5"><Shield className="h-4 w-4" /></button>
                    <button title={u.isBlocked ? "Blokdan chiqarish" : "Bloklash"} onClick={() => run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { isBlocked: !u.isBlocked } }))} className={clsx("rounded-lg p-2 hover:bg-white/5", u.isBlocked ? "text-red-300" : "text-white/60")}><Ban className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!credit} onClose={() => setCredit(null)} title={`Kredit: ${credit?.user.name || ""}`}>
        {credit && <div className="space-y-4">
          <p className="text-sm text-white/60">Hozirgi balans: <b className="text-white">{credit.user.balance}</b>. Ayirish uchun manfiy son kiriting (masalan: -3).</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Miqdor</label><input className="input" type="number" value={credit.delta} onChange={(e) => setCredit({ ...credit, delta: e.target.value })} /></div>
            <div><label className="label">Muddat (kun)</label><input className="input" type="number" value={credit.days} onChange={(e) => setCredit({ ...credit, days: e.target.value })} /></div>
          </div>
          <div><label className="label">Izoh</label><input className="input" placeholder="Masalan: shikoyat uchun kompensatsiya" value={credit.note} onChange={(e) => setCredit({ ...credit, note: e.target.value })} /></div>
          <Button className="w-full" loading={busy} onClick={async () => {
            if (await run(() => api(`/api/admin/users/${credit.user.id}/credits`, { body: { delta: Number(credit.delta), days: credit.days ? Number(credit.days) : null, note: credit.note } }), "Balans yangilandi")) setCredit(null);
          }}>Tasdiqlash</Button>
        </div>}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generatsiyalar
// ---------------------------------------------------------------------------
export function AdminGenerations() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [status, setStatus] = useState(params.get("status") || "");
  const userId = params.get("userId") || "";
  const key = `/api/admin/generations?status=${status}${userId ? `&userId=${userId}` : ""}`;
  const { data, isLoading, refetch, isFetching } = useQuery<GenerationItem[]>({ queryKey: [key], refetchInterval: 10_000 });
  const [view, setView] = useState<GenerationItem | null>(null);

  return (
    <div>
      <PageHead title="Generatsiyalar" subtitle={userId ? `Foydalanuvchi #${userId}` : "Barcha foydalanuvchilar ishlari"}
        action={<Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}><RefreshCw className="h-4 w-4" />Yangilash</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[["", "Hammasi"], ["processing", "Bajarilmoqda"], ["queued", "Navbatda"], ["succeeded", "Tayyor"], ["failed", "Xatolik"]].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={clsx("rounded-full px-4 py-1.5 text-sm", status === k ? "bg-white text-black" : "bg-card text-white/60 ring-1 ring-line")}>{l}</button>
        ))}
      </div>
      {isLoading ? <PageLoader /> : !data?.length ? <Empty title="Hozircha yo'q" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vaqt</th><th>Foydalanuvchi</th><th>Shablon</th><th>Holat</th><th>Kredit</th><th>Tannarx</th><th /></tr></thead>
            <tbody>
              {data.map((g) => (
                <tr key={g.id}>
                  <td className="whitespace-nowrap text-white/60">{formatDate(g.createdAt)}</td>
                  <td><div>{g.user?.name}</div><div className="text-xs text-white/40">{g.user && formatPhone(g.user.phone)}</div></td>
                  <td>{g.templateTitle}</td>
                  <td><StatusBadge status={g.status} />{g.status === "processing" && <span className="ml-1 text-xs text-white/40">{g.stepIndex + 1}/{g.totalSteps}</span>}</td>
                  <td>{g.creditsSpent}</td>
                  <td className="text-white/60">${(g.costUsd ?? 0).toFixed(2)}</td>
                  <td className="text-right"><button onClick={() => setView(g)} className="rounded-lg p-2 text-white/60 hover:bg-white/5" aria-label="Ko'rish"><Eye className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title="Generatsiya tafsilotlari" wide>
        {view && <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-white/70">
            <div>ID: <code className="text-white">{view.id}</code></div><div>Holat: <StatusBadge status={view.status} /></div>
            <div>Boshlangan: {formatDate(view.createdAt)}</div><div>Tugagan: {formatDate(view.finishedAt)}</div>
            <div>Urinishlar: {(view.attempts ?? 0) + 1}</div><div>Tannarx: ${(view.costUsd ?? 0).toFixed(2)}</div>
          </div>
          {view.rawError && <div className="rounded-xl bg-red-500/10 p-3 font-mono text-xs text-red-200">{view.rawError}</div>}
          {!!view.outputs.length && (
            <div className="grid grid-cols-2 gap-2">
              {view.outputs.map((o, i) => o.type === "video"
                ? <video key={i} src={o.url} controls className="w-full rounded-xl" />
                : <img key={i} src={o.url} alt="" className="w-full rounded-xl" />)}
            </div>
          )}
          <Link href={`/g/${view.id}`} className="inline-block text-brand-light hover:underline">Mijoz ko'rinishida ochish →</Link>
        </div>}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// To'lovlar
// ---------------------------------------------------------------------------
export function AdminOrders() {
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery<Order[]>({ queryKey: [`/api/admin/orders?status=${status}`] });
  const paidSum = (data || []).filter((o) => o.status === "paid").reduce((s, o) => s + o.amountUzs, 0);
  return (
    <div>
      <PageHead title="To'lovlar" subtitle={`Ko'rsatilganlar orasida to'langan: ${formatUzs(paidSum)}`} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[["", "Hammasi"], ["paid", "To'langan"], ["pending", "Kutilmoqda"], ["cancelled", "Bekor"], ["refunded", "Qaytarilgan"]].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={clsx("rounded-full px-4 py-1.5 text-sm", status === k ? "bg-white text-black" : "bg-card text-white/60 ring-1 ring-line")}>{l}</button>
        ))}
      </div>
      {isLoading ? <PageLoader /> : !data?.length ? <Empty title="To'lovlar yo'q" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Vaqt</th><th>Foydalanuvchi</th><th>Tarif</th><th>Summa</th><th>Tizim</th><th>Holat</th></tr></thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td className="text-white/50">{o.id}</td>
                  <td className="whitespace-nowrap text-white/60">{formatDate(o.createdAt)}</td>
                  <td><div>{o.user?.name}</div><div className="text-xs text-white/40">{o.user && formatPhone(o.user.phone)}</div></td>
                  <td>{o.planTitle} <span className="text-white/40">({o.credits} kr)</span></td>
                  <td className="whitespace-nowrap font-semibold">{formatUzs(o.amountUzs)}</td>
                  <td><Badge color={o.provider === "payme" ? "blue" : o.provider === "click" ? "brand" : "yellow"}>{o.provider}</Badge></td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sozlamalar
// ---------------------------------------------------------------------------
type SettingsValues = { siteName: string; tagline: string; signupBonusCredits: number; signupBonusDays: number; inputRetentionHours: number; usdToUzs: number; supportTelegram: string; generationTimeoutMinutes: number };

export function AdminSettings() {
  const { data, isLoading } = useQuery<{ values: SettingsValues }>({ queryKey: ["/api/admin/settings"] });
  const [v, setV] = useState<SettingsValues | null>(null);
  const { run, busy } = useSave(["/api/admin/settings", "/api/config"]);
  useEffect(() => { if (data) setV(data.values); }, [data]);
  if (isLoading || !v) return <PageLoader />;
  const num = (k: keyof SettingsValues) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value) });
  const str = (k: keyof SettingsValues) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <div className="max-w-2xl">
      <PageHead title="Sozlamalar" action={<Button loading={busy} onClick={() => run(() => api("/api/admin/settings", { method: "PUT", body: v }))}>Saqlash</Button>} />
      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Sayt nomi</label><input className="input" value={v.siteName} onChange={str("siteName")} /></div>
          <div><label className="label">Telegram (qo'llab-quvvatlash)</label><input className="input" placeholder="@username" value={v.supportTelegram} onChange={str("supportTelegram")} /></div>
        </div>
        <div><label className="label">Shior</label><input className="input" value={v.tagline} onChange={str("tagline")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Ro'yxatdan o'tish bonusi (kredit)</label><input className="input" type="number" min={0} value={v.signupBonusCredits} onChange={num("signupBonusCredits")} /></div>
          <div><label className="label">Bonus muddati (kun)</label><input className="input" type="number" min={1} value={v.signupBonusDays} onChange={num("signupBonusDays")} /></div>
          <div><label className="label">Mijoz rasmlarini saqlash (soat)</label><input className="input" type="number" min={1} value={v.inputRetentionHours} onChange={num("inputRetentionHours")} /></div>
          <div><label className="label">Generatsiya vaqt chegarasi (daqiqa)</label><input className="input" type="number" min={2} value={v.generationTimeoutMinutes} onChange={num("generationTimeoutMinutes")} /></div>
          <div><label className="label">Dollar kursi (so'm)</label><input className="input" type="number" min={1} value={v.usdToUzs} onChange={num("usdToUzs")} /></div>
        </div>
        <p className="text-xs text-white/40">Bepul bonus kredit sizga real pul turadi (har bir video ~$0.35–0.60). Firibgarlikni kamaytirish uchun bonusni 1 tadan oshirmang.</p>
      </Card>
    </div>
  );
}
