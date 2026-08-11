## Fix BR rim lights across phone widths

### Diagnosis
You're right that this is mostly **horizontal**, and not really a left-rim problem.

- **Left rims work** because their X offsets are small (`0.5` / `60.5`) and sit near the left end of a full-width SVG that already stretches with the dock.
- **BR rims break** because they use **large fixed px** offsets tuned on one width:
  - `brA: translateX(-34px)`
  - `brC: translateX(-36px)`
- Dock width changes a lot across devices:
  - smaller phones ~320–390 CSS px
  - iPhone 15/16 Pro Max ~430 CSS px
- A fixed `-34px / -36px` is a different fraction of the bar on each device, so the visible BR stroke drifts off the glass corner.
- Current CSS also uses `transform-origin: center center` on all rims. That doesn't hurt left much, but for BR it makes any scale/height mismatch orbit around the middle of the bar instead of the right end.

`transform-origin` alone won't fully fix it while X is absolute px. BR X needs to be **width-relative**.

### Approach
Keep left rims as-is. Make **only BR horizontal positioning fluid**.

1. **BR X as % of rim/dock width**
   - Convert locked BR X from absolute px into a percentage of the rim box width.
   - Approximate from the width you tuned on (assume ~390–430; refine if needed):
     - `-34px` → roughly `-8%` to `-9%`
     - `-36px` → roughly `-8.5%` to `-9.5%`
   - Implement as CSS vars:
     - `--rim-x: -8.7%` style values for BR layers
     - or `calc(-1 * var(--rim-x-pct) * 1%)`

2. **BR transform-origin to the right end**
   - Left layers stay `center` / default.
   - BR layers:
     ```css
     .nav-test-dock-rim-br-a,
     .nav-test-dock-rim-br-c {
       transform-origin: right center;
     }
     ```
   - So any residual scale/height difference anchors from the Profile end.

3. **Keep Y in px**
   - Your note: only horizontal needs fixing.
   - Leave BR Y as px (`2.5` / `4`) unless testing shows vertical drift.

4. **Optional clamp for extreme widths**
   - If SE still drifts a hair:
     ```css
     transform: translateX(clamp(-42px, -9%, -28px)) translateY(...);
     ```
   - Only add if pure % isn’t enough after a quick device-toolbar check.

5. **Debug panel update**
   - For BR layers, expose **X %** (or dual px/%), so you can retune responsively and Copy JSON/CSS again.
   - Left layers can stay px.
   - Or simpler: store BR X as percent in `DEFAULT_RIM_DEBUG` and render `%` in `rimLayerStyle` when layer is BR.

### Files
- `src/pages/NavTestPage.tsx` only
  - `DEFAULT_RIM_DEBUG` BR X units
  - `rimLayerStyle()` output (`px` vs `%`)
  - CSS for BR `transform-origin`
  - debug slider labeling if needed

### Out of scope
- Left rim retune
- Surface mask / hero button
- Vertical responsive work unless you ask after horizontal is solid

### Verify
Device toolbar:
- iPhone SE / small (~375)
- iPhone 15 Pro
- iPhone 15/16 Pro Max (~430)

Expect BR soft + crisp stroke to stay on the Profile corner the way left rims stay on Home.

### Implementation order
1. Switch BR X to `%` + `transform-origin: right center`
2. Set initial % from current locked values
3. Quick visual pass; add `clamp()` only if needed
4. Update debug export so future Copy CSS stays responsive