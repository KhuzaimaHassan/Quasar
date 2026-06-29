import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function QuickActionCard({ title, description, icon: Icon }: QuickActionCardProps) {
  return (
    <Card 
      tabIndex={0}
      className="hover:border-primary/50 hover:bg-accent/30 hover:shadow-sm transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="button"
      aria-label={`Action: ${title}`}
    >
      <CardContent className="p-5 flex flex-col items-start h-full">
        <div className="rounded-lg bg-muted p-2 mb-4 inline-flex group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <Icon className="h-8 w-8" />
        </div>
        <div className="mt-auto">
          <h3 className="font-semibold text-sm mb-1">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
