import { Button } from "@/components/ui/button";
import { Send, Zap, Shield, TrendingUp, Users, CheckCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  const features = [
    {
      icon: Zap,
      title: "Tezkor O'rnatish",
      description: "Bir necha daqiqada botingizni ishga tushiring. Murakkab sozlashlar kerak emas.",
      color: "bg-blue-100 text-blue-600",
    },
    {
      icon: Shield,
      title: "Xavfsiz va Ishonchli",
      description: "Barcha botlar sinab ko'rilgan va xavfsizlik tekshiruvidan o'tgan.",
      color: "bg-green-100 text-green-600",
    },
    {
      icon: TrendingUp,
      title: "Biznesni Rivojlantirish",
      description: "Sotuvlarni avtomatlashtiring va mijozlar bilan aloqani yaxshilang.",
      color: "bg-purple-100 text-purple-600",
    },
    {
      icon: Users,
      title: "24/7 Qo'llab-quvvatlash",
      description: "Har qanday savolingizga javob berishga tayyor jamoamiz.",
      color: "bg-orange-100 text-orange-600",
    },
  ];

  const stats = [
    { value: "100+", label: "Tayyor Botlar" },
    { value: "5000+", label: "Foydalanuvchilar" },
    { value: "99.9%", label: "Uptime" },
    { value: "24/7", label: "Qo'llab-quvvatlash" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-blue-600 text-white shadow-lg shadow-blue-500/30">
                <Send className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight font-display text-foreground">
                TeleMarket
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild data-testid="button-landing-login">
                <a href="/api/login">Kirish</a>
              </Button>
              <Button asChild className="rounded-full shadow-lg shadow-primary/25" data-testid="button-landing-signup">
                <a href="/api/login">Ro'yxatdan o'tish</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none z-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px] opacity-60 mix-blend-multiply animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] opacity-60 mix-blend-multiply" />
        </div>

        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8"
          >
            <Zap className="h-4 w-4" />
            <span>O'zbekistondagi #1 Telegram Bot Platformasi</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl font-display leading-[1.1]"
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
            Vaqt va mablag'ingizni tejang. Hoziroq bepul boshlang!
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button 
              size="lg" 
              asChild 
              className="rounded-full px-8 py-6 text-lg shadow-xl shadow-primary/30 hover:shadow-primary/40 transition-all"
              data-testid="button-hero-signup"
            >
              <a href="/api/login">
                Bepul Boshlash
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              asChild 
              className="rounded-full px-8 py-6 text-lg"
              data-testid="button-hero-demo"
            >
              <a href="/api/login">Demo Ko'rish</a>
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Kredit karta talab qilinmaydi
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Abadiy bepul plan
            </span>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-border/50 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">
              Nega TeleMarket?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Bizning platformamiz sizning biznesingiz uchun eng yaxshi yechimlarni taqdim etadi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="p-6 rounded-2xl border border-border/50 bg-card hover-elevate transition-all"
              >
                <div className={`h-12 w-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
            Hoziroq Boshlang!
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Minglab tadbirkorlar qatoriga qo'shiling va biznesingizni yangi bosqichga olib chiqing.
          </p>
          <Button 
            size="lg" 
            asChild 
            className="rounded-full px-10 py-6 text-lg shadow-xl shadow-primary/30"
            data-testid="button-cta-signup"
          >
            <a href="/api/login">
              Bepul Ro'yxatdan O'tish
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-blue-600 text-white">
                <Send className="h-4 w-4" />
              </div>
              <span className="font-bold text-foreground">TeleMarket</span>
            </div>
            <p className="text-sm text-muted-foreground">
              2025 TeleMarket. Barcha huquqlar himoyalangan.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
