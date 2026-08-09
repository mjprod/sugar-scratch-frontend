# Sugar — Authentication & Adaptive Recommendation Initialization

**Version:** 8.0  
**Platform:** Responsive Web (React + Vite + Tailwind prototype)  
**Type:** Implementation specification for Cursor agents / engineers  
**Status:** Final — matches shipped `src/v8/`

---

## How to use this in Cursor

**Prefer the short version if the agent / human hates walls of text:**  
`src/v8/CHEATSHEET.md`

Paste or `@`-attach this file (or the cheatsheet) and run:

```text
Implement Sugar Spec 8.0 (Authentication + Adaptive Recommendation)
exactly as written in this file.

Repo rules:
- Do NOT modify src/v1 … src/v7 (frozen).
- If building fresh: create src/vN (or update the designated version folder only).
- Wire the version into src/App.tsx + theme import; set it as default if requested.
- Prefer the smallest working diff. Reuse existing feed/purchase UI.
- Auth, Recommendation, and Email Verification must stay three independent systems.
```

**Reference implementation (source of truth if ambiguity):**

- `src/v8/App.tsx`
- `src/v8/flow/auth.ts`
- `src/v8/flow/recommendation.ts`
- `src/v8/AUTH_AND_RECOMMENDATION.md` (short human guide)

**Self-check after implementation:**

```bash
npx tsc --noEmit
npx tsx src/v8/flow/auth.self-check.ts
npx tsx src/v8/flow/recommendation.self-check.ts
```

---

# 1. Purpose

Sugar is **Guest-first**, **Feed-first**, and **Purchase-first**.

- Users browse creators before creating an account.
- Authentication unlocks account actions only.
- Recommendation Initialization (Tinder) solves **cold start only**.
- It is **not** mandatory for every new user.
- Real behaviour (especially purchase) always beats questionnaire answers.

---

# 2. Product priority order

```text
Discover → Interest → Purchase → Recommendation Learning → Better Discovery → Repeat Purchase
```

Never interrupt a purchase to collect preferences.

---

# 3. Core principles

1. Browsing never requires authentication.  
2. Authentication only appears on protected actions.  
3. Authentication must not interrupt purchase intent (after login, resume buy first).  
4. Recommendation Initialization exists only to solve cold start.  
5. Behaviour > explicit Tinder preference. Priority: Purchase > Collection > Like > Tinder.  
6. Recommendation keeps learning forever after init.  
7. **Authentication**, **Recommendation**, and **Email Verification** are three independent systems.

---

# 4. Three independent systems

### Authentication

Owns: identity, session, login, registration, pending action storage.

Does **not** own: feed ranking, preference status, email ownership proof beyond provider defaults.

### Recommendation Initialization

Owns: cold-start decision, Tinder flow, `recommendationStatus`.

Does **not** own: login UI, email verify.

**Hard rule:** No page/component may open Tinder directly.  
Only `evaluateRecommendationEligibility()` may launch Recommendation Initialization.

### Email Verification

Owns: email ownership for Email+Password accounts.

Does **not** own: Google/Apple verify, Recommendation, browsing access.

---

# 5. Guest experience

**Allowed without auth**

- Home Feed, Explore/Browse  
- Creator pages, Theme pages, Pack details  
- Public card previews  

**Protected (open Authentication Sheet immediately)**

- Like  
- Buy Pack / Buy Diamonds  
- Open Pack / Scratch  
- Collection / Rewards / Profile / Purchase History  

Do **not** show a separate “Authentication Required” gate.

---

# 6. Authentication Sheet

| Viewport | Presentation |
|----------|----------------|
| Mobile | Bottom sheet |
| Desktop | Centered modal |

Underlying context stays visible.

### Methods (single surface)

```text
Continue with Google
Continue with Apple
──────── or ────────
Email
Password
Forgot Password?
[ Continue ]
New to Sugar? Create Account
```

Email fields are visible immediately — **no** “Continue with Email” intermediary.

Providers: `google` | `apple` | `email`.

---

# 7. Pending action

Whenever Auth opens, store the action that triggered it.

Minimum shape for the prototype:

```ts
type ProtectedAction =
  | { type: "buy"; pack: PurchaseFlowPack; kind?: "buy-pack" | "open-pack" }
  | { type: "like"; feedItemId: string }
  | { type: "tab"; tab: AppTab }
  | { type: "scratch" };
```

