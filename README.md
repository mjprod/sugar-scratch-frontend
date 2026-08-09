# Sugar Scratch Frontend

Guest-first collectible / scratch-card web app (v8 product behavior), structured as a Vite + React 19 + TypeScript + Tailwind app.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

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
  services/     # Mock APIs (swap for HTTP later)
  routes/       # React Router + soft gates
  lib/          # session, validation, photos
  types/        # Shared domain types
```

## Product rules (do not break)

- Guests can browse Home + Browse.
- Like / Buy / Collection / Rewards / Profile open the **auth sheet** (no middle “please log in” page).
- After login, **only** `evaluateRecommendationEligibility` may open Tinder personalization.
- Buy path never inserts personalization.

See `old_app/src/v8/CHEATSHEET.md` for the full rules. `old_app/` is the junior prototype kept as reference.

## Notes

- Data is mocked (`localStorage` / `sessionStorage`); no backend yet.
- Pack art under `public/images/packs/` is SVG placeholders until real assets arrive.
- Optional env: copy `.env.example` → `.env` (`VITE_API_BASE_URL` for a future API).
