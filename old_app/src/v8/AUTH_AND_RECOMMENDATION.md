# Sugar v8 — Auth & Recommendation (Dev Guide)

Short guide for how login and “onboarding” work in the **v8** prototype.

> **Hate reading?** Start here → [`CHEATSHEET.md`](./CHEATSHEET.md) (1 page)  
> **Full Cursor spec:** [`SPEC_AUTH_RECOMMENDATION.md`](./SPEC_AUTH_RECOMMENDATION.md)  
> **Slightly longer guide:** this file

> There is **no** classic onboarding (no username wizard, no forced welcome).
> What used to feel like onboarding is **Recommendation Initialization** — only for cold-start users.

---

## Mental model: 3 separate systems

| System | Job | Does **not** decide |
|--------|-----|---------------------|
| **Authentication** | Who is the user? (session) | Feed / preferences |
| **Recommendation** | Do we know what to show? (cold start) | Login / verify |
| **Email verification** | Does this email account own the inbox? | Preference / Tinder |

Never glue these into one linear “sign up → setup → buy” funnel.

---

## Guest vs signed-in

**Guest can:** browse Home Feed, Explore, creator/theme/pack pages.

**Guest cannot** (opens Authentication Sheet):

- Like  
- Buy Pack / Buy Diamonds  
- Open Pack / Scratch  
- Collection / Rewards / Profile  

There is **no** “Auth Required” middle screen — the full Auth Sheet opens immediately.

---

## Authentication Sheet

- **Mobile:** bottom sheet  
- **Desktop:** centered modal  
- Underlying page stays visible  

**Methods on one screen:**

- Continue with Google  
- Continue with Apple  
- Email + Password (always visible)  
- Forgot Password / Create Account  

**Code:** `src/v8/components/auth/AuthenticationSheet.tsx`  
**Session:** `src/v8/flow/auth.ts` (`createSession`, `destroySession`)

When Auth opens, the app stores a **pending action** (what the user was trying to do). After success, that action is restored (or delayed — see below).

---

## Pending actions

| Intent | Examples | After auth |
|--------|----------|------------|
| **High intent** | Buy Pack, Buy Diamonds (Hub/Store) | Resume **immediately**. Never open Tinder first. |
| **Low intent** | Profile, Collection, Rewards, Like | May wait until Recommendation finishes. |

---

## After login — the only decision function

```text
Auth success
    → (email verify if needed for buy/store)
    → evaluateRecommendationEligibility({ pending })
    → resume OR launch Recommendation Initialization
```

**Rule:** no screen should open Tinder by itself.  
Only `evaluateRecommendationEligibility()` in `src/v8/flow/recommendation.ts` may launch it.

### Evaluation order (do not reorder)

1. Not authenticated → stop  
2. Already `behavior-seeded` or `explicit-completed` → resume pending  
3. High-intent pending (buy / diamonds) → resume pending  
4. Strong behaviour signal (`?strongSignal=1`) → set `behavior-seeded` → resume  
5. Cold start → **launch Recommendation Initialization**

Wired from `completeAuth` / verify success in `src/v8/App.tsx`.

---

## Recommendation status

```ts
type RecommendationStatus =
  | "unknown"              // no profile yet
  | "eligible"             // may start cold-start flow
  | "explicit-in-progress" // in Tinder
  | "explicit-completed"   // finished Tinder
  | "behavior-seeded"      // purchase (etc.) seeded profile — skip Tinder
  | "skipped";             // user skipped; learn from behaviour
```

Stored in `localStorage`: `sugar.v8.recommendationStatus`.

**Initialized** (never show first-time Tinder again):

- `explicit-completed`  
- `behavior-seeded`

---

## “Onboarding” = Recommendation Initialization (cold start only)

Shown only when eligibility says **launch**.

### Flow

```text
Intro screen
  "Find More Creators You'll Love"
  [ Start ]  [ Skip ]
       │           │
       ▼           ▼
   Tinder cards   status = skipped → Home (+ resume low-intent)
   Creator × Theme
   (min 6 cards, configurable)
       │
       ▼
   "You're All Set" → Explore
   status = explicit-completed → Home (+ resume low-intent)
```

**Screens**

- Intro: `RecommendationIntroScreen.tsx`  
- Swipe: `PersonalizationSwipeScreen.tsx`  
- Done: `PersonalizationCompleteScreen.tsx`  

**Config:** `MIN_PERSONALIZATION_CARDS = 6` in `recommendation.ts`.

Skip is always available. Do not reopen in the same session after skip.

---

## Purchase path (no Tinder)

```text
Guest → Buy Pack → Auth → [Email verify if email user]
  → Purchase → Open → Scratch → Collection
  → recommendationStatus = behavior-seeded
  → Home Feed (personalized from purchase)
```

Purchase signal beats questionnaire. Do **not** show Tinder after this.

---

## Email verification

| Provider | Verified? |
|----------|-----------|
| Google / Apple | Yes (no Sugar verify step) |
| Email + password | No until Verify modal |

**When it appears:** Buy Pack or Diamonds Store only.  
**Never** for browsing or for Recommendation.

`needsEmailVerification()` in `auth.ts` · UI: `VerifyEmailModal.tsx`.

---

## Common paths (cheat sheet)

### New user buys first

```text
Buy → Auth → Purchase → behavior-seeded → Home
```

No Tinder.

### New user opens Profile / Create Account

```text
Profile → Auth → evaluate → Intro → Start/Skip → …
```

Tinder (or skip) then Home; Profile resumes after.

### Returning user

```text
Auth → resume pending
```

No Recommendation Initialization.

### Demo strong signal

```text
?strongSignal=1 → Auth (no buy) → behavior-seeded → resume
```

---

## Key files

| File | Role |
|------|------|
| `src/v8/App.tsx` | Guest gate, pending, auth success, routing |
| `src/v8/flow/auth.ts` | Session, provider, email verify helpers |
| `src/v8/flow/recommendation.ts` | Status + **evaluateRecommendationEligibility** |
| `src/v8/components/auth/AuthenticationSheet.tsx` | Login / signup UI |
| `src/v8/components/auth/VerifyEmailModal.tsx` | Email verify UI |
| `src/v8/screens/RecommendationIntroScreen.tsx` | Cold-start entry |
| `src/v8/screens/PersonalizationSwipeScreen.tsx` | Tinder cards |

Storage keys are prefixed `sugar.v8.*` (independent of v7).

---

## Do / don’t (for implementers)

**Do**

- Keep Auth, Recommendation, Verify independent  
- Always store + restore pending actions  
- Let purchase set `behavior-seeded`  
- Launch Tinder only via `evaluateRecommendationEligibility()`  

**Don’t**

- Open Tinder right after every login  
- Put Tinder between Auth and Buy Pack  
- Show Tinder after a first purchase seed  
- Require Google/Apple users to verify email again  
- Call Recommendation a mandatory “Complete Setup”  

---

## Quick test

1. Restart (clears v8 session) or wipe `sugar.v8.*`  
2. Guest → avatar/Profile → Create Account → see Intro  
3. Restart → Guest → Buy Pack → finish purchase → Home, **no** Intro  
4. Switch version pill to **v8** (default)

Self-checks:

```bash
npx tsx src/v8/flow/auth.self-check.ts
npx tsx src/v8/flow/recommendation.self-check.ts
```
