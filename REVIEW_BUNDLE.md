# Player app review: structure + bundle / load time

Date: 2026-10-09. Scope: `frontend-new` only, load time and bundle size. Read-only review — no source changes.

How measured: `npm run build` + `npm run check:bundle`; a one-off `vite build --sourcemap` into `.perf/sm-build` analysed with `source-map-explorer`; `madge --circular`; `npm run perf:audit` (Lighthouse 13, mobile, simulated 4G + 4x CPU) against `vite preview` on `:4174` with `/api` and media proxied to `sugarbackend.mxjprod.work`. Raw output stays in `.perf/` (git-ignored).

Caveat: Lighthouse ran against a local preview server, not the production host. Preview sends `cache-control: no-cache` and does not compress `.wasm`, so absolute numbers are pessimistic; the relative ranking of problems is what matters.

---

## 1. Baseline

### First-load (what `index.html` loads on every route)

| File | Raw | Gzip |
|------|-----|------|
| `index-*.js` (entry) | 484 KB | 147 KB |
| `vendor-*.js` (react, react-dom) | 194 KB | 60 KB |
| `motion-*.js` (framer-motion) | 134 KB | 43 KB |
| `lottie-*.js` (dotlottie-web/react) | 159 KB | 31 KB |
| **First-load JS** | | **280 KB of 300 KB budget (93%)** |
| `index-*.css` | 508 KB | 80 KB |
| `/css/cards/base.css` (render-blocking, separate request) | 10 KB | ~3 KB |
| `dotlottie-player.wasm` (fetched at runtime on every route by nav Lotties) | 1.2 MB | 485 KB if compressed |

Largest lazy chunks: `three` 994 KB / 270 KB gz, `game` 224 KB / 58 KB gz, `CreatorPage` 113 KB / 37 KB gz, `ScratchPrototype` 93 KB / 30 KB gz, `MobileCssCarousel` (swiper) 80 KB / 25 KB gz.

### What is inside the entry chunk (472 KB mapped)

| Group | KB raw | Notes |
|-------|--------|-------|
| `src/components/home` | 77 | Home + Discover screens (eager routes) |
| `node_modules/ogl` | 44 | WebGL lib for the Aurora CTA background only |
| `node_modules/react-router` | 37 | expected |
| `src/components/cta` | 27 | CtaButton + Aurora + BorderGlow |
| `src/features/game` | 22 | `gameSession`, `InitialCountdown`, `media`, `session` pulled by services/contexts |
| `LiquidGlassNav.tsx` | 22 | single 1,768-line nav component |
| `src/content/legalDocs.ts` | 19 | legal text, only shown when a user opens Terms/Privacy |
| `src/components/auth` | 18 | AuthenticationSheet always mounted in `AppLayout` |
| `src/components/search` | 16 | SearchScreen (overlay) |

### Lighthouse (guest, mobile, simulated)

| Route | Score | FCP | LCP | TBT | Transfer | LCP element / main cost |
|-------|-------|-----|-----|-----|----------|-------------------------|
| `/` | 51 | 2.7 s | 10.4 s | 611 ms | 4.8 MB | guest hero `<video>` 2.7 MB; wasm 1.2 MB; `how-win.png` 312 KB |
| `/discover` | 70 | 2.7 s | 9.9 s | 81 ms | 3.9 MB | swipe poster; two swipe MP4s 1.9 MB; wasm |
| `/store` → `/get-diamonds` | 71 | 2.7 s | 9.2 s | 0 ms | 1.8 MB | text section; wasm is 2/3 of transfer |
| `/creator/julianaval` | 66 | 3.2 s | **40.5 s** | 103 ms | **10.1 MB** | `avatar.jpeg` **4.0 MB**, `cover.png` **1.8 MB** (LCP), pack MP4 1.7 MB, `three` 263 KB |
| `/purchase/julianaval-pack-1` (guest → `/`) | 67 | 3.6 s | 11.0 s | 0 ms | 4.7 MB | downloads `three` (263 KB) before redirecting home, then the home video |
| `/game?...` | 80 | 3.1 s | 3.5 s | 278 ms | 3.0 MB | wasm 1.2 MB, mesh JSON 527 KB, two clip MP4s |

Unused JS reported per route: 160–170 KB on simple routes, ~370 KB on creator/purchase (three + carousels).

---

## 2. Structure findings

