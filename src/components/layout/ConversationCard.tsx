import { Paperclip, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface ConversationCardProps {
  title: string;
  preview?: string;
  time: string;
  model: string;
  files: number;
  isActive: boolean;
  onRename?: (newTitle: string) => void;
}

export function ConversationCard({ title, preview, time, model, files, isActive, onRename }: ConversationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (editValue.trim() !== "" && editValue !== title) {
      onRename?.(editValue.trim());
    } else {
      setEditValue(title); // revert
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
      setEditValue(title);
    }
  };

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
      <div className="flex items-start justify-between w-full gap-2 group/header">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="h-6 text-sm px-1 py-0"
          />
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <h3 
              className="font-semibold text-sm truncate text-foreground"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="Double-click to rename"
            >
              {title}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="opacity-0 group-hover/header:opacity-100 hover:text-foreground text-muted-foreground transition-opacity p-0.5 rounded"
              title="Rename conversation"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <span className="text-xs whitespace-nowrap opacity-70 mt-0.5 shrink-0">
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
