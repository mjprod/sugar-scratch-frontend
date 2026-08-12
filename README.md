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

Open the URL Vite prints (usually `http://localhost:5173`).

## API + media proxies

Browser calls stay same-origin (`/api/...`, `/models/...`). Vite proxies them:

| Path | Env | Default |
|------|-----|---------|
| `/api` | `VITE_API_PROXY` | `http://127.0.0.1:8090` |
| `/models`, `/cards`, `/photo-scratch`, … | `VITE_MEDIA_PROXY` | `https://localhost:5080` |

Copy `.env.example` → `.env` and restart Vite after changes. Optional `VITE_API_BASE_URL` prefixes absolute API URLs in production builds; leave empty in local dev.

Live catalog HTTP goes through `src/lib/api.ts` (`apiFetch`).

### Live vs mock

| Surface | Status |
|---------|--------|
| `/api/models`, `/api/collection`, `/api/cards`, `/api/video-flow` | Live (FastAPI) |
| Auth, purchase, homepage featured, store | Local mock (`sessionStorage` / `localStorage`) |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run self-check` | Auth + recommendation invariant checks |
| `npm run lint:ui` | aura-lint against theme tokens |

## Structure

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

See `old_app/src/v8/CHEATSHEET.md` for the full rules. `old_app/` is the junior prototype kept as reference.

## Notes

- Pack art under `public/images/packs/` is SVG placeholders until real assets arrive.
