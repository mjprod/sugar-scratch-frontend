import { PreLoaderVisual } from "@/components/PreLoaderVisual";

/** Shown while a lazy route chunk downloads. */
export function RouteChunkFallback() {
  return <PreLoaderVisual />;
}
