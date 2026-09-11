# Game performance plan

Scratch game (`/game`) frame-cost work. Prefer `*.self-check.ts` + `npm run test`.

## Phases 1–6 (shipped)

| Phase | Summary |
|-------|---------|
| 1 | ≤1 fabric + gated symbol `readPixels` / rAF |
| 2 | `setProgress` ≤1/250ms; flush on stroke end |
| 3 | Half-rate bottom — Phase 8: only while scratching on coarse |
| 4 | Wrapped video drift; seek cooldown |
| 5 | Celebrate every 10%; mobile fairy-dust DPR=1 |
| 6 | Mesh punch `bufferSubData` only when verts move |

---

## Phase 7 — iOS stutter (Safari memory timeline)

**Why:** ~30s asia_gym2 capture on Safari iOS showed stutter dominated by **GC** (66 pauses, full GC up to ~400ms), **JS heap +147MB**, **page memory spikes to ~930MB**, **~700 touchmove/s**, and **~300 worker `message`/s** — not Phase 1–6 probe/mesh paths.

**Do:**
1. Coalesce pointer/touch moves → one densified scratch apply per rAF (`scratchInputCoalesce.ts`).
2. Fixed marks ring buffer — no per-stamp `[...].slice(-180)` (`scratchMarksRing.ts`).
3. Quiet DotLottie: preload on Tap to play; **worker icons on phones too** (preferStatic-on-coarse was reverted — looked soft). Freeze only when `basePaused`.
4. Game WebGL `pixelRatio` via `resolveGameCanvasPixelRatio` — coarse ≤1.5, fine ≤2 (was locked to 1; Safari looked soft).
5. Keep move path free of `setState` (pending ref only until rAF / pointer-up).

**Done when:**
- [x] Move path notes pending; rAF / stroke-end applies once
- [x] Marks ring mutates in place
- [x] Symbol preload on entry; sharp worker icons (no preferStatic-on-coarse)
- [x] Game canvas DPR capped (coarse 1.5 / fine 2) — not full phone 3×
- [x] Self-checks wired into `npm run self-check`

**Re-measure (same phone timeline):** fewer full GCs / flatter JS heap / far fewer `message` events during scratch / frame p99 mostly ≤32ms.

---

## Phase 8 — Safari scratch path (quality + cost)

**Why:** Full-rate bottom looked good at idle but competing with scratch uploads on Safari; chest-follow kept forcing GL presents via `camMoved` during strokes.

**Do:**
1. Half-rate bottom uploads **only** while scratching on coarse pointers (`halfRateBottom.ts`). Idle / desktop / post-claim stay full-rate.
2. Freeze chest-follow while the finger is down (`chestFollowGate.ts`).
3. Keep idle canvas DPR at coarse ≤1.5 / fine ≤2 (Phase 7 sharpness).

**Done when:**
- [x] Idle background stays full clip fps
- [x] Phone scratch uses half-rate underlay
- [x] Camera pan paused during stroke
- [x] Self-checks wired

---

## Phase 9 — Stamp + foil budget

**Why:** After Phases 1–8, Safari still paid for up to 40 densified paints/rAF, a 3× foil 2D canvas, body-marker DOM mid-stroke, soft video seeks during scratch, and fairy-dust `readPixels`/spawn on the stroke path.

**Do:**
1. Coarse stamp budget: densify ≤12 points, larger path step; auto ≤12/frame + fill 16 (`scratchStampBudget.ts`).
2. Foil bar canvas DPR coarse ≤1.5 / fine ≤2 (`foilCanvasPixelRatio.ts`, `TopSymbolBar`).
3. Freeze body markers while scratching — **reverted** (symbols looked stuck on the body); markers stay live.
4. Suppress soft video seeks while scratching (`videoSync` `isScratching`).
5. Coarse fairy dust: spawn only after pointer-up; skip fabric probe mid-stroke (`fairyDustSpawnPolicy.ts`).
6. Symbol Lottie: worker path on mobile (preferStatic-on-coarse reverted — looked soft); freeze only when `basePaused`.

**Done when:**
- [x] Coarse finger scratch ≤ ~12 paints/rAF
- [x] Foil overlay DPR ≤1.5 on phones
- [x] Soft seeks suppressed during stroke; body markers stay live
- [x] Fairy dust does not `readPixels`/spawn mid-stroke on coarse
- [x] Self-checks wired

---

## How to measure (quick)

| Metric | Idle target | Scratch target |
|--------|-------------|----------------|
| GL clears / s | ~video rate | Higher OK while dirty |
| `readPixels` / s | ~0 | Low tens |
| Full GC max | ≪ 100ms if possible | same |
| Frame p99 | ≤ ~16–32 ms on phone | same |
