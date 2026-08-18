import { animated, useSpring } from "@react-spring/web";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SwipeCircle } from "@/features/swipe/components/SwipeCircle";
import { SwipeDeck } from "@/features/swipe/components/SwipeDeck";
import { VideoPreloader } from "@/features/swipe/components/VideoPreloader";
import {
  STACK_DISSOLVE_SCALE,
  STACK_DISSOLVE_SPRING,
  type SwipeCardData,
} from "@/features/swipe/constants/cards";
import { NopeTintDebugProvider } from "@/features/swipe/context/NopeTintDebugContext";
import { StackBacksDebugProvider } from "@/features/swipe/context/StackBacksDebugContext";
import { SwipeCircleDebugProvider } from "@/features/swipe/context/SwipeCircleDebugContext";
import { fetchModels } from "@/shared/backend/collection";
import {
  createFallbackSwipeDeck,
  createSwipeDeckFromModels,
} from "@/shared/backend/modelProfile";
import "@/features/swipe/swipe.css";
import { useMarkPageReady } from "@/shared/ui/PageTransition";

export type PersonalizationSwipeResult = {
  liked: string[];
  passed: string[];
};

/**
 * Incoming home swipe deck, used as Recommendation Initialization.
 * Continue when the stack is empty.
 */
export function PersonalizationSwipeScreen({
  onContinue,
}: {
  onContinue: (result: PersonalizationSwipeResult) => void;
}) {
  const [deck, setDeck] = useState<SwipeCardData[]>([]);
  const [productReady, setProductReady] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  useMarkPageReady(productReady && mediaReady);
  const [liked, setLiked] = useState<string[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const likedRef = useRef(liked);
  const passedRef = useRef(passed);
  likedRef.current = liked;
  passedRef.current = passed;

  useEffect(() => {
    let cancelled = false;
    void fetchModels()
      .then((models) => {
        if (cancelled) return;
        const fromModels = createSwipeDeckFromModels(models ?? []);
        setDeck(
          fromModels.length > 0 ? fromModels : createFallbackSwipeDeck(),
        );
        setProductReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDeck(createFallbackSwipeDeck());
        setProductReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deckSignature = useMemo(
    () => deck.map((card) => `${card.id}:${card.mediaUrl}`).join("|"),
    [deck],
  );

  useEffect(() => {
    setMediaReady(false);
  }, [deckSignature]);

  const handleMediaReady = useCallback(() => setMediaReady(true), []);

  const snapshot = useCallback(
    (): PersonalizationSwipeResult => ({
      liked: likedRef.current,
      passed: passedRef.current,
    }),
    [],
  );

  const handleSwipe = useCallback((card: SwipeCardData, dir: 1 | -1) => {
    const id = card.modelId?.trim() || card.id;
    if (dir === 1) setLiked((prev) => [...prev, id]);
    else setPassed((prev) => [...prev, id]);
  }, []);

  const stageStyle = useSpring({
    opacity: mediaReady ? 1 : 0,
    scale: mediaReady ? 1 : STACK_DISSOLVE_SCALE,
    config: STACK_DISSOLVE_SPRING,
  });

  if (!productReady) return null;

  return (
    <StackBacksDebugProvider>
      <SwipeCircleDebugProvider>
        <NopeTintDebugProvider>
          <div className="stage-swipe auth7-rec-swipe">
            <SwipeCircle />
            <div className="home">
              <VideoPreloader cards={deck} onReady={handleMediaReady} />
              <animated.div
                className="home__stage"
                style={{
                  opacity: stageStyle.opacity,
                  transform: stageStyle.scale.to(
                    (s) => `translate3d(0, 0, 0) scale3d(${s}, ${s}, 1)`,
                  ),
                  pointerEvents: mediaReady ? "auto" : "none",
                }}
              >
                <SwipeDeck
                  key={deckSignature}
                  initialCards={deck}
                  playSwipeHint={mediaReady}
                  onSwipe={handleSwipe}
                  onContinue={() => onContinue(snapshot())}
                  continueLabel="Continue"
                />
              </animated.div>
            </div>
          </div>
        </NopeTintDebugProvider>
      </SwipeCircleDebugProvider>
    </StackBacksDebugProvider>
  );
}
