import { useEffect, useState } from "react";
import {
  LockStatusBanner,
  type LockStatus,
} from "@/components/lock-status/LockStatusBanner";
import {
  MOTION_CARD_THEMES,
  MotionCard,
  type MotionCardState,
  type MotionCardTheme,
} from "@/components/motion-card/MotionCard";
import { loadModels, profileFromModel } from "@/services/models";
import figmaPoster from "@/assets/component-lab/1e21a68ca6be26dfd06df3fc4951ef8f06b7f7d2.png";

const MOTION_STATES: Array<[MotionCardState, string]> = [
  ["locked-unselected", "Locked unselected"],
  ["locked-unselected-banner", "Locked unselected banner"],
  ["locked-selected", "Locked selected"],
  ["unlocked-unselected", "Unlocked unselected"],
  ["unlocked-selected", "Unlocked selected"],
];

/**
 * Isolated workshop at `/component-lab`.
 * No app chrome — we build pieces here one at a time.
 */
export function ComponentLabPage() {
  const [lockStatus, setLockStatus] = useState<LockStatus>("unlocked");
  const [motionState, setMotionState] =
    useState<MotionCardState>("locked-unselected");
  const [motionTheme, setMotionTheme] = useState<MotionCardTheme>("police");
  const [posterUrl, setPosterUrl] = useState(figmaPoster);
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadModels()
      .then((models) => {
        if (cancelled) return;
        const juliana =
          models.find((model) => model.id === "julianaval") ?? models[0];
        if (!juliana) return;
        const profile = profileFromModel(juliana);
        const pack = profile.packs[0];
        const nextPoster =
          juliana.ultraCardTrailerPosterUrl?.trim() ||
          pack?.posterUrl?.trim() ||
          juliana.swipePosterUrl?.trim() ||
          "";
        const nextVideo =
          juliana.ultraCardTrailerUrl?.trim() ||
          pack?.videoUrl?.trim() ||
          juliana.swipeVideoUrl?.trim() ||
          "";
        if (nextPoster) setPosterUrl(nextPoster);
        if (nextVideo) setVideoUrl(nextVideo);
      })
      .catch(() => {
        /* Keep the Figma still if the API is down. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 px-6 py-5 backdrop-blur-md">
        <p className="text-[11px] font-medium tracking-[0.18em] text-ink-tertiary uppercase">
          Workshop
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
          Component lab
        </h1>
        <p className="mt-1 max-w-xl text-[13px] text-ink-secondary">
          Sandbox for assembling Figma pieces one by one. Production routes stay
          untouched.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Lock status banner</h2>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                Figma 243:8741 · Unlocked / Locked / min-unlocked.
              </p>
            </div>
            <div className="flex rounded-full bg-surface-muted p-0.5">
              {(
                [
                  ["unlocked", "Unlocked"],
                  ["locked", "Locked"],
                  ["min-unlocked", "Min unlocked"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLockStatus(value)}
                  className={[
                    "rounded-full px-3 py-1 text-[12px] font-medium transition",
                    lockStatus === value
                      ? "bg-white text-black"
                      : "text-ink-secondary hover:text-ink",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid place-items-center rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <LockStatusBanner status={lockStatus} />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Motion card</h2>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                Figma 229:3873 · poster / video from `/api/models`, CTA clipped
                to the tile.
              </p>
            </div>
            <div className="flex flex-wrap rounded-full bg-surface-muted p-0.5">
              {MOTION_STATES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMotionState(value)}
                  className={[
                    "rounded-full px-3 py-1 text-[12px] font-medium transition",
                    motionState === value
                      ? "bg-white text-black"
                      : "text-ink-secondary hover:text-ink",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap rounded-full bg-surface-muted p-0.5">
            {MOTION_CARD_THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => setMotionTheme(theme)}
                className={[
                  "rounded-full px-3 py-1 text-[12px] font-medium capitalize transition",
                  motionTheme === theme
                    ? "bg-white text-black"
                    : "text-ink-secondary hover:text-ink",
                ].join(" ")}
              >
                {theme}
              </button>
            ))}
          </div>

          <div className="mt-6 grid place-items-center rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <MotionCard
              state={motionState}
              theme={motionTheme}
              posterUrl={posterUrl}
              videoUrl={videoUrl}
              onSelect={setMotionState}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
