import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConversationCardProps {
  title: string;
  preview?: string;
  time: string;
  model: string;
  files: number;
  isActive: boolean;
}

export function ConversationCard({ title, preview, time, model, files, isActive }: ConversationCardProps) {
  return (
    <article
      tabIndex={0}
      className={cn(
        "w-full flex flex-col gap-2 p-3 rounded-lg text-left transition-colors group cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive 
          ? "bg-accent text-accent-foreground border-border/50" 
          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="flex items-start justify-between w-full gap-2">
        <h3 className="font-semibold text-sm truncate flex-1 text-foreground">
          {title}
        </h3>
        <span className="text-xs whitespace-nowrap opacity-70 mt-0.5">
          {time}
        </span>
      </div>
      
      {preview && (
        <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
          {preview}
        </p>
      )}
      
      <div className="flex items-center gap-2 mt-1">
        <Badge 
          variant="secondary" 
          className="text-[10px] h-4 px-1.5 font-medium rounded-sm border-none bg-muted-foreground/10 text-muted-foreground group-hover:text-foreground group-hover:bg-muted-foreground/20 transition-colors"
        >
          {model}
        </Badge>
        {files > 0 && (
          <div className="flex items-center gap-1 text-xs opacity-70">
            <Paperclip className="h-3 w-3" />
            <span>{files}</span>
          </div>
        )}
      </div>
    </article>
  );
}
