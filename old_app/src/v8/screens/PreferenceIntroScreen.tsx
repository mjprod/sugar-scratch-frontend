import { motion } from "framer-motion";
import { LightScreen } from "../components/PhoneShell";
import { Button, HomeIndicator } from "../components/ui";
import { PREFERENCE_PHOTOS } from "../flow/photos";

export function PreferenceIntroScreen({
  onStart,
  onBack,
}: {
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <LightScreen>
      <div className="flex flex-1 flex-col px-6 pt-14">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-[14px] font-semibold text-brand"
        >
          ← Back
        </button>

        <h1 className="mt-8 text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">
          Swipe to teach Sugar
        </h1>
        <p className="mt-3 text-[15px] text-ink-secondary">
          A few quick swipes help us recommend creators you’ll love.
        </p>

        <div className="mt-10 flex flex-1 flex-col items-center justify-center gap-6">
          <div className="flex w-full max-w-[280px] gap-3">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-1 flex-col items-center rounded-[20px] border border-line bg-surface-muted p-4"
            >
              <span className="text-[28px]">👈</span>
              <p className="mt-2 text-[13px] font-semibold">Swipe left</p>
              <p className="mt-1 text-center text-[12px] text-ink-tertiary">
                Not interested
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-1 flex-col items-center rounded-[20px] border border-line bg-surface-muted p-4"
            >
              <span className="text-[28px]">👉</span>
              <p className="mt-2 text-[13px] font-semibold">Swipe right</p>
              <p className="mt-1 text-center text-[12px] text-ink-tertiary">
                Interested
              </p>
            </motion.div>
          </div>

          <div className="relative h-[180px] w-[140px]">
            <img
              src={PREFERENCE_PHOTOS[2]}
              alt=""
              className="absolute inset-0 translate-x-3 rotate-6 rounded-2xl object-cover opacity-60"
            />
            <img
              src={PREFERENCE_PHOTOS[1]}
              alt=""
              className="absolute inset-0 -translate-x-2 -rotate-3 rounded-2xl object-cover opacity-80"
            />
            <img
              src={PREFERENCE_PHOTOS[0]}
              alt=""
              className="absolute inset-0 rounded-2xl object-cover shadow-card"
            />
          </div>
        </div>

        <Button full variant="primary" onClick={onStart}>
          Start
        </Button>
        <HomeIndicator />
      </div>
    </LightScreen>
  );
}
