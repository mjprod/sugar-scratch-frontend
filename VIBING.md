# Vibing guide — Sugar Scratch player app

Short checklist for non-traditional devs before opening a PR.

## Before you push

Run the full offline test suite from the repo root:

```bash
npm run test
```

That runs TypeScript checks, every `*.self-check.ts` invariant script, and a production build. No API server, Postgres, or browser needed.

If something fails, read the error — self-checks usually name the rule you broke (auth flow, buy path, navigation, etc.). Fix the product code; don't weaken or skip the check.

## Auth, buy, welcome, packs

If your change touches login, purchase, onboarding, or pack inventory, read the **Product rules** section in **`README.md`**.

Key product rules (don't break these):

- **Guests browse freely** — no forced login on landing.
- **Protected actions open the auth sheet** — no separate middle "login page."
- **Buy never goes through Tinder** — purchase opens directly from pack/store CTAs.

## Manual phone smoke (optional but good)

After `npm run test` passes, on a phone over HTTPS:

1. Browse as guest (home / discover).
2. Tap **Buy** on a pack → auth sheet should appear (not a full-page login).
3. Sign in / create account → complete purchase.
4. Scratch at least one card in the pack.

Use `npm run certs` + `npm run dev` and open `https://<your-lan-ip>:5173` on the device.

## Scratch engine (hands off unless coordinated)

Low-level scratch rendering lives in:

`src/features/game/scratch/`

Those files are synced from the operator monorepo. Don't edit `meshGeometry.ts` or `glRenderer.ts` here unless you've coordinated with whoever owns the monorepo sync.

Game *flow* logic (session, outcomes, hints) is in `src/features/game/modules/` — that's fair game, and has self-checks in CI.

## Useful commands

| Command | What it does |
|---------|----------------|
| `npm run dev` | Local dev server (HTTPS, proxies `/api` to :8090) |
| `npm run test` | **Run before every PR** |
| `npm run typecheck` | TypeScript only |
| `npm run self-check` | Invariant scripts only |
| `npm run build` | Production build |
