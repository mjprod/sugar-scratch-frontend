import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { McpPhotoPlayCta } from "@/components/creator/McpPhotoPlayCta";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  LockStatusBanner,
  type LockStatus,
} from "@/components/lock-status/LockStatusBanner";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import "@/components/creator/motion-card-page.css";
import "@/components/creator/mcp-photo-play-cta-css.css";
import "./component-lab-photo-play-cta.css";
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
import {
  InfluencerHolder,
  InfluencerHolderSkeleton,
} from "@/components/collection/InfluencerHolder";
import { fetchCatalogPhotoCards } from "@/features/game/shared/catalog";
import { PackPreview } from "@/components/pack-preview/PackPreview";
import {
  PhotoGateway,
  type PhotoGatewayCard,
} from "@/components/photo-gateway/PhotoGateway";
import "@/components/pack-preview/PackPreview.css";
import {
  loadModels,
  modelAvatarUrl,
  modelDisplayName,
  modelId,
  profileFromModel,
} from "@/services/models";
import {
  collectionProgressFromBoard,
  loadCreatorBoard,
  type CollectionProgressCounts,
} from "@/services/creatorBoard";
import figmaPoster from "@/assets/component-lab/1e21a68ca6be26dfd06df3fc4951ef8f06b7f7d2.png";