**Size map** (lines, excluding self-checks): `features` 54k (game 25.5k, collection 10.7k, packs 9.9k, swipe 5.3k, reveal 2.7k), `components` 33.7k across ~25 folders, `services` 10.1k, `lib` 3.3k, `pages` 3.2k (thin route wrappers — good), 65 self-check files.

**Domain split between `components/` and `features/`.** The same domain lives in both places: `components/collection` + `features/collection`, `components/game` + `features/game`, `components/purchase` + `features/packs` + `features/reveal`, `components/recommend` + `features/swipe`. There is no written rule for which goes where, so new code lands by habit. Suggested rule: `features/<domain>` owns screens, hooks, and CSS; `components/` keeps only cross-domain UI (layout, nav, ui, cta).

**Near-duplicates.**
- `components/cta/BorderGlow.{tsx,css}` and `components/ui/BorderGlow.{tsx,css}` — two diverged copies, both in the entry bundle.
- `features/packs/CoverFlowCarousel.tsx` (3,364 lines) and `CoverFlowCarouselV2.tsx` (4,050 lines) — both in production: V1 via `FeaturedCoverFlow`/`DesktopCoverFlow`/`PurchaseFlow`, V2 via `CartPage`/`PurchaseFlow`/`CoverFlowV2Page`. ~7.4k lines of overlapping three.js carousel code.
- `lib/pack3d/` (implementation) vs `shared/pack3d/index.ts` (re-export) — a second import path for the same module; pick one.

**Oversized modules** (hard to review, hard to split for loading): `ScratchPrototype.tsx` 6,554, `CoverFlowCarouselV2.tsx` 4,050, `PhotoScratch.tsx` 3,843, `CoverFlowCarousel.tsx` 3,364, `PurchaseFlow.tsx` 2,771, `HoloCard.tsx` 2,389, `LiquidGlassNav.tsx` 1,768, `AuthContext.tsx` 1,156.

**Global CSS monolith.** `src/theme.css` is 18,392 lines / 420 KB and is imported from `index.css`, so every route ships it. It contains page-specific sections (Daily Reward hub, Explore, Collection hub ×2, Creator Page V2, Home Feed, Auth Spec 2.0 + Auth v7, Rec Intro, Inbox, ...). Rules scoped by `[data-theme=v8]` alone account for ~306 KB of the 508 KB entry CSS.

**Circular imports (madge, 4):**
1. `types/app.ts` → `lib/session.ts` → `services/auth.ts` → `types/app.ts`
2. `lib/pack3d/videoTextureCache.ts` ↔ `videoTextureCacheHandle.ts`
3. `features/game/modules/gameSession.ts` ↔ `services/collectionState.ts`
4. `services/creatorFeed.ts` ↔ `services/feedFavourites.ts`

Number 3 is also why game code sits in the entry: `AuthContext`, `AppLayout`, `CatalogContext`, `collectionState`, `gameHistory`, `accountLocalState`, `packMotionSettle`, and `purgeRouteMemory` all import from `features/game/modules/gameSession`, and `AuthContext` imports `unlockCountdownSound` from `InitialCountdown.tsx` (which drags in dotlottie-react).

**Provider stack** (`App.tsx`): Auth → Wallet → Search → PageReady → MemoryTransition → Motion, plus `SitePreloader`. The providers themselves are light; the cost is what `AppLayout` mounts unconditionally — `AuthenticationSheet` (+ `LegalDocPanel` + `legalDocs`), `VerifyEmailModal`, `LiquidGlassNav`, `MobileDiamondUtility` (imports `LiquidGlassNav.css`), `WalletBalancesPopover` (imports the full 69 KB `features/packs/packs.css`), `InboxButton` (dotlottie).

**Dev-experience note.** Vite logs "Could not Fast Refresh" for `AuthContext` (`useAuth`), `MemoryTransition` (`useMemoryNavigate`), `LiquidGlassNav` (`DESKTOP_TABS`), and `PageTransition` (`isPageWarmed`) because they export hooks/constants next to components. Each edit to these files does a full reload of a large subtree. No production impact.

**Dev/test routes shipped to production:** `/coverflow-v2`, `/mobile-carousel`, `/game-ui`, `/audio-test`, `/component-lab`, `/pre-loader`. They are lazy (no first-load cost) but are publicly reachable and add ~1.8 MB of `src/assets/component-lab` PNGs to the deploy.

---

## 3. Prioritized fix list

