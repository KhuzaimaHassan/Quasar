"use client";

import { Check, ChevronDown, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { MODEL_CATALOG, Provider } from "@/lib/models";
import { useUpdateConversation } from "@/lib/queries/conversations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ModelSwitcherProps {
  conversationId: string;
  currentModel?: string;
  availableProviders: Provider[];
}

export function ModelSwitcher({
  conversationId,
  currentModel,
  availableProviders,
}: ModelSwitcherProps) {
  const router = useRouter();
  const { mutate: updateConversation } = useUpdateConversation();

  const selectedModel =
    MODEL_CATALOG.find((m) => m.id === (currentModel || "gemini-3.5-flash")) ||
    MODEL_CATALOG[0];

  const handleSelect = (modelId: string, isLocked: boolean) => {
    if (isLocked) {
      router.push("/settings");
      return;
    }
    updateConversation({ id: conversationId, data: { model: modelId } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 font-normal">
          {selectedModel.label}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {MODEL_CATALOG.map((model) => {
          const isLocked = model.requiresKey && !availableProviders.includes(model.provider);
          const isSelected = model.id === selectedModel.id;

          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => handleSelect(model.id, isLocked)}
              className="flex items-center justify-between py-2 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className={isLocked ? "text-muted-foreground" : ""}>
                  {model.label}
                </span>
                {isSelected && !isLocked && <Check className="h-4 w-4" />}
              </div>
              {isLocked && (
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>Add Key</span>
                </div>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
