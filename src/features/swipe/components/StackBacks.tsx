import { animated, to, useSprings } from '@react-spring/web'
import { useMemo } from 'react'
import {
  CARD_RADIUS,
  STACK_BACK_GRAYS,
  STACK_BACK_TOTAL,
  STACK_BACK_VISIBLE,
  STACK_DISSOLVE_SCALE,
  STACK_DISSOLVE_SPRING,
} from '../constants/cards'
import {
  defaultStackBacksTune,
  useStackBacksTune,
} from '../context/StackBacksDebugContext'

type StackBacksProps = {
  /**
   * How many gray lips should show behind the 2nd-card locus.
   * remaining−1 capped at 4: 5+ → 4, 4 → 3, 3 → 2, 2 → 1, 1 → 0.
   */
  visibleCount: number
  zIndex: number
}

function composeLipTransform(
  x: number,
  y: number,
  scale: number,
  rot: number,
) {
  // translateZ(0) keeps each lip on a stable compositor layer (reduces promote flicker).
  return `translate3d(${x}px, ${y}px, 0) rotateZ(${rot}deg) scale(${scale})`
}

/**
 * Deck-level gray underlays fixed at the 2nd-card rest locus.
 * All 4 lips stay mounted; hide is a springed opacity+scale recede so the pack
 * dissolves like Time Machine instead of popping off.
 */
export function StackBacks({ visibleCount, zIndex }: StackBacksProps) {
  const tune = useStackBacksTune()
  const shown = Math.max(0, Math.min(STACK_BACK_VISIBLE, visibleCount))

  const lips = useMemo(() => {
    const defaults = defaultStackBacksTune()
    return Array.from({ length: STACK_BACK_VISIBLE }, (_, index) => {
      return tune.lips[index] ?? defaults.lips[index]!
    })
  }, [tune.lips])

  // One spring per lip. Hidden lips keep their rest x/rot and drift slightly
  // deeper (smaller + up) while opacity eases out — Apple Time Machine vibe.
  const [springs] = useSprings(
    STACK_BACK_VISIBLE,
    (index) => {
      const pose = lips[index]!
      const lipVisible = index < shown
      // Deeper lips already sit higher (more negative y); push further on exit.
      const exitY = pose.y - 10
      const exitScale = pose.scale * STACK_DISSOLVE_SCALE
      return {
        opacity: lipVisible ? 1 : 0,
        x: pose.x,
        y: lipVisible ? pose.y : exitY,
        scale: lipVisible ? pose.scale : exitScale,
        rot: pose.rot,
        config: STACK_DISSOLVE_SPRING,
      }
    },
    [lips, shown],
  )

  const baseTransform = `translate3d(0, ${tune.baseY}px, 0) scale3d(${tune.baseScale}, ${tune.baseScale}, 1)`

  return (
    <div
      className="swipe-deck__stack-backs"
      style={{
        zIndex,
        transform: baseTransform,
      }}
      aria-hidden="true"
    >
      {springs.map((spring, index) => {
        const i = index + 1
        const gray =
          STACK_BACK_GRAYS[index] ?? STACK_BACK_GRAYS[STACK_BACK_GRAYS.length - 1]
        return (
          <animated.div
            key={`stack-back-${i}`}
            className="swipe-deck__stack-back"
            style={{
              borderRadius: CARD_RADIUS,
              backgroundColor: gray,
              zIndex: STACK_BACK_TOTAL - i + 1,
              opacity: spring.opacity,
              transform: to(
                [spring.x, spring.y, spring.scale, spring.rot],
                composeLipTransform,
              ),
            }}
          />
        )
      })}
    </div>
  )
}
