import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setWasmUrl } from "@lottiefiles/dotlottie-react";
import App from "./App";
import "./index.css";

// Self-hosted (see scripts/copy-dotlottie-wasm.mjs) so swipe Lotties
// never depend on cdn.jsdelivr.net.
setWasmUrl(new URL("/wasm/dotlottie-player.wasm", window.location.origin).href);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
