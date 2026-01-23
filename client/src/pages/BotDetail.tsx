import { useBot } from "@/hooks/use-bots";
import { useRoute } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  CheckCircle2, 
  ExternalLink, 
  MessageCircle, 
  ShieldCheck, 
  Zap,
  ShoppingCart
} from "lucide-react";
import { Link } from "wouter";

export default function BotDetail() {
  const [match, params] = useRoute("/bot/:id");
  const id = parseInt(params?.id || "0");
  const { data: bot, isLoading, error } = useBot(id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20">
          <div className="animate-pulse space-y-8">
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="h-96 bg-muted rounded-2xl" />
              <div className="space-y-6">
                <div className="h-12 w-3/4 bg-muted rounded" />
                <div className="h-6 w-1/4 bg-muted rounded" />
                <div className="h-32 w-full bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold font-display mb-4">Bot topilmadi</h2>
          <p className="text-muted-foreground mb-8">
            Siz qidirayotgan bot mavjud emas yoki o'chirib yuborilgan.
          </p>
          <Link href="/">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" /> Bosh sahifaga qaytish
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Parse features safely
  const features = bot.features ? JSON.parse(bot.features as unknown as string) : [];

  return (
    <div className="min-h-screen flex flex-col bg-background font-body">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Ortga qaytish
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Left Column - Visuals */}
            <div className="space-y-8">
              <div className="aspect-[4/3] rounded-3xl overflow-hidden border border-border shadow-2xl shadow-primary/5 bg-muted relative group">
                <img 
                  src={bot.imageUrl} 
                  alt={bot.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
              
              {/* Additional small thumbnails could go here */}
            </div>

            {/* Right Column - Info */}
            <div className="flex flex-col">
              <div className="mb-6">
                <Badge variant="secondary" className="mb-4 text-primary bg-primary/10 hover:bg-primary/20 border-0 px-3 py-1">
                  {bot.category}
                </Badge>
                <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-foreground mb-4">
                  {bot.name}
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-green-500" /> Tasdiqlangan
                  </span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span>v1.0.2</span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span>Yangilangan: 2 kun oldin</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-secondary/30 rounded-2xl border border-border/50 mb-8 backdrop-blur-sm">
                <div>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Narxi</p>
                  <p className="text-3xl font-bold text-primary font-display">{bot.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Litsenziya</p>
                  <p className="text-lg font-semibold">Umrbod</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <a 
                  href={bot.demoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button size="lg" variant="outline" className="w-full h-14 text-base font-semibold border-2 rounded-xl hover:bg-secondary/50 hover:text-primary transition-all">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Ishlatib ko'rish
                  </Button>
                </a>
                <Button size="lg" className="flex-1 h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-200">
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Sotib olish
                </Button>
              </div>

              <Separator className="mb-8" />

              <div className="prose prose-blue max-w-none mb-10">
                <h3 className="text-xl font-bold font-display mb-4">Bot haqida</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {bot.description}
                </p>
              </div>

              {features && Array.isArray(features) && features.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold font-display mb-6">Imkoniyatlar</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {features.map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border hover:border-primary/30 transition-colors">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                        <span className="text-sm font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
