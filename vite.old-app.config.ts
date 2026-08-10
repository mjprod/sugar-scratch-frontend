import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Serves clone `old_app/src/v8` prototype (not the production `src/` app). */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: rootDir,
  publicDir: path.resolve(rootDir, "public"),
  server: {
    port: 5188,
    strictPort: true,
    open: "/old-app.html",
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
});
