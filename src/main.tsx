import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { resolvePerfHudEnabled } from "./lib/perf/perfStats";
import "./index.css";

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
