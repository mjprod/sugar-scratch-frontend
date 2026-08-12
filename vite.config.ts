import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function readProxyTarget(
  env: Record<string, string>,
  key: "VITE_API_PROXY" | "VITE_MEDIA_PROXY",
) {
  return (env[key] || process.env[key] || "").trim().replace(/\/+$/, "");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const apiTarget =
    readProxyTarget(env, "VITE_API_PROXY") || "http://127.0.0.1:8090";
  const mediaTarget =
    readProxyTarget(env, "VITE_MEDIA_PROXY") || "https://localhost:5080";

  function proxyTo(target: string) {
    const isHttps = target.startsWith("https://");
    const isDevOrigin =
      /localhost|127\.0\.0\.1/i.test(target) ||
      /https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i.test(target);
    // Free ngrok serves an HTML interstitial to browser UAs unless this header is set.
    const isNgrok = /\.ngrok(?:-free)?\.(?:dev|app|io)\b/i.test(target);
    return {
      target,
      changeOrigin: true,
      secure: isHttps ? !isDevOrigin : true,
      ...(isNgrok
        ? { headers: { "ngrok-skip-browser-warning": "true" } }
        : {}),
    };
  }

  console.info(`[vite] proxy /api → ${apiTarget}`);
  console.info(`[vite] proxy media → ${mediaTarget}`);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": proxyTo(apiTarget),
        ...Object.fromEntries(
          [
            "/cards",
            "/models",
            "/photo-scratch",
            "/mesh",
            "/lotties",
            "/symbols",
            "/sounds",
            "/themes",
            "/scratch",
            "/cursor-fx",
          ].map((route) => [route, proxyTo(mediaTarget)]),
        ),
      },
    },
  };
});
