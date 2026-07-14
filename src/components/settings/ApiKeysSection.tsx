"use client";

import { useState } from "react";
import { Key, Trash, Save, Loader2 } from "lucide-react";
import { useApiKeys, useAddApiKey, useRemoveApiKey } from "@/lib/queries/api-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "Requires an active billing account with Anthropic. Claude 3.5 Sonnet is a premium model.",
  },
  {
    id: "openai",
    name: "OpenAI (GPT-4)",
    description: "Requires an active billing account with OpenAI.",
  },
];

export function ApiKeysSection() {
  const { data: apiKeys, isLoading } = useApiKeys();
  const { mutate: addApiKey, isPending: isAdding } = useAddApiKey();
  const { mutate: removeApiKey, isPending: isRemoving } = useRemoveApiKey();

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const handleSave = (provider: string) => {
    const key = inputs[provider];
    if (!key) return;
    
    setActiveProvider(provider);
    addApiKey({ provider, apiKey: key }, {
      onSuccess: () => {
        setInputs((prev) => ({ ...prev, [provider]: "" }));
        setActiveProvider(null);
      },
      onError: () => {
        setActiveProvider(null);
      }
    });
  };

  const handleRemove = (provider: string) => {
    setActiveProvider(provider);
    removeApiKey(provider, {
      onSuccess: () => {
        setActiveProvider(null);
      },
      onError: () => {
        setActiveProvider(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading API keys...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" /> Bring Your Own Key (BYOK)
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Store your own API keys to unlock premium models. Keys are encrypted at rest using AES-256-GCM.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const existingKey = apiKeys?.find((k) => k.provider === provider.id);
          const isProcessing = activeProvider === provider.id && (isAdding || isRemoving);

          return (
            <div key={provider.id} className="p-4 rounded-lg border bg-card/50">
              <div className="mb-3">
                <h4 className="font-medium text-foreground">{provider.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
              </div>

              {existingKey ? (
                <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-md border border-border/50">
                  <div className="flex-1">
                    <p className="text-sm font-mono text-foreground/80">{existingKey.keyPreview}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Added on {new Date(existingKey.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemove(provider.id)}
                    disabled={isProcessing}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4 mr-1.5" />}
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Input
                    type="password"
                    placeholder="Paste your API key here..."
                    className="flex-1 font-mono text-sm"
                    value={inputs[provider.id] || ""}
                    onChange={(e) => setInputs({ ...inputs, [provider.id]: e.target.value })}
                    disabled={isProcessing}
                  />
                  <Button 
                    variant="default"
                    onClick={() => handleSave(provider.id)}
                    disabled={!inputs[provider.id] || isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                    Save
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