Impact: H = seconds of LCP or > 100 KB on common routes; M = tens of KB or one route; L = hygiene. Effort: S < half day, M 1–2 days, L > 2 days.

| # | Fix | Files | Expected gain | Impact | Effort | Product-rule risk |
|---|-----|-------|---------------|--------|--------|-------------------|
| 1 | **Serve resized creator media.** `avatar.jpeg` (4 MB) and `cover.png` (1.8 MB) are originals. Generate WebP/AVIF variants (avatar ~256 px, cover ~1080 px) in the backend media pipeline, and request them from the player. | backend media / `normalizeMediaUrl` callers, `CreatorPage` backdrop | ~5.5 MB and most of the 40 s LCP on `/creator/*` | H | M (backend) | None |
| 2 | **Compress and cache `dotlottie-player.wasm`** (1.2 MB → ~485 KB gzip, less with brotli). Confirm the production host sends `Content-Encoding` for `application/wasm` and a long `Cache-Control`; move it under a hashed path so it can be `immutable`. | hosting config, `scripts/copy-dotlottie-wasm.mjs`, `src/main.tsx` | ~700 KB on every first visit | H | S | None |
| 3 | **Defer the first Lottie (and the wasm) until after LCP.** Nav icons (`InboxButton`, `CoinLottie`, `DiamondLottie`) render a static SVG/PNG first and mount `DotLottieReact` on idle (`requestIdleCallback`) or interaction. Move `setWasmUrl` into the lazy Lottie wrapper so `main.tsx` no longer imports `@lottiefiles/dotlottie-react`. | `src/main.tsx`, `components/InboxButton.tsx`, `components/ui/{Coin,Diamond}Lottie.tsx`, `contexts/AuthContext.tsx` (`unlockCountdownSound`) | −31 KB gz first-load JS; wasm no longer competes with LCP | H | M | None |
| 4 | **Guest home hero video.** `preload="metadata"` is ignored because of `autoPlay`, so the 2.7 MB MP4 downloads immediately. Show the poster as the LCP image (`<link rel="preload" as="image">`) and attach `src` after first paint/idle; ship a smaller mobile encode (≤ 800 KB, 540p). | `components/home/GuestHomeLanding.tsx`, `public/video/` | ~2 MB off `/`, LCP becomes the poster | H | S | Guest browse unchanged |
| 5 | **Review the `SitePreloader` floor.** `MIN_MS = 2800` (max 4500) covers `/`, `/discover`, `/rank`, `/search`, `/creator/*`, `/purchase/*` on first visit, so LCP can't land before FCP + ~2.8 s even on a fast network. Lower the floor (for example 800–1200 ms) or end it on `ready`. | `components/SitePreloader.tsx` | 1.5–2.5 s LCP on covered routes | H | S | Brand/UX decision — needs product sign-off |
| 6 | **Split `theme.css` by page.** Move page sections (Collection hub, Creator V2, Home Feed, Auth Spec 2.0 / v7, Rec Intro, Inbox, Daily Reward hub) into CSS files imported by their screens (lazy chunks get their own CSS). Keep tokens, base, and shell in `index.css`. Also stop importing all of `packs.css` from `WalletBalancesPopover`/`FeaturedCoverFlow` — extract the few classes they use. | `src/theme.css`, `src/index.css`, `components/WalletBalancesPopover.tsx` | entry CSS 80 KB gz → est. 30–40 KB gz; less render-blocking parse | H | L (mechanical, many files) | Visual regressions — check screens against the design |
| 7 | **Guest purchase redirect loads `three` first.** `/purchase/:id` as guest fetches the `PurchaseFlowPage` chunk (and `three`, 263 KB gz) before redirecting to `/`. Gate before the lazy import (redirect/auth sheet in the route element, or only lazy-load the flow after the session is known). | `routes/AppRoutes.tsx`, `pages/PurchaseFlowPage.tsx` | −263 KB gz + carousel chunks for guests | M | S | Must keep "auth sheet on protected action" and "buy path skips Tinder" |
| 8 | **Take `ogl` + Aurora out of the entry.** `CtaButton` statically imports `Aurora` → `auroraShared` → `ogl`. Lazy-load `Aurora` inside `CtaButton` (render the CSS gradient fallback until it mounts). | `components/cta/CtaButton.tsx`, `components/cta/Aurora.tsx` | −44 KB raw (~15 KB gz) + Aurora code | M | S | None |
| 9 | **Lazy-load content the user opens on demand:** `legalDocs` (19 KB) via `import()` in `LegalDocPanel`; `SearchScreen` (16 KB) when search opens; `AuthenticationSheet` body after the first protected action (keep a tiny shell mounted so the sheet still opens inline). | `components/auth/LegalDocPanel.tsx`, `contexts/SearchContext.tsx`, `components/layout/AppLayout.tsx` | ~50 KB raw (~15–18 KB gz) | M | S | Auth sheet must still open inline with no full-page step |
| 10 | **Make `/discover` and `/rank` lazy.** Keep `BrowsePage` (the `/` index route) eager for guest LCP; lazy-load `HomeFeedPage` and `RankPage` and prefetch them on idle from `/`. | `routes/AppRoutes.tsx` | ~30–40 KB raw off entry | M | S | Guest browse keeps working (routes stay public) |
| 11 | **Break the `gameSession` cycle and keep game modules out of the entry.** Move the session-storage helpers that services need (`listStoredGameSessions`, `bindGameNavigate`, etc.) into a small `services/gameSessionStore.ts` with no UI imports; move `unlockCountdownSound` into a sound util that doesn't import dotlottie. | `features/game/modules/gameSession.ts`, `services/collectionState.ts`, `contexts/AuthContext.tsx`, `features/game/modules/InitialCountdown.tsx` | −22 KB raw entry; fixes cycle #3 | M | M | Keep `gameSession.self-check.ts` passing |
| 12 | **framer-motion on every page.** Entry users: `layout/Shell.tsx` (route `AnimatePresence`), `AuthShell`, `AuthenticationSheet`, `VerifyEmailModal`, `SearchScreen`, `PackLibrary`. Either switch these to `LazyMotion` + `m` with `domAnimation` (loads features async), or replace the simple fades/slides with CSS transitions so `motion` becomes a lazy chunk. | listed files | up to −43 KB gz first-load | M | M | Auth sheet animation must stay smooth |
| 13 | **Consolidate the CoverFlow carousels** (V1 + V2, ~7.4k lines) into one implementation. | `features/packs/CoverFlowCarousel*.tsx` and callers | smaller purchase/cart chunks; less code to maintain | M | L | Purchase path behaviour (no Tinder) |
| 14 | **Image hygiene in `public/`:** `figma-my-collection/*.png` (1.2 MB each), `home-v2/spotlight-banner.png` 938 KB, `home-v2/how-win.png` 312 KB (loaded on `/`), `img/placeholder.png` 260 KB (fallback avatar used widely), `welcomeGirl@3x.png` 350 KB → WebP/AVIF at display size. | `public/img`, `public/images` | 0.3–3 MB depending on route | M | S | None |
| 15 | **Hygiene:** merge the two `BorderGlow` copies; pick one of `lib/pack3d` / `shared/pack3d`; fix the other 3 cycles; split hook/constant exports out of the 4 Fast-Refresh files; gate dev routes (`/component-lab`, `/audio-test`, `/game-ui`, `/coverflow-v2`, `/mobile-carousel`) behind `import.meta.env.DEV` or a flag. | as listed | maintainability; ~1.8 MB fewer deployed assets | L | S–M | None |

Suggested order: 2 → 4 → 5 (decision) → 1 (backend) → 3 → 7 → 8/9/10 → 6 → 11/12 → 13–15. Items 2, 4, 7, 8, 9, 10 are each small and independent and could go in one or two PRs; together they should save roughly 60–80 KB gz of first-load JS and several MB of transfer on `/`.

---

## 4. Budget follow-ups (`scripts/check-bundle-budget.mjs`)

Once the related fixes land:

- Add `/lottie-[\w-]+\.js$/` to `FORBIDDEN_PRELOADS` (after fix 3) and `/motion-[\w-]+\.js$/` (after fix 12).
- Lower `FIRST_LOAD_JS_BUDGET_KB` from 300 to the new baseline + ~10% (likely ~220).
- Add a first-load CSS budget (for example 50 KB gz after fix 6) — the script already computes `totalCss`.
- Optionally fail when any file in `dist/` other than video/glb exceeds a size cap (for example images > 300 KB), so originals don't slip into `public/` again.

## 5. Not covered here

Runtime FPS / WebGL / memory (see `GAME_PERF_PLAN.md`), signed-in routes (re-run `perf:audit` with `PERF_COOKIE`), backend API latency, and production CDN headers (only inferred — verify on the live host).
