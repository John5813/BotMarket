import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Bot } from "lucide-react";
import type { Bot as BotType } from "@shared/schema";

export default function Admin() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    demoUrl: "",
    category: "",
    username: "",
    features: "",
  });

  const { data: bots = [], isLoading } = useQuery<BotType[]>({
    queryKey: ["/api/bots"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/bots", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
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
      });
    },
    onError: () => {
      toast({ title: "Xatolik", description: "Bot qo'shishda xatolik yuz berdi.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description || !formData.price || !formData.imageUrl || !formData.demoUrl || !formData.category || !formData.username) {
      toast({ title: "Xatolik", description: "Barcha maydonlarni to'ldiring.", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Narxi</Label>
                    <Input
                      id="price"
                      placeholder="Masalan: Bepul yoki 50 000 so'm"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      data-testid="input-bot-price"
                    />
                  </div>

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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Telegram username</Label>
                  <Input
                    id="username"
                    placeholder="@ belgisiz, masalan: tarjimonbot"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    data-testid="input-bot-username"
                  />
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
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
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
                        <p className="font-medium truncate">{bot.name}</p>
                        <p className="text-sm text-muted-foreground">{bot.price} - {bot.category}</p>
                      </div>
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
