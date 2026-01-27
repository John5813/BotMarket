import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, LogOut, User, Send, MoreVertical, HelpCircle, Settings, X, Home, Grid, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleAdminAccess = () => {
    if (password === "Javlon58_13") {
      setShowPasswordDialog(false);
      setPassword("");
      setLocation("/admin");
    } else {
      toast({
        title: "Xato parol",
        description: "Parol noto'g'ri. Qaytadan urinib ko'ring.",
        variant: "destructive",
      });
      setPassword("");
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-blue-600 text-white shadow-lg shadow-blue-500/30">
                <Send className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight font-display text-foreground">
                TeleMarket
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="/" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>
                Botlar
              </Link>
              <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Kategoriyalar
              </Link>
              <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Foydali
              </Link>
            </div>

            {/* Auth Actions */}
            <div className="flex items-center gap-2">
              {/* Three Dots Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-more-menu">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Qo'shimcha</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem data-testid="menu-item-account">
                    <User className="mr-2 h-4 w-4" />
                    <span>Akkaunt</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-item-help">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    <span>Yordam</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowPasswordDialog(true)} data-testid="menu-item-admin">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Boshqa</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-primary/10 hover:ring-primary/30 transition-all" data-testid="button-user-menu">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.profileImageUrl ?? undefined} alt={user?.firstName || "User"} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user?.firstName?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem data-testid="menu-item-profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => logout()} data-testid="button-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Chiqish</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild className="rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300" data-testid="button-login">
                  <a href="/api/login">
                    Kirish
                  </a>
                </Button>
              )}

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Menyu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[350px]">
                  <SheetHeader className="border-b pb-4 mb-4">
                    <SheetTitle className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-blue-600 text-white">
                        <Send className="h-4 w-4" />
                      </div>
                      TeleMarket
                    </SheetTitle>
                  </SheetHeader>
                  
                  <nav className="flex flex-col gap-1">
                    <Link 
                      href="/" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover-elevate ${location === "/" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    >
                      <Home className="h-4 w-4" />
                      Botlar
                    </Link>
                    <Link 
                      href="#" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover-elevate"
                    >
                      <Grid className="h-4 w-4" />
                      Kategoriyalar
                    </Link>
                    <Link 
                      href="#" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover-elevate"
                    >
                      <BookOpen className="h-4 w-4" />
                      Foydali
                    </Link>
                  </nav>

                  <div className="mt-6 pt-6 border-t">
                    {isAuthenticated ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user?.profileImageUrl ?? undefined} alt={user?.firstName || "User"} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {user?.firstName?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start gap-2" 
                          onClick={() => { logout(); setMobileMenuOpen(false); }}
                          data-testid="button-mobile-logout"
                        >
                          <LogOut className="h-4 w-4" />
                          Chiqish
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        asChild 
                        className="w-full rounded-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                        data-testid="button-mobile-login"
                      >
                        <a href="/api/login" onClick={() => setMobileMenuOpen(false)}>
                          <User className="h-4 w-4 mr-2" />
                          Kirish
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <p className="px-2 text-xs text-muted-foreground mb-2">Boshqa</p>
                    <button 
                      onClick={() => { setMobileMenuOpen(false); setShowPasswordDialog(true); }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover-elevate w-full"
                      data-testid="button-mobile-admin"
                    >
                      <Settings className="h-4 w-4" />
                      Admin Panel
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Admin Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Panel</DialogTitle>
            <DialogDescription>
              Admin paneliga kirish uchun parolni kiriting.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Input
              type="password"
              placeholder="Parolni kiriting..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdminAccess()}
              data-testid="input-admin-password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} data-testid="button-cancel-admin">
              Bekor qilish
            </Button>
            <Button onClick={handleAdminAccess} data-testid="button-submit-admin">
              Kirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
