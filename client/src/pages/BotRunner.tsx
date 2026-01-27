import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Play, Square, Bot, Key, User } from "lucide-react";
import type { Bot as BotType } from "@shared/schema";

export default function BotRunner() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [telegramToken, setTelegramToken] = useState("");
  const [adminTelegramId, setAdminTelegramId] = useState("");
  const [instanceId, setInstanceId] = useState<number | null>(null);
  const [botStatus, setBotStatus] = useState<"stopped" | "running">("stopped");

  const { data: bot, isLoading } = useQuery<BotType>({
    queryKey: ["/api/bots", id],
    enabled: !!id,
  });

  const createInstanceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bot-instances", {
        botId: Number(id),
        telegramToken,
        adminTelegramId: adminTelegramId || null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setInstanceId(data.id);
      toast({ title: "Tayyor", description: "Bot instance yaratildi. Endi ishga tushirishingiz mumkin." });
    },
    onError: () => {
      toast({ title: "Xatolik", description: "Bot instance yaratishda xatolik.", variant: "destructive" });
    },
  });

  const startBotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bot-instances/${instanceId}/start`);
      return res.json();
    },
    onSuccess: (data) => {
      setBotStatus("running");
      toast({ title: "Bot ishlamoqda", description: data.message });
    },
    onError: () => {
      toast({ title: "Xatolik", description: "Botni ishga tushirishda xatolik.", variant: "destructive" });
    },
  });

  const stopBotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bot-instances/${instanceId}/stop`);
      return res.json();
    },
    onSuccess: (data) => {
      setBotStatus("stopped");
      toast({ title: "Bot to'xtatildi", description: data.message });
    },
    onError: () => {
      toast({ title: "Xatolik", description: "Botni to'xtatishda xatolik.", variant: "destructive" });
    },
  });

  const handleSetup = () => {
    if (!telegramToken.trim()) {
      toast({ title: "Xatolik", description: "Telegram bot tokenini kiriting.", variant: "destructive" });
      return;
    }
    createInstanceMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Bot topilmadi</h1>
          <Link href="/">
            <Button>Bosh sahifaga qaytish</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <Link href={`/bot/${id}`}>
          <Button variant="ghost" className="mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Orqaga
          </Button>
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Bot Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <img
                  src={bot.imageUrl}
                  alt={bot.name}
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    {bot.name}
                  </CardTitle>
                  <CardDescription>{bot.category}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{bot.description}</p>
              {bot.features && (
                <div className="flex flex-wrap gap-2">
                  {bot.features.split(',').map((feature, index) => (
                    <Badge key={index} variant="secondary">{feature.trim()}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Setup Form */}
          <Card>
            <CardHeader>
              <CardTitle>Botni ishlatib ko'rish</CardTitle>
              <CardDescription>
                O'z Telegram bot tokeningizni kiriting va botni test qiling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!instanceId ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="token" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Telegram Bot Token
                    </Label>
                    <Input
                      id="token"
                      type="password"
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz..."
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      data-testid="input-telegram-token"
                    />
                    <p className="text-xs text-muted-foreground">
                      @BotFather dan olingan tokenni kiriting
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminId" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Admin Telegram ID (ixtiyoriy)
                    </Label>
                    <Input
                      id="adminId"
                      placeholder="123456789"
                      value={adminTelegramId}
                      onChange={(e) => setAdminTelegramId(e.target.value)}
                      data-testid="input-admin-id"
                    />
                    <p className="text-xs text-muted-foreground">
                      Admin funksiyalaridan foydalanish uchun o'z Telegram ID ni kiriting
                    </p>
                  </div>

                  <Button
                    onClick={handleSetup}
                    className="w-full"
                    disabled={createInstanceMutation.isPending}
                    data-testid="button-setup-bot"
                  >
                    {createInstanceMutation.isPending ? "Tayyorlanmoqda..." : "Tayyorlash"}
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${botStatus === "running" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                      <span className="font-medium">
                        {botStatus === "running" ? "Bot ishlamoqda" : "Bot to'xtatilgan"}
                      </span>
                    </div>
                    <Badge variant={botStatus === "running" ? "default" : "secondary"}>
                      {botStatus === "running" ? "Faol" : "To'xtatilgan"}
                    </Badge>
                  </div>

                  {botStatus === "stopped" ? (
                    <Button
                      onClick={() => startBotMutation.mutate()}
                      className="w-full"
                      disabled={startBotMutation.isPending}
                      data-testid="button-start-bot"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {startBotMutation.isPending ? "Ishga tushirilmoqda..." : "Ishga tushirish"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => stopBotMutation.mutate()}
                      variant="destructive"
                      className="w-full"
                      disabled={stopBotMutation.isPending}
                      data-testid="button-stop-bot"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      {stopBotMutation.isPending ? "To'xtatilmoqda..." : "To'xtatish"}
                    </Button>
                  )}

                  {botStatus === "running" && (
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Bot muvaffaqiyatli ishga tushirildi! Endi Telegramda botingizga /start yozing va uni sinab ko'ring.
                      </p>
                    </div>
                  )}
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