function packPostersFromModel(
  model: Parameters<typeof profileFromModel>[0],
) {
  const name = modelDisplayName(model);
  return profileFromModel(model).packs.flatMap((pack) =>
    pack.posterUrl
      ? [{ src: pack.posterUrl, alt: `${name} ${pack.label}` }]
      : [],
  );
}

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
  const [packPosters, setPackPosters] = useState<
    Array<{ src: string; alt: string }>
  >([]);
  const [photoGatewayCards, setPhotoGatewayCards] = useState<
    PhotoGatewayCard[]
  >([]);
  const [photoGatewayCount, setPhotoGatewayCount] = useState({
    collected: 0,
    total: 0,
  });
  const [videoUrl, setVideoUrl] = useState("");
  const [staticState, setStaticState] =
    useState<StaticCardHolderState>("locked");
  const [staticBackgroundUrl, setStaticBackgroundUrl] = useState(figmaPoster);
  const [staticTopLayerUrl, setStaticTopLayerUrl] = useState("");
  const [staticPlayCost, setStaticPlayCost] = useState(30);
  const [staticCarouselItems, setStaticCarouselItems] = useState<
    StaticCarouselItem[]
  >([]);
  const [holderMode, setHolderMode] = useState<"live" | "skeleton">(
    "skeleton",
  );
  type LabCssCtaVariant = "default" | "gold" | "purple" | "black" | "red";
  const [cssCtaVariant, setCssCtaVariant] =
    useState<LabCssCtaVariant>("default");
  const [sliderCtaVariant, setSliderCtaVariant] =
    useState<LabCssCtaVariant>("default");
  const [dangerCtaDisabled, setDangerCtaDisabled] = useState(false);
  const [holderPreview, setHolderPreview] = useState<{
    name: string;
    place: string;
    avatarUrl: string;
    progress: CollectionProgressCounts;
  } | null>(null);
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
      .then(async (models) => {
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
        const posters = models.flatMap((model) => packPostersFromModel(model));
        setPackPosters(posters.slice(0, 2));
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
        const city = juliana.influencerCity?.trim() || "";
        const country = juliana.influencerCountry?.trim() || "";
        const id = modelId(juliana);
        const board = await loadCreatorBoard(id);
        if (cancelled) return;
        setHolderPreview({
          name: modelDisplayName(juliana),
          place: city && country ? `${city}, ${country}` : city || country,
          avatarUrl: modelAvatarUrl(juliana) || `/models/${id}/avatar.jpeg`,
          progress: collectionProgressFromBoard(board),
        });
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
        const creatorId =
          photos.find((entry) => entry.model_id === "julianaval")?.model_id ||
          photo.model_id ||
          "";
        const forCreator = creatorId
          ? photos.filter((entry) => entry.model_id === creatorId)
          : photos;
        const themeId =
          forCreator.find((entry) => entry.theme_id)?.theme_id ||
          photo.theme_id ||
          "";
        const gatewaySource = (
          themeId
            ? forCreator.filter((entry) => entry.theme_id === themeId)
            : forCreator
        );
        const themeCards = gatewaySource.length > 0 ? gatewaySource : forCreator;
        setPhotoGatewayCards(
          themeCards.flatMap((entry) => {
            const backgroundUrl = entry.background?.trim() || "";
            const topLayerUrl =
              entry.clothes?.trim() || entry.bikini?.trim() || "";
            if (!backgroundUrl && !topLayerUrl) return [];
            return [
              {
                id: entry.id,
                backgroundUrl: backgroundUrl || topLayerUrl,
                topLayerUrl,
                alt: entry.label,
              },
            ];
          }),
        );
        if (!creatorId) return;
        void loadCreatorBoard(creatorId).then((board) => {
          if (cancelled || !board) return;
          const theme =
            board.themes.find((entry) => entry.id === themeId) ??
            board.themes[0];
          if (!theme) return;
          const collected = theme.motionCards.reduce(
            (sum, card) =>
              sum +
              Math.max(
                card.staticCards.filter((slot) => slot.owned).length,
                card.staticCardsOwned,
              ),
            0,
          );
          const total = theme.motionCards.reduce(
            (sum, card) =>
              sum + (card.staticCardsTotal || card.staticCards.length),
            0,
          );
          setPhotoGatewayCount({ collected, total });
        });
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
              <h2 className="text-[15px] font-semibold">Photo play CTA</h2>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                Theme photo-grid button (84×41). Left = live BorderGlow +
                DiamondLottie. Right = CSS-only twin — variants in{" "}
                <code className="text-ink-secondary">
                  component-lab-photo-play-cta.css
                </code>
                .
              </p>
            </div>
            <label className="flex flex-col gap-1 text-[11px] font-medium tracking-[0.08em] text-ink-tertiary uppercase">
              CSS variant
              <select
                value={cssCtaVariant}
                onChange={(event) =>
                  setCssCtaVariant(event.target.value as LabCssCtaVariant)
                }
                className="min-w-[8.5rem] rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-[12px] font-medium tracking-normal text-ink normal-case"
              >
                <option value="default">Default (pink)</option>
                <option value="gold">Gold</option>
                <option value="purple">Purple</option>
                <option value="black">Black</option>
                <option value="red">Red</option>
              </select>
            </label>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-center gap-10 rounded-xl bg-[oklch(0.12_0_0)] px-6 py-12">
            <div className="flex flex-col items-center gap-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-ink-tertiary uppercase">
                Live
              </p>
              <div className="mcp-photo-play-cta-lab-card">
                <img src={staticBackgroundUrl || figmaPoster} alt="" />
                <McpPhotoPlayCta
                  playPrice={8}
                  ariaLabel="Play Photo Cards for 8 diamonds"
                  onPlay={() => undefined}
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-ink-tertiary uppercase">
                CSS · {cssCtaVariant}
              </p>
              <div className="mcp-photo-play-cta-lab-card">
                <img src={staticBackgroundUrl || figmaPoster} alt="" />
                <div
                  className={[
                    "mcp-photo-play-cta-css-wrap",
                    `mcp-photo-play-cta-css-wrap--${cssCtaVariant}`,
                  ].join(" ")}
                >
                  <button
                    type="button"
                    className={[
                      "mcp-photo-play-cta-css",
                      `mcp-photo-play-cta-css--${cssCtaVariant}`,
                    ].join(" ")}
                    aria-label="Play Photo Cards for 8 diamonds (CSS)"
                  >
                    <DiamondLottie
                      className="mcp-photo-play-cta-css__diamond"
                      size={16}
                      aria-hidden
                    />
                    <span className="mcp-photo-play-cta-css__price">8</span>
                    <Play
                      className="mcp-photo-play-cta-css__play"
                      size={16}
                      strokeWidth={2.4}
                      fill="currentColor"
                      aria-hidden
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">sliderCTACSS</h2>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                Coverflow Buy Pack (159×60 · 12px). Left = live BorderGlow
                squircle. Right = CSS twin from the photo-play plate — tweak in{" "}
                <code className="text-ink-secondary">
                  mcp-photo-play-cta-css.css
                </code>{" "}
                (<code className="text-ink-secondary">--slider</code>) or lab
                overrides.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-[11px] font-medium tracking-[0.08em] text-ink-tertiary uppercase">
              CSS variant
              <select
                value={sliderCtaVariant}
                onChange={(event) =>
                  setSliderCtaVariant(event.target.value as LabCssCtaVariant)
                }
                className="min-w-[8.5rem] rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-[12px] font-medium tracking-normal text-ink normal-case"
              >
                <option value="default">Default (pink)</option>
                <option value="gold">Gold</option>
                <option value="purple">Purple</option>
                <option value="black">Black</option>
                <option value="red">Red</option>
              </select>
            </label>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-center gap-10 rounded-xl bg-[oklch(0.12_0_0)] px-6 py-12">
            <div className="flex flex-col items-center gap-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-ink-tertiary uppercase">
                Live
              </p>
              <CtaButton
                {...ctaButtonPropsFromTemplate("squircleCTA")}
                width={159}
                height={60}
                cornerRadius={12}
                strokeWidth={2}
                auroraBaseColor="#42001b"
                auroraColorStops={["#aa3c6b", "#ea2e89", "#42001b", "#933e4c"]}
                auroraRotation={45}
                glowColors={["#aa085f", "#e00083", "#eb6a00"]}
                glowColor="326 90 30"
                strokeColor="rgba(170, 8, 95, 0.42)"
                labelColor="#ffe0e8"
                auroraPaused
                glowAlwaysOn={false}
                glowOuterBloom="off"
                costIconAnimated={false}
                label="Buy Pack"
                costAmount={80}
                style={{ ["--cta-aurora-angle" as string]: "45deg" }}
              />
            </div>
            <div className="flex flex-col items-center gap-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-ink-tertiary uppercase">
                CSS · {sliderCtaVariant}
              </p>
              <div
                className={[
                  "mcp-photo-play-cta-css-wrap",
                  "mcp-photo-play-cta-css-wrap--slider",
                  `mcp-photo-play-cta-css-wrap--${sliderCtaVariant}`,
                ].join(" ")}
              >
                <button
                  type="button"
                  className={[
                    "mcp-photo-play-cta-css",
                    "mcp-photo-play-cta-css--slider",
                    `mcp-photo-play-cta-css--${sliderCtaVariant}`,
                  ].join(" ")}
                  aria-label="Buy Pack for 80 diamonds (CSS)"
                >
                  <span className="mcp-photo-play-cta-css__label">Buy Pack</span>
                  <span className="mcp-photo-play-cta-css__cost">
                    <span className="mcp-photo-play-cta-css__price">80</span>
                    <DiamondLottie
                      className="mcp-photo-play-cta-css__diamond"
                      size={16}
                      aria-hidden
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Danger CSS CTA</h2>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                Red plate used by Delete account (
                <code className="text-ink-secondary">cssTone=&quot;red&quot;</code>
                ). Disabled → black plate + paused motion.
              </p>
            </div>
            <label className="flex items-center gap-2 text-[12px] font-medium text-ink-secondary">
              <input
                type="checkbox"
                checked={dangerCtaDisabled}
                onChange={(event) => setDangerCtaDisabled(event.target.checked)}
              />
              Disabled
            </label>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-center gap-10 rounded-xl bg-[oklch(0.12_0_0)] px-6 py-12">
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-ink-tertiary uppercase">
                {dangerCtaDisabled ? "Disabled" : "Red"}
              </p>
              <div className="mcp-photo-play-cta-lab-danger">
                <CtaButton
                  forceCss
                  cssTone="red"
                  fillParent
                  type="button"
                  label="Delete account"
                  costAmount={null}
                  strokeWidth={1}
                  cornerRadius={16}
                  disabled={dangerCtaDisabled}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Influencer holder</h2>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                Collect page row · avatar, name, counts, progress.
              </p>
            </div>
            <div className="flex rounded-full bg-surface-muted p-0.5">
              {(
                [
                  ["skeleton", "Skeleton"],
                  ["live", "Live"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHolderMode(value)}
                  className={[
                    "rounded-full px-3 py-1 text-[12px] font-medium transition",
                    holderMode === value
                      ? "bg-white text-black"
                      : "text-ink-secondary hover:text-ink",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <div className="mx-auto w-full max-w-[400px]">
              {holderMode === "skeleton" ? (
                <div className="mc-model-list">
                  <InfluencerHolderSkeleton />
                  <InfluencerHolderSkeleton />
                </div>
              ) : holderPreview ? (
                <InfluencerHolder
                  name={holderPreview.name}
                  place={holderPreview.place}
                  avatarUrl={holderPreview.avatarUrl}
                  progress={holderPreview.progress}
                />
              ) : (
                <p className="text-center text-[12px] text-ink-tertiary">
                  Waiting for a creator from /api/models.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Photo gateway</h2>
            <p className="mt-1 text-[12px] text-ink-tertiary">
              Creator photo cards from /api/photo-scratch, scattered behind the
              collection CTA.
            </p>
          </div>
          <div className="mt-6 grid place-items-center rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            {photoGatewayCards.length > 0 ? (
              <PhotoGateway
                cards={photoGatewayCards}
                collected={photoGatewayCount.collected}
                total={photoGatewayCount.total}
              />
            ) : (
              <p className="text-[12px] text-ink-tertiary">
                Waiting for this creator&apos;s photo cards.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Pack preview</h2>
            <p className="mt-1 text-[12px] text-ink-tertiary">
              Two creator pack posters from /api/models.
            </p>
          </div>
          <div className="mt-6 grid place-items-center rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            {packPosters.length >= 2 ? (
              <PackPreview left={packPosters[0]!} right={packPosters[1]!} />
            ) : (
              <p className="text-[12px] text-ink-tertiary">
                Waiting for two creator posters.
              </p>
            )}
          </div>
        </section>

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
