import { Bot } from "@shared/schema";
import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShoppingCart, Zap } from "lucide-react";

interface BotCardProps {
  bot: Bot;
}

export function BotCard({ bot }: BotCardProps) {
  return (
    <Card className="group overflow-hidden rounded-2xl border-border/50 bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
      {/* Image Container with Gradient Overlay */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 opacity-60 transition-opacity group-hover:opacity-40" />
        <img
          src={bot.imageUrl}
          alt={bot.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute bottom-3 left-3 z-20">
          <Badge variant="secondary" className="backdrop-blur-md bg-white/20 text-white border-white/20 hover:bg-white/30">
            {bot.category}
          </Badge>
        </div>
      </div>

      <CardHeader className="p-5 pb-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-display text-lg font-bold leading-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {bot.name}
          </h3>
          <span className="shrink-0 text-sm font-bold text-primary px-2 py-1 bg-primary/10 rounded-lg">
            {bot.price}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2 pb-4">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {bot.description}
        </p>
      </CardContent>

      <CardFooter className="p-5 pt-0 flex gap-2">
        <Link href={`/bot/${bot.id}`} className="w-full">
          <Button variant="default" className="w-full rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
            Batafsil
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