Pending must survive Authentication, Registration, and Email Verification.

### High intent (resume immediately — never interrupt with Tinder)

- Buy Pack  
- Buy Diamonds / payment / Hub store  

### Low intent (may wait until Recommendation finishes)

- Profile, Collection, Rewards, Settings, Like  

---

# 8. Recommendation status

```ts
type RecommendationStatus =
  | "unknown"
  | "eligible"
  | "explicit-in-progress"
  | "explicit-completed"
  | "behavior-seeded"
  | "skipped";
```

| Status | Meaning |
|--------|---------|
| `unknown` | No usable recommendation profile |
| `eligible` | System may start cold-start init |
| `explicit-in-progress` | User is in Tinder |
| `explicit-completed` | Initialized via Tinder |
| `behavior-seeded` | Initialized via behaviour (e.g. purchase) |
| `skipped` | User skipped; continue learning from behaviour |

Initialized (never show first-time Tinder again):  
`explicit-completed` | `behavior-seeded`.

Prototype storage key example: `sugar.v8.recommendationStatus` (namespace by version).

---

# 9. EvaluateRecommendationEligibility()

**Sole entry point** that may launch Tinder / Recommendation Initialization.

Run immediately after Authentication success (and again after Email Verify success when verify was gating a pending action).

```ts
function evaluateRecommendationEligibility(opts: {
  pending: ProtectedAction | null;
}): RecommendationDecision {
  // 1. Not authenticated → none
  // 2. status is behavior-seeded OR explicit-completed → resume
  // 3. high-intent pending (buy / diamonds) → resume
  // 4. strongBehaviourSignal → set behavior-seeded → resume
  // 5. otherwise cold start → launch-initialization
}
```

Evaluation order **must not change**.

Authentication provider must **not** affect this decision.

---

# 10. Strong behaviour signal

Means: Sugar already knows enough to recommend.

Prototype minimum:

- First completed Pack purchase → `behavior-seeded`  
- Demo override: `?strongSignal=1`  

Do **not** treat casual browsing alone as strong enough to skip Tinder (unless product explicitly adds that later).

---

# 11. Post-auth routing (App orchestration)

```text
Auth success
  → create session
  → IF email provider AND first unresolved recommendation AND pending needs verify
        → Verify Email modal
        → onVerified → evaluateRecommendationEligibility(pending)
  → ELSE evaluateRecommendationEligibility(pending)

IF decision = resume | seed-and-resume
  → Resume pending action

IF decision = launch-initialization
  → Defer low-intent pending
  → Open Recommendation Intro (not buried under Profile)
```

---

# 12. Recommendation Initialization UI

### Entry (required before swipes when launched)

```text
Find More Creators You'll Love

Swipe through a few Creator collections.
We'll use your choices to recommend better Packs.

[ Start ]
Skip
```

Forbidden wording: “Finish Setup”, “Complete Registration”, “Complete Onboarding”.

### Tinder cards

Each card = **Creator + Theme** (not Creator-only).

Show: artwork, creator name, theme name, theme tag, optional New/Limited.  
Do **not** show: price, Buy CTA, collection %, diamonds, rewards.

Interactions:

- Swipe right / ♥ = Interested  
- Swipe left / ✕ = Not Interested  
- Desktop must support buttons (drag alone is not enough)  
- Progress: `n / MIN` or bar  
- Config: `MIN_PERSONALIZATION_CARDS = 6` (not hardcoded in JSX)  
- **Skip** anytime → `skipped` → Home Feed (same session: do not reopen)  

### Completion

```text
You're All Set
We'll continue learning what you like.
[ Explore ]
```

→ `explicit-completed` → Home Feed (+ resume deferred low-intent pending).

---

# 13. Purchase-based initialization

```text
Guest → Buy Pack → Auth → [Email verify if needed]
  → Purchase → Open Pack → Scratch → Collection updated
  → recommendationStatus = behavior-seeded
  → Home Feed
```

**No Tinder** before, during, or after this first purchase path.

Seed feed from purchased Creator × Theme (and related combos). Do not assume the user only likes one Creator forever.

Abandoned buy (close without purchase): re-run eligibility — cold start may then launch Recommendation.

---

# 14. Email verification

