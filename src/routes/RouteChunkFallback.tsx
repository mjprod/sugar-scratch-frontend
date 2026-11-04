import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PreLoaderVisual } from "@/components/PreLoaderVisual";
import { ChunkErrorBoundary } from "@/components/ui/ChunkErrorBoundary";

/** Shown while a lazy route chunk downloads. */
export function RouteChunkFallback() {
  return <PreLoaderVisual />;
}

const EMPTY_PACK_ART = "/images/packs/imageEmptyPack";

function EmptyPackArt() {
  return (
    <picture>
      <source
        type="image/jxl"
        srcSet={`${EMPTY_PACK_ART}@1x.jxl 1x, ${EMPTY_PACK_ART}@2x.jxl 2x`}
      />
      <source
        type="image/webp"
        srcSet={`${EMPTY_PACK_ART}@1x.webp 1x, ${EMPTY_PACK_ART}@2x.webp 2x`}
      />
      <img
        className="cart-empty-pack-art"
        src={`${EMPTY_PACK_ART}@1x.png`}
        srcSet={`${EMPTY_PACK_ART}@1x.png 1x, ${EMPTY_PACK_ART}@2x.png 2x`}
        alt=""
        width={355}
        height={532}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}

/** Shown when a lazy route chunk failed to download; only a reload can retry it. */
export function RouteLoadError() {
  return (
    <div
      role="alert"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center"
    >
      <EmptyPackArt />
      <p className="text-body text-white/75">
        This page didn&apos;t load. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-body font-medium text-white transition hover:bg-white/15 active:scale-95"
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
