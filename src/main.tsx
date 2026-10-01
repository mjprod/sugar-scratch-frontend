import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setWasmUrl } from "@lottiefiles/dotlottie-react";
import App from "./App";
import { resolvePerfHudEnabled } from "./lib/perf/perfStats";
import "./index.css";

// Self-hosted (see scripts/copy-dotlottie-wasm.mjs) so swipe Lotties
// never depend on cdn.jsdelivr.net. This also covers direct
// @lottiefiles/dotlottie-web imports only while package.json pins the same
// dotlottie-web version dotlottie-react depends on (one deduped copy).
setWasmUrl(new URL("/wasm/dotlottie-player.wasm", window.location.origin).href);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

let perfStore: Storage | null = null;
try {
  perfStore = window.localStorage;
} catch {
  /* private mode / storage blocked */
}
if (resolvePerfHudEnabled(window.location.search, perfStore)) {
  void import("./lib/perf/perfHud").then((m) => m.mountPerfHud());
}
