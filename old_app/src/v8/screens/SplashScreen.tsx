import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button, HomeIndicator } from "../components/ui";
import { SPLASH_PHOTOS } from "../flow/photos";
import { SPLASH_SLIDES } from "../flow/types";

export function SplashScreen({
  onContinue,
  onSignIn,
}: {
  onContinue: () => void;
  onSignIn: () => void;
}) {
  const [index, setIndex] = useState(0);
  const slide = SPLASH_SLIDES[index];
  const isLast = index >= SPLASH_SLIDES.length - 1;

  function primary() {
    if (isLast) onContinue();
    else setIndex((i) => i + 1);
  }

  return (
    <section className="relative flex flex-1 flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={SPLASH_PHOTOS[index]}
          src={SPLASH_PHOTOS[index]}
          alt=""
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="absolute inset-0 size-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/75 to-[#090909]/25" />

      <div className="relative z-10 flex flex-1 flex-col px-6 pt-16 pb-3">
        <div className="flex flex-1 flex-col items-center justify-end pb-8 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-[28ch]"
            >
              <p className="text-[12px] font-semibold tracking-[0.2em] text-white/50 uppercase">
                Sugar Scratch
              </p>
              <h1 className="mt-3 text-[40px] leading-none font-bold tracking-[-0.02em] text-white">
                {slide.title}
              </h1>
              <p className="mt-4 text-[16px] leading-relaxed text-white/72">{slide.hook}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mb-5 flex justify-center gap-2">
          {SPLASH_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={[
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-[#8B5CF6]" : "w-2 bg-white/25",
              ].join(" ")}
            />
          ))}
        </div>

        <Button full variant="primary" className="h-14" onClick={primary}>
          {slide.cta}
        </Button>
        {isLast ? (
          <p className="mt-3 text-center text-[13px] text-white/55">
            Already collecting?{" "}
            <button type="button" className="font-semibold text-[#EC4899]" onClick={onSignIn}>
              Login
            </button>
          </p>
        ) : (
          <button
            type="button"
            className="mt-3 text-[13px] font-medium text-white/45"
            onClick={onContinue}
          >
            Skip
          </button>
        )}
        <HomeIndicator dark />
      </div>
    </section>
  );
}
