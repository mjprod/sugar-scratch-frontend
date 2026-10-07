import { useEffect, useState } from "react";
import {
  LockStatusBanner,
  type LockStatus,
} from "@/components/lock-status/LockStatusBanner";
import {
  MOTION_CARD_THEMES,
  type MotionCardState,
  type MotionCardTheme,
} from "@/components/motion-card/MotionCard";
import { ActiveMotion } from "@/components/motion-card/ActiveMotion";
import { MotionCardHolder } from "@/components/motion-card/MotionCardHolder";
import { MotionCardStack } from "@/components/motion-card/MotionCardStack";
import {
  ThreeMotion,
  type ThreeMotionItem,
} from "@/components/motion-card/ThreeMotion";
import {
  StaticCardHolder,
  type StaticCardHolderState,
} from "@/components/static-card/StaticCardHolder";
import {
  StaticCarousel,
  type StaticCarouselItem,
} from "@/components/static-card/StaticCarousel";
import { fetchCatalogPhotoCards } from "@/features/game/shared/catalog";
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
  const [staticState, setStaticState] =
    useState<StaticCardHolderState>("locked");
  const [staticBackgroundUrl, setStaticBackgroundUrl] = useState(figmaPoster);
  const [staticTopLayerUrl, setStaticTopLayerUrl] = useState("");
  const [staticPlayCost, setStaticPlayCost] = useState(30);
  const [staticCarouselItems, setStaticCarouselItems] = useState<
    StaticCarouselItem[]
  >([]);
  const [threeItems, setThreeItems] = useState<ThreeMotionItem[]>([
    {
      id: "left",
      state: "locked-unselected-banner",
      theme: "police",
      posterUrl: figmaPoster,
      collectedIndexes: [2, 3, 6],
    },
    {
      id: "center",
      state: "unlocked-unselected",
      theme: "police",
      posterUrl: figmaPoster,
      collectedIndexes: [2, 3, 6],
    },
    {
      id: "right",
      state: "locked-unselected-banner",
      theme: "police",
      posterUrl: figmaPoster,
      collectedIndexes: [2, 3, 6],
    },
  ]);

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
        if (nextPoster || nextVideo) {
          setThreeItems((current) =>
            current.map((item) => ({
              ...item,
              posterUrl: nextPoster || item.posterUrl,
              videoUrl: nextVideo || item.videoUrl,
            })),
          );
        }
      })
      .catch(() => {
        /* Keep the Figma still if the API is down. */
      });
    void fetchCatalogPhotoCards()
      .then((photos) => {
        if (cancelled) return;
        const photo = photos[0];
        if (!photo) return;
        const background = photo.background?.trim() || "";
        const topLayer = photo.clothes?.trim() || photo.bikini?.trim() || "";
        if (background) setStaticBackgroundUrl(background);
        if (topLayer) setStaticTopLayerUrl(topLayer);
        if (typeof photo.cardPrice === "number") {
          setStaticPlayCost(photo.cardPrice);
        }
        setStaticCarouselItems(
          photos.slice(0, 10).map((entry, index) => ({
            id: entry.id || `static-${index}`,
            state: index % 3 === 1 ? "unlocked" : "locked",
            backgroundUrl:
              entry.background?.trim() ||
              entry.clothes?.trim() ||
              figmaPoster,
            topLayerUrl: entry.clothes?.trim() || entry.bikini?.trim() || "",
            playCost:
              typeof entry.cardPrice === "number"
                ? entry.cardPrice
                : 30,
          })),
        );
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
                Figma 229:3873 + 229:3123 · motion tile with static-card meter.
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
            <MotionCardStack
              state={motionState}
              theme={motionTheme}
              posterUrl={posterUrl}
              videoUrl={videoUrl}
              onSelect={setMotionState}
              collectedIndexes={[2, 3, 6]}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Three motion</h2>
            <p className="mt-1 text-[12px] text-ink-tertiary">
              Figma 229:2546 · three 108px stacks in a 335px row.
            </p>
          </div>

          <div className="mt-6 grid place-items-center overflow-x-auto rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <ThreeMotion
              items={threeItems}
              onSelect={(id, next) =>
                setThreeItems((current) =>
                  current.map((item) =>
                    item.id === id ? { ...item, state: next } : item,
                  ),
                )
              }
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Static card holder</h2>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                Figma 227:571 · photo card from catalog, play CTA under the
                image.
              </p>
            </div>
            <div className="flex rounded-full bg-surface-muted p-0.5">
              {(["locked", "unlocked"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStaticState(value)}
                  className={[
                    "rounded-full px-3 py-1 text-[12px] font-medium capitalize transition",
                    staticState === value
                      ? "bg-white text-black"
                      : "text-ink-secondary hover:text-ink",
                  ].join(" ")}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid place-items-center rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <StaticCardHolder
              state={staticState}
              backgroundUrl={staticBackgroundUrl}
              topLayerUrl={staticTopLayerUrl}
              playCost={staticPlayCost}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Static carousel</h2>
            <p className="mt-1 text-[12px] text-ink-tertiary">
              Three holders visible · snap-scroll through catalog photo cards.
            </p>
          </div>

          <div className="mt-6 grid place-items-center rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <StaticCarousel
              items={staticCarouselItems}
              theme={motionTheme}
              motionCardNumber={1}
              motionCardTotal={3}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Active motion</h2>
            <p className="mt-1 text-[12px] text-ink-tertiary">
              Motion card + static carousel in two columns.
            </p>
          </div>

          <div className="mt-6 grid place-items-center overflow-x-auto rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <ActiveMotion
              state={motionState}
              theme={motionTheme}
              posterUrl={posterUrl}
              videoUrl={videoUrl}
              onSelect={setMotionState}
              photos={staticCarouselItems}
              motionCardNumber={1}
              motionCardTotal={3}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Motion card holder</h2>
            <p className="mt-1 text-[12px] text-ink-tertiary">
              Three-up row · click a card to expand into Active Motion.
            </p>
          </div>

          <div className="mt-6 grid place-items-center overflow-x-auto rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <MotionCardHolder
              items={threeItems}
              photos={staticCarouselItems}
              onItemSelect={(id, next) =>
                setThreeItems((current) =>
                  current.map((item) =>
                    item.id === id ? { ...item, state: next } : item,
                  ),
                )
              }
            />
          </div>
        </section>
      </main>
    </div>
  );
}
