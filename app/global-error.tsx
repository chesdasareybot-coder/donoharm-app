"use client";

import { useEffect } from "react";
import {
  isRecoverableClientStalenessFailure,
  maybeRecoverFromClientStalenessFailure,
} from "./components/ChunkLoadRecovery";

export default function GlobalError({
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
    console.error("[GlobalError] Fatal application error:", error);
  }, [error]);

  const isStale = isRecoverableClientStalenessFailure(error);

  return (
    <html lang="en">
      <body className="flex h-screen w-full flex-col items-center justify-center bg-black text-white px-4 text-center font-sans">
        <div className="max-w-md space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            {isStale ? "Update available" : "Something went wrong"}
          </h2>
          <p className="text-sm text-zinc-400">
            {isStale
              ? "A new version of the app has been deployed. Please reload the page."
              : error.message ||
                "A critical error occurred. Please reload the application."}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-white text-black px-4 py-2 text-sm font-medium shadow hover:bg-zinc-200 transition-colors"
            >
              Reload Page
            </button>
            {!isStale && (
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
