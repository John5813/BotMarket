import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl border-border/50">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 text-destructive items-center justify-center">
            <AlertCircle className="h-12 w-12" />
          </div>
          
          <h1 className="text-3xl font-bold text-center mb-2 font-display">404</h1>
          <p className="text-center text-muted-foreground mb-8">
            Sahifa topilmadi
          </p>

          <Link href="/">
            <Button className="w-full bg-primary hover:bg-primary/90 rounded-xl h-12 text-base font-medium">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Bosh sahifaga qaytish
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
