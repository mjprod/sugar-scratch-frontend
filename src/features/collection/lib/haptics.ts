/**
 * Mobile haptic ticks.
 *
 * iOS Safari has no public Vibration API. The known bypass is toggling a real
 * `<input type="checkbox" switch>` via a genuine `HTMLElement.click()` on its
 * label / a proxy button.
 *
 * Safari is picky:
 * - `display: none` often kills the switch haptic
 * - synthetic events from rAF usually do nothing
 * - a real `.click()` from a trusted touch/pointer handler is what works
 * - taps work most reliably; continuous gestures need the pulse to stay
 *   inside the pointer event stack (never rAF)
 */

const HAPTIC_ID = '___holo-haptic-switch___'
const HAPTIC_BTN_ID = '___holo-haptic-btn___'

let inputElement: HTMLInputElement | null = null
let labelElement: HTMLLabelElement | null = null
let buttonElement: HTMLButtonElement | null = null
let mounted = false
let lastPulseAt = 0

function isIOS(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false
  }
  const iOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const iPadOS =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOSDevice || iPadOS
}

/** Off-screen but still laid out — display:none breaks the iOS switch haptic. */
function parkOffscreen(el: HTMLElement) {
  el.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:44px',
    'height:44px',
    'margin:0',
    'padding:0',
    'opacity:0.001',
    'pointer-events:none',
    'border:0',
    'overflow:hidden',
    'z-index:-1',
    '-webkit-appearance:none',
    'appearance:none',
    'transform:translate3d(-200vw,-200vh,0)',
  ].join(';')
}

function flipSwitch() {
  const input = inputElement
  if (!input) return
  // Safari only ticks when the checked state actually changes.
  input.checked = !input.checked
}

export function mountHaptics() {
  if (typeof document === 'undefined') return
  if (mounted && inputElement && labelElement && buttonElement) return

  let input = document.querySelector<HTMLInputElement>(`#${HAPTIC_ID}`)
  let label = document.querySelector<HTMLLabelElement>(
    `label[for="${HAPTIC_ID}"]`
  )
  let button = document.querySelector<HTMLButtonElement>(`#${HAPTIC_BTN_ID}`)

  if (!input) {
    input = document.createElement('input')
    input.type = 'checkbox'
    input.id = HAPTIC_ID
    // iOS 17+ switch control — produces the system tick.
    input.setAttribute('switch', '')
    input.setAttribute('aria-hidden', 'true')
    input.tabIndex = -1
    parkOffscreen(input)
    document.body.appendChild(input)
  } else {
    parkOffscreen(input)
    if (!input.hasAttribute('switch')) input.setAttribute('switch', '')
  }

  if (!label) {
    label = document.createElement('label')
    label.htmlFor = HAPTIC_ID
    label.setAttribute('aria-hidden', 'true')
    label.textContent = ' '
    parkOffscreen(label)
    document.body.appendChild(label)
  } else {
    parkOffscreen(label)
  }

  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.id = HAPTIC_BTN_ID
    button.setAttribute('aria-hidden', 'true')
    button.tabIndex = -1
    parkOffscreen(button)
    // Real click handler — Safari trusts this activation chain more than a
    // bare label.click() from pointermove in some WebKit builds.
    button.addEventListener(
      'click',
      (ev) => {
        ev.preventDefault()
        flipSwitch()
        // Also poke the label path as a second attempt.
        try {
          label?.click()
        } catch {
          // ignore
        }
      },
      { passive: false }
    )
    document.body.appendChild(button)
  } else {
    parkOffscreen(button)
  }

  inputElement = input
  labelElement = label
  buttonElement = button
  mounted = true
}

/**
 * One short system tick.
 * Call from pointer/touch handlers only — never from detached rAF.
 */
export function triggerHaptic(_durationMs = 10) {
  if (typeof window === 'undefined') return

  if (!mounted || !inputElement || !labelElement || !buttonElement) {
    mountHaptics()
  }

  // Tiny debounce so multi-index flushes don't collapse into one silent burst
  // of ignored WebKit activations — still allow rapid per-dot ticks.
  const now = performance.now()
  if (now - lastPulseAt < 8) return
  lastPulseAt = now

  if (isIOS()) {
    const button = buttonElement
    const label = labelElement
    const input = inputElement
    if (!button || !label || !input) return

    try {
      // Primary: real button click → handler flips the switch.
      button.click()
    } catch {
      // ignore
    }

    // Secondary: direct flip + label click.
    try {
      flipSwitch()
      label.click()
    } catch {
      // ignore
    }
    return
  }

  // Android / others.
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    try {
      navigator.vibrate(_durationMs)
      return
    } catch {
      // fall through
    }
  }

  try {
    buttonElement?.click()
  } catch {
    // ignore
  }
}

/** Call on first user touch so the switch nodes exist before scrubbing. */
export function unlockHaptics() {
  mountHaptics()
}
