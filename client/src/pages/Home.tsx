import { useBots } from "@/hooks/use-bots";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BotCard } from "@/components/BotCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { data: bots, isLoading, error } = useBots();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-body">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
        {/* Background Decorative Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none z-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px] opacity-60 mix-blend-multiply animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] opacity-60 mix-blend-multiply animation-delay-2000" />
        </div>

        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8"
          >
            <Sparkles className="h-4 w-4" />
            <span>Eng ishonchli Telegram botlar platformasi</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl font-display leading-[1.1]"
          >
            Biznesingiz uchun <span className="text-gradient">Professional</span> Telegram Botlar
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed"
          >
            Tayyor yechimlarni toping, sinab ko'ring va biznesingizni avtomatlashtiring. 
            Vaqt va mablag'ingizni tejang.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto mt-10 max-w-md"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex items-center bg-background rounded-xl p-2 shadow-xl ring-1 ring-black/5">
                <Search className="ml-3 h-5 w-5 text-muted-foreground" />
                <Input 
                  type="text" 
                  placeholder="Bot nomini qidiring..." 
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70 h-10 text-base"
                />
                <Button className="rounded-lg px-6 h-10 bg-primary hover:bg-primary/90 text-white font-medium shadow-md shadow-primary/20">
                  Qidirish
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid / Categories (Optional) */}
      <section className="border-y border-border/50 bg-secondary/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-background border border-border/50 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Tezkor O'rnatish</h3>
                <p className="text-sm text-muted-foreground">Bir necha daqiqada ishga tushiring</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-background border border-border/50 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Biznesni Rivojlantirish</h3>
                <p className="text-sm text-muted-foreground">Sotuvlarni avtomatlashtiring</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-background border border-border/50 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Sifat Kafolati</h3>
                <p className="text-sm text-muted-foreground">Tekshirilgan va barqaror kod</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bots List Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold font-display text-foreground">So'nggi qo'shilganlar</h2>
              <p className="mt-2 text-muted-foreground">Platformadagi eng yangi va ommabop botlar</p>
            </div>
            <Button variant="outline" className="hidden sm:flex rounded-xl border-border hover:bg-secondary">
              Barchasini ko'rish
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-4">
                  <div className="h-48 rounded-xl bg-muted animate-pulse" />
                  <div className="h-6 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-full rounded bg-muted animate-pulse" />
                  <div className="h-10 w-full rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20 rounded-2xl bg-destructive/5 border border-destructive/10">
              <h3 className="text-xl font-bold text-destructive">Xatolik yuz berdi</h3>
              <p className="text-muted-foreground mt-2">Botlarni yuklab bo'lmadi. Iltimos qayta urinib ko'ring.</p>
            </div>
          ) : bots?.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">Hozircha botlar mavjud emas.</p>
            </div>
          ) : (
            <motion.div 
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
            >
              {bots?.map((bot) => (
                <motion.div key={bot.id} variants={item}>
                  <BotCard bot={bot} />
                </motion.div>
              ))}
            </motion.div>
          )}

          <div className="mt-12 text-center sm:hidden">
            <Button variant="outline" className="w-full rounded-xl py-6">
              Barchasini ko'rish
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
