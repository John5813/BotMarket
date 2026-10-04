import { QueryClientProvider } from "@tanstack/react-query";
import { Link, Redirect, Route, Switch } from "wouter";
import type { ReactNode } from "react";
import { queryClient } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { ToastProvider, Empty, PageLoader } from "@/components/ui";
import { ClientLayout } from "@/components/ClientLayout";
import { HomePage, CategoryPage } from "@/pages/Home";
import { TemplatePage } from "@/pages/TemplatePage";
import { GenerationPage, MyWorksPage } from "@/pages/Generation";
import { PricingPage, PaymentReturnPage } from "@/pages/Pricing";
import { LoginPage, RegisterPage, ProfilePage, TermsPage } from "@/pages/Account";
import { lazy, Suspense } from "react";

// Admin panel alohida yuklanadi — oddiy mijozlar uchun sayt tezroq ochiladi
const AdminRoutes = lazy(() => import("@/pages/admin/AdminRoutes"));

/** Faqat tizimga kirganlar uchun sahifalar */
function Private({ children, path }: { children: ReactNode; path: string }) {
  const { user, isLoading } = useMe();
  if (isLoading) return <PageLoader />;
  if (!user) return <Redirect to={`/login?next=${encodeURIComponent(path)}`} />;
  return <>{children}</>;
}

function ClientRoutes() {
  return (
    <ClientLayout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/c/:slug" component={CategoryPage} />
        <Route path="/t/:slug" component={TemplatePage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/g/:id">{(p) => <Private path={`/g/${p.id}`}><GenerationPage /></Private>}</Route>
        <Route path="/my"><Private path="/my"><MyWorksPage /></Private></Route>
        <Route path="/profile"><Private path="/profile"><ProfilePage /></Private></Route>
        <Route path="/payment/:id">{(p) => <Private path={`/payment/${p.id}`}><PaymentReturnPage /></Private>}</Route>
        <Route><Empty title="Sahifa topilmadi" text="Havola noto'g'ri yoki sahifa o'chirilgan" action={<Link href="/" className="text-brand-light">Bosh sahifaga</Link>} /></Route>
      </Switch>
    </ClientLayout>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/admin"><Suspense fallback={<PageLoader />}><AdminRoutes /></Suspense></Route>
          <Route path="/admin/*"><Suspense fallback={<PageLoader />}><AdminRoutes /></Suspense></Route>
          <Route component={ClientRoutes} />
        </Switch>
      </ToastProvider>
    </QueryClientProvider>
  );
}
