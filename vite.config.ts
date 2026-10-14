import { defineConfig, loadEnv, type Plugin, type ServerOptions } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const certFile = path.resolve(rootDir, ".certs/dev-cert.pem");
const keyFile = path.resolve(rootDir, ".certs/dev-key.pem");

function readProxyTarget(
  env: Record<string, string>,
  key: "VITE_API_PROXY" | "VITE_MEDIA_PROXY",
) {
  return (env[key] || process.env[key] || "").trim().replace(/\/+$/, "");
}

/** Prefer mkcert files from `npm run certs`; fall back to @vitejs/plugin-basic-ssl. */
function loadLocalHttps(): ServerOptions["https"] | null {
  if (!existsSync(certFile) || !existsSync(keyFile)) return null;
  return {
    cert: readFileSync(certFile),
    key: readFileSync(keyFile),
  };
}

/** Dashboard BGM is written under the operator `public/themes` tree. */
function localThemeBgmPlugin(): Plugin {
  const themesDir = path.resolve(rootDir, "../public/themes");
  return {
    name: "local-theme-bgm",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0] ?? "";
        const match = pathname.match(/^\/themes\/([a-z0-9_]+)\/bgm\.mp3$/);
        if (!match) {
          next();
          return;
        }
        const file = path.join(themesDir, match[1] ?? "", "bgm.mp3");
        if (!existsSync(file)) {
          next();
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-cache");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const apiTarget =
    readProxyTarget(env, "VITE_API_PROXY") || "http://127.0.0.1:8090";
  const mediaTarget =
    readProxyTarget(env, "VITE_MEDIA_PROXY") || "https://localhost:5080";
  const localHttps = loadLocalHttps();

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
  console.info(
    localHttps
      ? `[vite] https ← .certs/dev-*.pem (mkcert)`
      : `[vite] https ← basic-ssl (run: npm run certs)`,
  );

  return {
    plugins: [localThemeBgmPlugin(), react(), tailwindcss(), ...(localHttps ? [] : [basicSsl()])],
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
manualChunks(id) {
  const normalized = id.split(path.sep).join("/");
  // Shared runtime pieces must not land in a lazy vendor chunk, or the
  // entry imports that whole chunk (three was preloaded on every page).
  if (
    /\/node_modules\/(react|react-dom|scheduler)\//.test(normalized) ||
    normalized.includes("vite/preload-helper") ||
    normalized.includes("commonjsHelpers")
  ) {
    return "vendor";
  }
  if (
    normalized.includes("/node_modules/three/") ||
    normalized.includes("/node_modules/@react-three/")
  ) {
    return "three";
  }
  if (normalized.includes("/node_modules/@lottiefiles/")) {
    return "lottie";
  }
}
        },
      },
    },
    server: {
      // Default 0.0.0.0 so phones can hit https://<lan-ip>:5173 (mkcert workflow).
      // Override with VITE_DEV_HOST=localhost to bind loopback only.
      host: env.VITE_DEV_HOST || "0.0.0.0",
      port: 5173,
      strictPort: true,
      https: localHttps || undefined,
      fs: {
        allow: [rootDir],
      },
      // Cloudflare quick tunnels rotate hostnames; allow the whole suffix.
      allowedHosts: [".trycloudflare.com", ".local"],
      proxy: {
        // Dashboard uploads live on the local API and :5080, even when the
        // rest of the catalog is proxied to a remote host. This key must stay
        // ahead of "/api" so the themes list is not swallowed by that prefix.
        "/api/themes": proxyTo("http://127.0.0.1:8090"),
        "/api": proxyTo(apiTarget),
        // Trailing slash is load-bearing: Vite matches by string prefix, and
        // "/photo-scratch" is also an SPA route here. Without the slash a reload
        // on /photo-scratch?card=… is served the media origin's operator app.
        ...Object.fromEntries(
          [
            "/cards/",
            "/models/",
            "/photo-scratch/",
            "/mesh/",
            "/lotties/",
            "/symbols/",
            "/sounds/",
            "/themes/",
            "/scratch/",
            "/cursor-fx/",
          ].map((route) => [route, proxyTo(mediaTarget)]),
        ),
      },
    },
    preview: {
      host: env.VITE_DEV_HOST || "0.0.0.0",
      port: 5173,
      https: localHttps || undefined,
    },
  };
});
