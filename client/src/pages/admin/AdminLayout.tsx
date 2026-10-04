import { useState, type ReactNode } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { LayoutDashboard, Film, FolderTree, Crown, Users, Layers, Receipt, Settings, ArrowLeft, Menu, X } from "lucide-react";
import { useMe } from "@/lib/hooks";
import { Logo } from "@/components/ClientLayout";
import { PageLoader, clsx } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/templates", label: "Shablonlar", icon: Film },
  { href: "/admin/categories", label: "Kategoriyalar", icon: FolderTree },
  { href: "/admin/plans", label: "Tariflar", icon: Crown },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: Users },
  { href: "/admin/generations", label: "Generatsiyalar", icon: Layers },
  { href: "/admin/orders", label: "To'lovlar", icon: Receipt },
  { href: "/admin/settings", label: "Sozlamalar", icon: Settings },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { user, isLoading } = useMe();
  const [open, setOpen] = useState(false);
  if (isLoading) return <PageLoader />;
  if (!user) return <Redirect to="/login?next=/admin" />;
  if (user.role !== "admin") return <div className="p-10 text-center text-white/60">Bu sahifa faqat adminlar uchun. <Link href="/" className="text-brand-light">Bosh sahifa</Link></div>;

  const active = (href: string) => (href === "/admin" ? loc === "/admin" : loc.startsWith(href));
  const nav = (
    <nav className="space-y-1">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active(n.href) ? "bg-brand/20 text-white" : "text-white/60 hover:bg-white/5 hover:text-white")}>
          <n.icon className="h-[18px] w-[18px]" />{n.label}
        </Link>
      ))}
      <Link href="/" className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/50 hover:text-white"><ArrowLeft className="h-[18px] w-[18px]" />Saytga qaytish</Link>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-[#0e0e15] p-4 lg:block">
        <div className="mb-8 flex items-center gap-2"><Logo /><span className="rounded bg-brand/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">Admin</span></div>
        {nav}
      </aside>
      <div className="flex items-center justify-between border-b border-line bg-[#0e0e15] px-4 py-3 lg:hidden">
        <Logo />
        <button onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-white/5" aria-label="Menyu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && <div className="border-b border-line bg-[#0e0e15] p-4 lg:hidden">{nav}</div>}
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
