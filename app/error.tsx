"use client";

import { useEffect } from "react";
import {
  isRecoverableClientStalenessFailure,
  maybeRecoverFromClientStalenessFailure,
} from "./components/ChunkLoadRecovery";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const recovered = maybeRecoverFromClientStalenessFailure(error, {
        storage: window.sessionStorage,
        reload: () => window.location.reload(),
      });
      if (recovered) return;
    }
    console.error("[RootError] Uncaught application error:", error);
  }, [error]);

  const isStale = isRecoverableClientStalenessFailure(error);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {isStale ? "Update available" : "Something went wrong"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isStale
            ? "A new version of the app has been deployed. Please reload the page to continue."
            : error.message ||
              "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Reload Page
          </button>
          {!isStale && (
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
