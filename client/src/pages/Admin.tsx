import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Bot, Github, RefreshCw, Download, CreditCard, Zap } from "lucide-react";
import type { Bot as BotType } from "@shared/schema";

export default function Admin() {
  const { toast } = useToast();
  const [githubUrl, setGithubUrl] = useState("");
  const [addMethod, setAddMethod] = useState<"github" | "manual">("github");
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    demoUrl: "",
    category: "",
    username: "",
    features: "",
    githubUrl: "",
    pricingType: "monthly",
    pricingTier: "simple",
  });

  const { data: bots = [], isLoading } = useQuery<BotType[]>({
    queryKey: ["/api/bots"],
  });

  const importFromGithubMutation = useMutation({
    mutationFn: async (url: string) => {
      return apiRequest("POST", "/api/bots/import-github", { githubUrl: url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({ title: "Bot yuklandi", description: "GitHub dan bot muvaffaqiyatli yuklandi." });
      setGithubUrl("");
    },
    onError: () => {
      toast({ title: "Xatolik", description: "GitHub dan yuklashda xatolik yuz berdi.", variant: "destructive" });
    },
  });

  const refreshFromGithubMutation = useMutation({
    mutationFn: async (botId: number) => {
      return apiRequest("POST", `/api/bots/${botId}/refresh-github`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({ title: "Yangilandi", description: "Bot GitHub dan yangilandi." });
    },
    onError: () => {
      toast({ title: "Xatolik", description: "Yangilashda xatolik yuz berdi.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const price = getPriceDisplay(data.pricingType, data.pricingTier);
      return apiRequest("POST", "/api/bots", { ...data, price });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({ title: "Bot qo'shildi", description: "Yangi bot muvaffaqiyatli qo'shildi." });
      setFormData({
        name: "",
        description: "",
        price: "",
        imageUrl: "",
        demoUrl: "",
        category: "",
        username: "",
        features: "",
        githubUrl: "",
        pricingType: "monthly",
        pricingTier: "simple",
      });
    },
    onError: () => {
      toast({ title: "Xatolik", description: "Bot qo'shishda xatolik yuz berdi.", variant: "destructive" });
    },
  });

  const getPriceDisplay = (pricingType: string, pricingTier: string) => {
    if (pricingType === "monthly") {
      switch (pricingTier) {
        case "simple": return "30,000 so'm/oy";
        case "medium": return "80,000 so'm/oy";
        case "business": return "150,000 so'm/oy";
        default: return "30,000 so'm/oy";
      }
    } else {
      return "Pay-as-you-go";
    }
  };

  const getMonthlyPrice = (tier: string) => {
    switch (tier) {
      case "simple": return 30000;
      case "medium": return 80000;
      case "business": return 150000;
      default: return 30000;
    }
  };

  const handleGithubImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) {
      toast({ title: "Xatolik", description: "GitHub URL kiriting.", variant: "destructive" });
      return;
    }
    importFromGithubMutation.mutate(githubUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description || !formData.imageUrl || !formData.demoUrl || !formData.category || !formData.username) {
      toast({ title: "Xatolik", description: "Barcha majburiy maydonlarni to'ldiring.", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const getPricingBadge = (bot: BotType) => {
    if (bot.pricingType === "paygo") {
      return <Badge variant="secondary" className="text-xs"><Zap className="h-3 w-3 mr-1" />Pay-as-you-go</Badge>;
    }
    return <Badge variant="outline" className="text-xs"><CreditCard className="h-3 w-3 mr-1" />Oylik</Badge>;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground">Botlarni boshqarish</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Add Bot Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Yangi bot qo'shish
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={addMethod} onValueChange={(v) => setAddMethod(v as "github" | "manual")}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="github" className="gap-2" data-testid="tab-github">
                    <Github className="h-4 w-4" />
                    GitHub dan
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="gap-2" data-testid="tab-manual">
                    <Plus className="h-4 w-4" />
                    Qo'lda
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="github">
                  <form onSubmit={handleGithubImport} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="githubUrl">GitHub Repository URL</Label>
                      <Input
                        id="githubUrl"
                        placeholder="https://github.com/username/bot-repo"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        data-testid="input-github-url"
                      />
                      <p className="text-xs text-muted-foreground">
                        Repository da bot.json fayli bo'lishi kerak
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full gap-2" 
                      disabled={importFromGithubMutation.isPending}
                      data-testid="button-import-github"
                    >
                      {importFromGithubMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Yuklanmoqda...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          GitHub dan yuklash
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="manual">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Bot nomi</Label>
                      <Input
                        id="name"
                        placeholder="Masalan: Tarjimon Bot"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        data-testid="input-bot-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Tavsif</Label>
                      <Textarea
                        id="description"
                        placeholder="Bot haqida qisqacha ma'lumot..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        data-testid="input-bot-description"
                      />
                    </div>

                    {/* Pricing Section */}
                    <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-4">
                      <Label className="text-base font-semibold">To'lov tizimi</Label>
                      
                      <div className="space-y-2">
                        <Label>To'lov turi</Label>
                        <Select 
                          value={formData.pricingType} 
                          onValueChange={(v) => setFormData({ ...formData, pricingType: v })}
                        >
                          <SelectTrigger data-testid="select-pricing-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Oylik to'lov (AI API siz)
                              </div>
                            </SelectItem>
                            <SelectItem value="paygo">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                Pay-as-you-go (AI API bilan)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.pricingType === "monthly" && (
                        <div className="space-y-2">
                          <Label>Tarif</Label>
                          <Select 
                            value={formData.pricingTier} 
                            onValueChange={(v) => setFormData({ ...formData, pricingTier: v })}
                          >
                            <SelectTrigger data-testid="select-pricing-tier">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="simple">Oddiy - 30,000 so'm/oy</SelectItem>
                              <SelectItem value="medium">O'rtacha - 80,000 so'm/oy</SelectItem>
                              <SelectItem value="business">Biznes - 150,000 so'm/oy</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.pricingType === "paygo" && (
                        <div className="text-sm text-muted-foreground space-y-1 bg-background p-3 rounded-md">
                          <p className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            1000 token = 5,000 so'm
                          </p>
                          <p>Oldindan to'lov: kamida 50,000 so'm</p>
                          <p>3 kunlik sinov: 10,000 so'm</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Kategoriya</Label>
                        <Input
                          id="category"
                          placeholder="Masalan: Foydali, Biznes"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          data-testid="input-bot-category"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Telegram username</Label>
                        <Input
                          id="username"
                          placeholder="@ belgisiz"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          data-testid="input-bot-username"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="imageUrl">Rasm URL</Label>
                      <Input
                        id="imageUrl"
                        placeholder="https://example.com/image.jpg"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        data-testid="input-bot-image"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="demoUrl">Demo URL</Label>
                      <Input
                        id="demoUrl"
                        placeholder="https://t.me/botusername"
                        value={formData.demoUrl}
                        onChange={(e) => setFormData({ ...formData, demoUrl: e.target.value })}
                        data-testid="input-bot-demo"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="manualGithubUrl">GitHub URL (ixtiyoriy)</Label>
                      <Input
                        id="manualGithubUrl"
                        placeholder="https://github.com/username/repo"
                        value={formData.githubUrl}
                        onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                        data-testid="input-manual-github"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="features">Xususiyatlar (ixtiyoriy)</Label>
                      <Input
                        id="features"
                        placeholder="Xususiyat 1, Xususiyat 2, ..."
                        value={formData.features}
                        onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                        data-testid="input-bot-features"
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-add-bot">
                      {createMutation.isPending ? "Qo'shilmoqda..." : "Bot qo'shish"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Bot List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Mavjud botlar ({bots.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : bots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Hozircha botlar mavjud emas
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {bots.map((bot) => (
                    <div
                      key={bot.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover-elevate"
                      data-testid={`bot-item-${bot.id}`}
                    >
                      <img
                        src={bot.imageUrl}
                        alt={bot.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{bot.name}</p>
                          {getPricingBadge(bot)}
                        </div>
                        <p className="text-sm text-muted-foreground">{bot.price} - {bot.category}</p>
                        {bot.githubUrl && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                            <Github className="h-3 w-3" />
                            {bot.githubUrl}
                          </p>
                        )}
                      </div>
                      {bot.githubUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => refreshFromGithubMutation.mutate(bot.id)}
                          disabled={refreshFromGithubMutation.isPending}
                          title="GitHub dan yangilash"
                          data-testid={`button-refresh-${bot.id}`}
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshFromGithubMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
