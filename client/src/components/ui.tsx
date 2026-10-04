import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { LoaderCircle, X, CircleCheck, TriangleAlert } from "lucide-react";

export { clsx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "white";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-9 px-4 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-14 px-7 text-base",
        variant === "primary" && "bg-gradient-to-r from-brand to-brand-dark text-white shadow-lg shadow-brand/25 hover:brightness-110",
        variant === "secondary" && "border border-line bg-card text-white hover:border-white/30",
        variant === "ghost" && "text-white/70 hover:bg-white/5 hover:text-white",
        variant === "danger" && "bg-red-500/15 text-red-300 hover:bg-red-500/25",
        variant === "white" && "bg-white text-black hover:bg-white/90",
        className,
      )}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-2xl border border-line bg-card", className)}>{children}</div>;
}

export function Badge({ children, color = "gray", className }: { children: ReactNode; color?: "gray" | "green" | "red" | "yellow" | "brand" | "blue"; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
      gray: "bg-white/10 text-white/70", green: "bg-emerald-500/15 text-emerald-300", red: "bg-red-500/15 text-red-300",
      yellow: "bg-amber-500/15 text-amber-300", brand: "bg-brand/20 text-brand-light", blue: "bg-sky-500/15 text-sky-300",
    }[color], className)}>{children}</span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={clsx("animate-spin text-brand-light", className || "h-6 w-6")} />;
}

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>;
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-3 text-white/30">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {text && <div className="mt-1 max-w-sm text-sm text-white/50">{text}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={clsx("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-[#12121a] p-5 sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Yopish"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-white/15")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
      {label}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, "gray" | "green" | "red" | "yellow" | "brand" | "blue"]> = {
    queued: ["Navbatda", "gray"], processing: ["Tayyorlanmoqda", "brand"], succeeded: ["Tayyor", "green"], failed: ["Xatolik", "red"],
    pending: ["Kutilmoqda", "yellow"], paid: ["To'langan", "green"], cancelled: ["Bekor qilingan", "gray"], refunded: ["Qaytarilgan", "red"],
  };
  const [label, color] = map[status] || [status, "gray"];
  return <Badge color={color}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Bildirishnomalar (toast)
// ---------------------------------------------------------------------------
type ToastItem = { id: number; text: string; type: "success" | "error" };
const ToastCtx = createContext<(text: string, type?: "success" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, type: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, type }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={clsx("pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur",
            t.type === "success" ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-100" : "border-red-500/30 bg-red-950/90 text-red-100")}>
            {t.type === "success" ? <CircleCheck className="h-4 w-4 shrink-0" /> : <TriangleAlert className="h-4 w-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/**
 * Raqam maydoni: bo'sh qoldirish mumkin, "0123" kabi yopishib qolmaydi,
 * telefonda raqamli klaviatura ochiladi. Bo'sh bo'lsa qiymat 0 hisoblanadi.
 */
export function NumInput({ value, onChange, decimal, className, ...rest }:
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & { value: number | null | undefined; onChange: (v: number) => void; decimal?: boolean }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => {
    const cur = text === "" || text === "-" || text === "." ? 0 : Number(text);
    if ((value ?? 0) !== cur) setText(value == null ? "" : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input {...rest} type="text" inputMode={decimal ? "decimal" : "numeric"} autoComplete="off"
      className={clsx("input", className)} value={text}
      onFocus={(e) => { if (text === "0") e.currentTarget.select(); rest.onFocus?.(e); }}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".").replace(/\s/g, "");
        if (!(decimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/).test(t)) return;
        const cleaned = t.replace(/^(-?)0+(?=\d)/, "$1");   // "0123" → "123"
        setText(cleaned);
        const n = Number(cleaned);
        onChange(cleaned === "" || cleaned === "-" || cleaned === "." || !Number.isFinite(n) ? 0 : n);
      }} />
  );
}
