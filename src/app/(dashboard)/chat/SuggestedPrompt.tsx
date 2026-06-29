import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuggestedPromptProps {
  prompt: string;
}

export function SuggestedPrompt({ prompt }: SuggestedPromptProps) {
  return (
    <Button 
      variant="outline" 
      className="group justify-between h-auto py-3 px-4 text-left font-normal text-sm hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Suggest prompt: ${prompt}`}
    >
      <span className="truncate pr-4 leading-relaxed">{prompt}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
    </Button>
  );
}
