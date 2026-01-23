import { Send } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-muted/50 border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <Send className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold font-display">TeleMarket</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Biznesingiz uchun eng sifatli va foydali Telegram botlar to'plami.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Platforma</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Barcha botlar</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Yangi qo'shilganlar</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Ommabop</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Yordam</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Qo'llanma</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Bog'lanish</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Biz ijtimoiy tarmoqlarda</h4>
            <div className="flex gap-4">
              <a href="#" className="h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-all duration-300">
                <Send className="h-5 w-5" />
              </a>
              {/* Add more social icons here */}
            </div>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TeleMarket. Barcha huquqlar himoyalangan.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Maxfiylik siyosati</a>
            <a href="#" className="hover:text-foreground">Foydalanish shartlari</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
