"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to the console (and any future error monitoring service)
    console.error("[GlobalError boundary]", error);
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-5 text-center max-w-md">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            An unexpected error occurred. If this keeps happening, try refreshing the page or
            clearing your browser cache.
          </p>
          {error?.digest && (
            <p className="text-[11px] text-muted-foreground/60 font-mono mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={reset}
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/")}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
