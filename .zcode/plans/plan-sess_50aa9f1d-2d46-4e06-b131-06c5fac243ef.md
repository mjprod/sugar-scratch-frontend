## Add white left rim stroke on dock

Add an SVG stroke layer that follows `DOCK_PATH` (same as `bottomNavClip.svg`) and fade it so the rim is strongest on the **left**.

### Changes in `src/pages/NavTestPage.tsx`

1. **Markup** — after `.nav-test-dock-surface`, add:

```tsx
<svg
  className="nav-test-dock-rim"
  viewBox="0 0 512.2 106.5"
  preserveAspectRatio="none"
  aria-hidden="true"
>
  <path
    d={DOCK_PATH}
    fill="none"
    stroke="#fff"
    strokeWidth="1.5"
    vectorEffect="non-scaling-stroke"
  />
</svg>
```

2. **CSS** — same box as surface (`right/left: 0`, `bottom: 9px`, `height: 85px`):

```css
.nav-test-dock-rim {
  position: absolute;
  right: 0;
  bottom: 9px;
  left: 0;
  z-index: 1;
  height: 85px;
  width: 100%;
  overflow: visible;
  pointer-events: none;
  mask-image: linear-gradient(90deg, #000 0%, #000 22%, transparent 58%);
  -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 22%, transparent 58%);
}

.nav-test-dock-rim path {
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.55));
}
```

### Notes
- White stroke (`#fff`) with a soft white glow
- Left-only via horizontal mask fade
- Does not touch glass `backdrop-filter`
- Tweak `strokeWidth`, gradient stops, or glow after you see it in device toolbar