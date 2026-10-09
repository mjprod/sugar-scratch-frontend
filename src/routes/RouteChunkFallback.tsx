import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PreLoaderVisual } from "@/components/PreLoaderVisual";
import { ChunkErrorBoundary } from "@/components/ui/ChunkErrorBoundary";

/** Shown while a lazy route chunk downloads. */
export function RouteChunkFallback() {
  return <PreLoaderVisual />;
}

/** Shown when a lazy route chunk failed to download; only a reload can retry it. */
export function RouteLoadError() {
  return (
    <div
      role="alert"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center"
    >
      <p className="text-[15px] text-white/75">
        This page didn&apos;t load. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-white/15 active:scale-95"
      >
        Reload
      </button>
    </div>
  );
}

/** Route-level chunk error boundary; navigating elsewhere clears it. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ChunkErrorBoundary resetKey={pathname} fallback={<RouteLoadError />}>
      {children}
    </ChunkErrorBoundary>
  );
}
