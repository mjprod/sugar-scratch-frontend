/**
 * ChunkErrorBoundary state transitions.
 * Run: npx tsx src/components/ui/chunkErrorBoundary.self-check.ts
 */
import { ChunkErrorBoundary } from "./ChunkErrorBoundary.tsx";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const props = (resetKey: unknown) => ({ children: null, fallback: null, resetKey });

// A failed chunk flips to the fallback.
assert(
  ChunkErrorBoundary.getDerivedStateFromError().failed === true,
  "error switches to the fallback",
);

// Same key keeps the failure (React.lazy would rethrow the cached rejection).
assert(
  ChunkErrorBoundary.getDerivedStateFromProps(props("/discover"), {
    failed: true,
    resetKey: "/discover",
  }) === null,
  "unchanged resetKey keeps the fallback",
);

// Navigating elsewhere clears it so other routes still render.
{
  const next = ChunkErrorBoundary.getDerivedStateFromProps(props("/rank"), {
    failed: true,
    resetKey: "/discover",
  });
  assert(next?.failed === false, "new resetKey clears the failure");
  assert(next?.resetKey === "/rank", "new resetKey is tracked");
}

// No resetKey (decorative fallbacks) never resets on its own.
assert(
  ChunkErrorBoundary.getDerivedStateFromProps(props(undefined), {
    failed: true,
    resetKey: undefined,
  }) === null,
  "boundaries without a resetKey stay on the fallback",
);

console.log("chunkErrorBoundary self-check OK");
