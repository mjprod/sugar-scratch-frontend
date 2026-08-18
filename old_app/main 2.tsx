import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import V8App from "./src/v8/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <V8App />
  </StrictMode>,
);
