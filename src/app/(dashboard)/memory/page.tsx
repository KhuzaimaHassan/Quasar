"use client";

import { useState } from "react";
import { Brain, Plus, Trash2, Edit2, Check, X, Loader2 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMemories, useCreateMemory, useUpdateMemory, useDeleteMemory, useClearMemories } from "@/lib/queries/memory";
import { Memory } from "@prisma/client";

function MemoryRow({ memory }: { memory: Memory }) {
  const { mutate: updateMemory, isPending: isUpdating } = useUpdateMemory();
  const { mutate: deleteMemory, isPending: isDeleting } = useDeleteMemory();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(memory.value);

  const handleSave = () => {
    if (editValue !== memory.value) {
      updateMemory({ id: memory.id, data: { value: editValue } }, {
        onSuccess: () => setIsEditing(false)
      });
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-start justify-between py-3 px-4 border-b last:border-0 group">
      <div className="flex flex-col gap-1 w-full mr-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{memory.key}</span>
        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <Input 
              value={editValue} 
              onChange={(e) => setEditValue(e.target.value)} 
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => { setIsEditing(false); setEditValue(memory.value); }} disabled={isUpdating}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group-hover:bg-muted/50 p-1 -ml-1 rounded cursor-pointer transition-colors" onClick={() => setIsEditing(true)}>
            <span className="text-sm font-medium">{memory.value}</span>
            <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        )}
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-2" 
        onClick={() => deleteMemory(memory.id)}
        disabled={isDeleting || isEditing}
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function AddMemoryForm() {
  const { mutate: createMemory, isPending } = useCreateMemory();
  const [scope, setScope] = useState<"preference" | "project" | "style" | "fact">("preference");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;
    createMemory({ scope, key: key.trim(), value: value.trim() }, {
      onSuccess: () => {
        setKey("");
        setValue("");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-muted/30 rounded-lg border">
      <div className="flex flex-col w-full sm:w-[150px] gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Scope</span>
        <Select value={scope} onValueChange={(v: any) => setScope(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="preference">Preference</SelectItem>
            <SelectItem value="project">Project</SelectItem>
            <SelectItem value="style">Style</SelectItem>
            <SelectItem value="fact">Fact</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col w-full sm:w-[200px] gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Key</span>
        <Input placeholder="e.g. language" value={key} onChange={(e) => setKey(e.target.value)} />
      </div>
      <div className="flex flex-col w-full flex-1 gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Value</span>
        <Input placeholder="e.g. TypeScript" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button type="submit" disabled={isPending || !key.trim() || !value.trim()} className="w-full sm:w-auto mt-auto mb-[2px]">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
        Add manually
      </Button>
    </form>
  );
}

function MemorySection({ title, description, memories }: { title: string, description: string, memories: Memory[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="border rounded-lg bg-card flex flex-col">
        {memories.length === 0 ? (
          <EmptyState 
            icon={Brain}
            title="Nothing stored yet"
            description={`No ${title.toLowerCase()} have been added or extracted.`}
          />
        ) : (
          <div className="flex flex-col">
            {memories.map(m => <MemoryRow key={m.id} memory={m} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MemoryPage() {
  const { data: memories, isLoading } = useMemories();
  const { mutate: clearMemories, isPending: isClearing } = useClearMemories();
  const [showClearDialog, setShowClearDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const prefs = memories?.filter(m => m.scope === 'preference') || [];
  const projects = memories?.filter(m => m.scope === 'project') || [];
  const styles = memories?.filter(m => m.scope === 'style') || [];
  const facts = memories?.filter(m => m.scope === 'fact') || [];

  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8 overflow-y-auto">
      <PageHeader 
        title="Memory" 
        description="Manage what Quasar remembers about your preferences, projects, styles, and facts."
        icon={Brain}
        action={
          <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={!memories?.length || isClearing}>
                {isClearing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Clear all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all extracted and manual memories. Quasar will forget your preferences, projects, styles, and facts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    clearMemories(undefined, {
                      onSuccess: () => setShowClearDialog(false)
                    });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      <div className="flex flex-col gap-8 pb-10">
        <AddMemoryForm />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <MemorySection 
            title="Preferences" 
            description="Things you like or dislike"
            memories={prefs} 
          />
          <MemorySection 
            title="Projects" 
            description="Details about what you are building"
            memories={projects} 
          />
          <MemorySection 
            title="Style" 
            description="How you like the AI to respond"
            memories={styles} 
          />
          <MemorySection 
            title="Facts" 
            description="General objective information about you"
            memories={facts} 
          />
        </div>
      </div>
    </div>
  );
}
