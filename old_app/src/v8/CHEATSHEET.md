# Sugar Auth + Rec — Cheat Sheet (v8)

**For Cursor:** `@` this file and say: *Implement this. Don’t touch v1–v7. Match `src/v8/` if unsure.*

---

## 3 boxes (never merge)

| Box | Job |
|-----|-----|
| **Auth** | Who are you? |
| **Rec** | What should we show? (cold start only) |
| **Verify** | Do you own this email? (email login + buy only) |

---

## Guest can browse. Login only when they try to:

Like · Buy · Open · Scratch · Collection · Rewards · Profile

→ Open **Auth Sheet** straight away (Google / Apple / Email on one screen).  
→ No “please log in” middle page.

---

## After login (one function decides)

```text
evaluateRecommendationEligibility(pending)
```

**Only this may open Tinder.** Nothing else.

| If… | Then… |
|-----|--------|
| Already done Rec (`behavior-seeded` / `explicit-completed`) | Resume what they were doing |
| They were buying / buying diamonds | Resume buy. **No Tinder.** |
| `?strongSignal=1` | Mark `behavior-seeded`. Resume. **No Tinder.** |
| Else (new, no buy) | Open Rec Intro → Tinder |

---

## Buy path (most important)

```text
Buy → Auth → Purchase → Scratch → behavior-seeded → Home
```

**Never** put Tinder in the middle or after.

---

## Cold-start path (no buy)

```text
Profile/etc → Auth → Intro [Start|Skip] → swipe Creator×Theme → Explore
```

Skip anytime. Don’t reopen same session.

---

## Email verify

- Google/Apple = already verified  
- Email = verify only for **Buy / Diamonds**  
- Verify ≠ Tinder  

---

## Statuses (one field)

`unknown` → `eligible` → `explicit-in-progress` → `explicit-completed`  
or → `behavior-seeded` (from purchase)  
or → `skipped`

Done forever if: `explicit-completed` | `behavior-seeded`

---

## Files to copy / mirror

```text
App.tsx
flow/auth.ts
flow/recommendation.ts          ← evaluateRecommendationEligibility lives here
components/auth/AuthenticationSheet.tsx
components/auth/VerifyEmailModal.tsx
screens/RecommendationIntroScreen.tsx
screens/PersonalizationSwipeScreen.tsx
screens/PersonalizationCompleteScreen.tsx
```

Keys: `sugar.vN.*` · Theme: `body[data-theme="vN"]`

---

## Don’t

❌ Tinder after every login  
❌ Tinder before/during/after first buy  
❌ Force setup / username / “complete onboarding”  
❌ Edit frozen old versions  

---

## Check it works

1. Restart → Profile → Create account → **see Intro**  
2. Restart → Buy pack → finish → Home → **no Tinder**  
3. `npx tsc --noEmit`

---

**One line:** Ask for prefs only when buying didn’t already tell you.
