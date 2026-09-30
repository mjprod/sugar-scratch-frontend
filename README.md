# Sugar Scratch Frontend

Guest-first collectible / scratch-card web app (v8 product behavior), structured as a Vite + React 19 + TypeScript + Tailwind app.

## Quick start

From the monorepo root, keep the API + media host running:

```bash
npm run dev:all   # FastAPI :8090 + root Vite media :5080
```

Then in this folder:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `https://localhost:5173`). HTTPS is required for DeviceOrientation / compass.

### Trusted HTTPS (mkcert) — recommended for phones

```bash
brew install mkcert          # once
mkcert -install              # once — trust CA on this Mac (needs sudo)
npm run certs                # writes .certs/dev-*.pem for localhost + LAN IPs
npm run dev
```

Vite loads `.certs/dev-cert.pem` + `.certs/dev-key.pem` when present; otherwise it falls back to `@vitejs/plugin-basic-ssl` (browser warning).

**Phone (one-time CA install):** AirDrop / copy `.certs/rootCA.pem` to the device, install the profile, then enable full trust (iOS: Settings → General → About → Certificate Trust Settings). Re-run `npm run certs` if your Wi‑Fi IP changes. Phone URL: `https://<lan-ip>:5173`.

## API + media proxies

Browser calls stay same-origin (`/api/...`, `/models/...`). Vite proxies them:

| Path | Env | Default |
|------|-----|---------|
| `/api` | `VITE_API_PROXY` | `http://127.0.0.1:8090` |
| `/models/`, `/cards/`, `/photo-scratch/`, … | `VITE_MEDIA_PROXY` | `https://localhost:5080` |

Media prefixes are proxied **with a trailing slash** on purpose. Vite matches by string prefix, and some of them (e.g. `/photo-scratch`) are also SPA routes here. Without the slash, a reload on such a page is served by the operator app instead. For the same reason, don't put static assets under a path starting with a proxied prefix (see `scratchSound.ts`).

Copy `.env.example` → `.env` and restart Vite after changes. Optional `VITE_API_BASE_URL` prefixes absolute API URLs in production builds; leave empty in local dev.

Live catalog HTTP goes through `src/lib/api.ts` (`apiFetch`).

### Live vs mock

| Surface | Status |
|---------|--------|
| `/api/models`, `/api/collection`, `/api/cards`, `/api/me/wallet`, `/api/auth/*` | Live (FastAPI, cookie session) |
| Pack purchase, store products/purchases, inbox | Live; **fail closed** (empty + error) if the API is down |
| Homepage featured / leaderboard, store fixture catalog, inbox fixtures | Only with `?demo=1` |
| Following list | `localStorage` until a follow API exists (no auto-seed unless `?demo=1`) |
| Google / Apple OAuth | Disabled unless `VITE_STUB_OAUTH=1` **and** `ALLOW_STUB_OAUTH=1` |

Guests see **0 coins / 0 diamonds** until login. Session comes from `GET /api/auth/session`, not `sessionStorage` alone.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server (HTTPS) |
| `npm run certs` | Regenerate `.certs/` with mkcert (localhost + LAN IPs) |
| `npm run test` | **Pre-PR gate:** typecheck + all self-checks + build |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run self-check` | Offline invariant checks (`*.self-check.ts`) |
| `npm run lint:ui` | aura-lint against theme tokens |
| `npm run perf:audit` / `perf:runtime` | Lighthouse / headless runtime perf pass (see below) |

## Before you open a PR

Run `npm run test`. It needs no API, Postgres or browser. If a self-check fails, it names the rule you broke; fix the product code rather than weakening the check.

If you touched login, purchase, onboarding or pack inventory, also do a phone smoke test over HTTPS (`npm run certs && npm run dev`, then `https://<lan-ip>:5173`):

1. Browse as a guest (Home / Discover).
2. Tap **Buy** on a pack → the auth sheet appears (not a full-page login).
3. Sign in or create an account → complete the purchase.
4. Scratch at least one card in the pack.

## Structure

Scratch engine (`meshGeometry.ts`, `glRenderer.ts`) lives under `src/features/game/scratch/`, vendored from the operator monorepo so this repo runs standalone. Don't edit those two files here: change them in `sugar_scratchie/src/`, then run from the monorepo root:

```bash
scripts/sync-player-scratch-shared.sh
```

Game *flow* logic (session, outcomes, hints, perf policies) lives in `src/features/game/modules/` and is covered by self-checks.

```
src/
  pages/        # Thin route screens (wire contexts only)
  components/   # Presentational UI + screen bodies
  contexts/     # Auth + wallet
  hooks/        # useRequireAuth, useHomeFeed, useTabNav
  services/     # Domain services (live models + local mocks)
  shared/backend/  # Catalog mappers over live /api/*
  lib/          # apiFetch, session, validation, photos
  routes/       # React Router + auth gates
  types/        # Shared domain types
```

## Product rules (do not break)

- Guests can browse Home + Browse.
- Like / Buy / Collection / Rewards / Profile open the **auth sheet** (no middle “please log in” page).
- After login, **only** `evaluateRecommendationEligibility` may open Tinder personalization.
- Buy path never inserts personalization.

## Measuring performance

- **On-device HUD:** add `?perf=1` to any route (persists; `?perf=0` turns it off). It shows FPS, frame p50/p95/p99, long frames, heap (Chromium) and DOM/canvas/video counts. In the console: `__sugarPerf.snapshot()` / `__sugarPerf.reset()`. Measure against `npm run build && npm run preview`, not dev.
- **Whole-app pass:** `npm run build && npx vite preview --port 4174 --strictPort`, then `npm run perf:audit` (Lighthouse mobile per route → `.perf/summary.json`) and `npm run perf:runtime` (headless Chrome, phone viewport, 4× CPU → `.perf/runtime.json`). Set `PERF_COOKIE="sugar_session=…"` to include signed-in routes. Runtime uses the desktop GPU, so confirm WebGL/video costs on a phone.
- Targets for `/game` on a phone: frame p99 ≤ ~16–32 ms, `readPixels` ~0/s when idle, full GC pauses well under 100 ms.

## Notes

- Pack art under `public/images/packs/` is SVG placeholders until real assets arrive.