| Provider | State |
|----------|--------|
| Google / Apple | Treated verified |
| Email + Password | Unverified until Verify modal succeeds |

Triggers: Buy Pack, Buy Diamonds only.  
Never required for browsing or Recommendation.  
Never launches Tinder by itself.

---

# 15. Existing user

```text
Protected action → Auth → Resume pending
```

No Recommendation Initialization if status is already `explicit-completed` or `behavior-seeded`.

---

# 16. Reference flows

### A. New user — buys first

```text
Guest → Buy → Auth → Purchase → Scratch → behavior-seeded → Home
```

### B. New user — create account (no buy)

```text
Guest → Profile → Auth → evaluate → Intro → Start/Skip → …
→ explicit-completed | skipped → Home (+ resume Profile)
```

### C. Strong signal demo

```text
?strongSignal=1 → Auth (no high-intent) → behavior-seeded → resume
```

### D. Returning user

```text
Auth → Resume pending
```

---

# 17. Repo / prototype constraints (Cursor)

When implementing in this monorepo:

1. **Do not edit older version folders** (`src/v1` … previous).  
2. New spec → new folder `src/vN/` (or only the assigned version).  
3. Storage keys namespaced: `sugar.vN.*`.  
4. Theme scoped: `body[data-theme="vN"]`.  
5. Register in `src/App.tsx` version pill + `src/index.css` theme import.  
6. Keep Guest Feed / Purchase / Collection UI; change Auth + Recommendation wiring.  
7. Lazy senior mode: smallest working diff; no new deps unless required.  
8. Leave one tiny runnable self-check for recommendation eligibility helpers.

---

# 18. Suggested file layout

```text
src/vN/
  App.tsx                          # guest gate, pending, auth success, routing
  flow/auth.ts                     # session, provider, verify helpers, pending types
  flow/recommendation.ts           # status + evaluateRecommendationEligibility
  components/auth/AuthenticationSheet.tsx
  components/auth/VerifyEmailModal.tsx
  screens/RecommendationIntroScreen.tsx
  screens/PersonalizationSwipeScreen.tsx   # Creator × Theme Tinder
  screens/PersonalizationCompleteScreen.tsx
  AUTH_AND_RECOMMENDATION.md       # optional short human guide
```

---

# 19. Acceptance criteria

### Existing user

- [ ] Pending action resumes  
- [ ] Recommendation Initialization does not appear again  

### New user — purchase

- [ ] Auth opens on Buy Pack  
- [ ] Purchase resumes after Auth (and verify if email)  
- [ ] Preference/Recommendation Tinder never appears on this path  
- [ ] Status becomes `behavior-seeded` after purchase complete  

### New user — no purchase

- [ ] After Auth, `evaluateRecommendationEligibility` launches Intro  
- [ ] Start → Creator × Theme cards  
- [ ] Skip works; Explore sets `explicit-completed`  
- [ ] Deferred Profile/Like resumes after  

### Systems

- [ ] Google/Apple skip Sugar email verify  
- [ ] Email verify does not trigger Tinder  
- [ ] No component opens Tinder except via evaluate  

---

# 20. AI / Cursor do-not list

- Do not show Tinder after every authentication.  
- Do not interrupt Pack purchase / open / scratch / collection update.  
- Do not couple Recommendation to auth provider.  
- Do not show Recommendation after `behavior-seeded`.  
- Do not require finishing Recommendation before buying.  
- Do not remove Skip.  
- Do not replace Tinder with a long questionnaire.  
- Do not add mandatory username / welcome onboarding unless a newer spec says so.  
- Do not modify frozen older prototype versions.

---

# 21. Final decision tree

```text
Authentication Success
        ↓
EvaluateRecommendationEligibility()
        ↓
Already initialized? ──YES──→ Resume pending
        ↓ NO
High-intent pending? ──YES──→ Resume purchase/store
        ↓ NO                     ↓ (on purchase complete)
Strong behaviour? ────YES──→ behavior-seeded → Resume
        ↓ NO
Launch Recommendation Initialization
        ↓
explicit-completed | skipped
        ↓
Home Feed (+ continuous learning)
```

---

# Final philosophy

Authentication identifies users.  
Purchases reveal intent.  
Recommendation Initialization solves uncertainty.  
Behaviour continuously improves recommendations.  

Recommendation must never become a barrier between users and purchasing Packs.
