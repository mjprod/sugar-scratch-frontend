import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useState } from "react";
import { LightScreen } from "../components/PhoneShell";
import { Button, HomeIndicator } from "../components/ui";
import { DEMO_CREATORS, MIN_PREF_SWIPES } from "../flow/types";
import { PREFERENCE_PHOTOS } from "../flow/photos";

export function PreferenceSwipeScreen({
  onDone,
  onSkip,
}: {
  onDone: (result: { liked: string[]; passed: string[] }) => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const decisions = liked.length + passed.length;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-160, 160], [-12, 12]);
  const likeOpacity = useTransform(x, [40, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -40], [1, 0]);

  function finish(nextLiked: string[], nextPassed: string[]) {
    onDone({ liked: nextLiked, passed: nextPassed });
  }

  function decide(kind: "like" | "pass") {
    const creator = DEMO_CREATORS[index];
    if (!creator) return;
    const nextLiked = kind === "like" ? [...liked, creator.id] : liked;
    const nextPassed = kind === "pass" ? [...passed, creator.id] : passed;
    const nextDecisions = nextLiked.length + nextPassed.length;

    if (nextDecisions >= MIN_PREF_SWIPES || index >= DEMO_CREATORS.length - 1) {
      finish(nextLiked, nextPassed);
      return;
    }
    setLiked(nextLiked);
    setPassed(nextPassed);
    setIndex((i) => i + 1);
    x.set(0);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 100) decide("like");
    else if (info.offset.x < -100) decide("pass");
  }

  const creator = DEMO_CREATORS[index];
  const progress = Math.min(decisions, MIN_PREF_SWIPES);

  return (
    <LightScreen>
      <div className="flex flex-1 flex-col px-6 pt-12">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-ink-secondary">
            {progress}/{MIN_PREF_SWIPES} preferences
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="text-[14px] font-semibold text-ink-tertiary"
          >
            Skip
          </button>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] transition-all"
            style={{ width: `${(progress / MIN_PREF_SWIPES) * 100}%` }}
          />
        </div>

        <div className="relative mt-8 flex flex-1 items-center justify-center">
          <AnimatePresence mode="wait">
            {creator ? (
              <motion.div
                key={creator.id}
                style={{ x, rotate }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={onDragEnd}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative h-[420px] w-full max-w-[300px] cursor-grab active:cursor-grabbing"
              >
                <div className="absolute inset-0 overflow-hidden rounded-[28px] bg-[#151515] shadow-float">
                  <img
                    src={PREFERENCE_PHOTOS[index % PREFERENCE_PHOTOS.length]}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <motion.div
                    style={{ opacity: likeOpacity }}
                    className="absolute top-6 left-6 rounded-full border-2 border-[#34D399] px-3 py-1 text-[13px] font-bold text-[#34D399]"
                  >
                    LIKE
                  </motion.div>
                  <motion.div
                    style={{ opacity: passOpacity }}
                    className="absolute top-6 right-6 rounded-full border-2 border-white/80 px-3 py-1 text-[13px] font-bold text-white"
                  >
                    PASS
                  </motion.div>
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h2 className="text-[28px] font-bold text-white">
                      {creator.name}
                    </h2>
                    <p className="mt-1 text-[14px] text-white/65">{creator.tag}</p>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mb-2 flex justify-center gap-4">
          <Button
            variant="ghost"
            className="h-14 w-14 rounded-full border-line px-0 text-nope"
            onClick={() => decide("pass")}
            aria-label="Pass"
          >
            ✕
          </Button>
          <Button
            variant="ghost"
            className="h-14 rounded-full px-5 text-ink-tertiary"
            onClick={onSkip}
          >
            Skip
          </Button>
          <Button
            variant="primary"
            className="h-14 w-14 rounded-full px-0"
            onClick={() => decide("like")}
            aria-label="Like"
          >
            ♥
          </Button>
        </div>
        <HomeIndicator />
      </div>
    </LightScreen>
  );
}
