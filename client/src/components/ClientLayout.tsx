import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { House, Film, Crown, User, Zap, Shield } from "lucide-react";
import { useConfig, useMe } from "@/lib/hooks";
import { clsx } from "./ui";

export function Logo() {
  const { data } = useConfig();
  return (
    <Link href="/" className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-extrabold tracking-tight">{data?.siteName || "AIKadr"}</span>
    </Link>
  );
}

const NAV = [
  { href: "/", label: "Bosh sahifa", icon: House },
  { href: "/my", label: "Ishlarim", icon: Film },
  { href: "/pricing", label: "Tariflar", icon: Crown },
  { href: "/profile", label: "Profil", icon: User },
];

export function ClientLayout({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { user, balance } = useMe();
  const { data: cfg } = useConfig();
  const active = (href: string) => (href === "/" ? loc === "/" : loc.startsWith(href));

  return (
    <div className="min-h-screen pb-24 sm:pb-10">
      {cfg?.aiMode === "mock" && (
        <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-200">
          Sinov rejimi: AI kaliti ulanmagan, natijalar namuna sifatida ko'rsatiladi
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={clsx("rounded-full px-4 py-2 text-sm font-medium transition", active(n.href) ? "bg-white/10 text-white" : "text-white/60 hover:text-white")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <Link href="/admin" className="hidden rounded-full border border-line p-2 text-white/70 hover:text-white sm:block" title="Admin panel">
                <Shield className="h-4 w-4" />
              </Link>
            )}
            {user ? (
              <Link href="/pricing" className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-bold shadow-lg shadow-brand/25">
                <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />{balance}
              </Link>
            ) : (
              <Link href="/login" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">Kirish</Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5">{children}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0e0e15]/95 backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={clsx("flex flex-col items-center gap-1 pt-2.5 text-[11px] font-medium", active(n.href) ? "text-brand-light" : "text-white/50")}>
              <n.icon className="h-6 w-6" />{n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
