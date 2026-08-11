import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  CloudOff,
  Gem,
  Layers3,
  Loader2,
  PackageOpen,
  Sparkles,
  TimerOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HolographicPackCard } from "@/components/HolographicPackCard";
import { FoilPackFace } from "@/components/purchase/FoilPackFace";
import { CoverFlowCarousel } from "@/features/packs/CoverFlowCarousel";
import { packItemToIteration } from "@/features/packs/types";
import "@/features/packs/packs.css";
import { CardFan } from "@/features/reveal/components/CardFan";
import { useRevealSequence } from "@/features/reveal/hooks/useRevealSequence";
import {
  createMixedCategoryPackCards,
  type RevealCard,
} from "@/features/reveal/lib/cards";
import { loadFanDrag } from "@/features/reveal/lib/fanDrag";
import { loadFanLayout } from "@/features/reveal/lib/fanLayout";
import "@/features/reveal/reveal.css";
import { PACK_MODEL_URL } from "@/lib/pack3d";
import { PACK_PHOTOS } from "@/lib/photos";
import {
  isVideoSrc,
  loadModelProfile,
  type FoilPack,
  type ModelProfile,
} from "@/services/models";
import {
  fetchPackFanCatalog,
  type BackendFanCatalog,
} from "@/shared/backend/collection";
import {
  PACK_OPTIONS,
  PurchaseError,
  clearOpening,
  loadOpeningAssets,
  nextUnscratchedIndex,
  packCost,
  restoreOpening,
  saveOpening,
  buildFoilOpeningSession,
  submitPurchase,
  type OpeningSession,
  type OpeningStage,
  type PackQuantity,
  type PurchaseFlowPack,
} from "@/services/purchase";

type Stage =
  | "choose"
  | "select"
  | "ready"
  | "reveal"
  | "preview"
  | "grid"
  | "scratch"
  | "complete"
  | "load-failed"
  | "no-packs"
  | "expired";

type Modal = null | "insufficient" | "failed";

const PERSISTED_STAGES: OpeningStage[] = [
  "ready",
  "reveal",
  "preview",
  "grid",
  "scratch",
  "complete",
];

export function PurchaseFlow({
  pack,
  diamonds,
  onClose,
  onSpend,
  onComplete,
  onGetDiamonds,
  onGoHome,
  onViewCollection,
  onGoMyBag,
}: {
  pack: PurchaseFlowPack;
  diamonds: number;
  onClose: () => void;
  onSpend: (diamonds: number) => void;
  onComplete: (result: { cards: number; coins: number }) => void;
  onGetDiamonds?: () => void;
  onGoHome?: () => void;
  onViewCollection?: () => void;
  onGoMyBag?: () => void;
}) {
  const noPacksLeft = pack.entry === "open" && (pack.unopenedPacks ?? 0) <= 0;
  const buying = pack.entry !== "open";
  const restored = useRef(
    noPacksLeft || buying
      ? ({ status: "none" } as const)
      : restoreOpening(pack.packId),
  ).current;

  const resumed = restored.status === "resume" ? restored.data : null;
  const resumeIndex = resumed
    ? nextUnscratchedIndex(resumed.session, resumed.scratched)
    : null;

  const [stage, setStage] = useState<Stage>(() => {
    if (noPacksLeft) return "no-packs";
    if (buying) return "choose";
    if (restored.status === "expired") return "expired";
    if (resumed) return resumeIndex === null ? "complete" : resumed.stage;
    return "select";
  });
  const [model, setModel] = useState<ModelProfile | null>(null);
  const [pendingFoil, setPendingFoil] = useState<FoilPack | null>(null);
  const lastFoilRef = useRef<FoilPack | null>(null);
  const [session, setSession] = useState<OpeningSession | null>(
    resumed?.session ?? null,
  );
  const [selectedCard, setSelectedCard] = useState(
    resumeIndex ?? resumed?.cardIndex ?? 0,
  );
  const [scratched, setScratched] = useState<string[]>(resumed?.scratched ?? []);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PackQuantity | null>(null);
  const [retrying, setRetrying] = useState(false);

  const awarded = useRef(Boolean(resumed && resumeIndex === null));
  const packImage =
    session?.foilFaceUrl ?? PACK_PHOTOS[pack.packId] ?? PACK_PHOTOS.ep1;
  const packDisplayName = session?.foilLabel ?? pack.packName;
  const cardImages = useMemo(() => {
    const faces = session?.cards
      .map((card) => card.faceUrl)
      .filter((url): url is string => Boolean(url));
    if (faces?.length) return faces;
    return Object.values(PACK_PHOTOS).slice(0, 8);
  }, [session]);

  useEffect(() => {
    if (!buying) return;
    void loadModelProfile(pack.packId, pack.creator).then((profile) => {
      setModel(profile);
      if (!profile?.packs.length) setStage((current) => (current === "choose" ? "select" : current));
    });
  }, [buying, pack.creator, pack.packId]);

  // A session we cannot restore is not worth keeping around.
  useEffect(() => {
    if (stage === "expired") clearOpening();
  }, [stage]);

  // Persist progress so an interrupted opening resumes where it stopped.
  useEffect(() => {
    if (!session) return;
    if (!PERSISTED_STAGES.includes(stage as OpeningStage)) return;
    saveOpening({
      packId: pack.packId,
      session,
      stage: stage as OpeningStage,
      cardIndex: selectedCard,
      scratched,
    });
  }, [stage, session, selectedCard, scratched, pack.packId]);

  async function purchase(quantity: PackQuantity, foil?: FoilPack) {
    if (submitting) return;
    const cost = packCost(quantity);
    if (cost > diamonds) {
      setModal("insufficient");
      return;
    }
    setSubmitting(true);
    setPending(quantity);
    if (foil) {
      lastFoilRef.current = foil;
      setPendingFoil(foil);
    }
    try {
      const next = foil
        ? {
            ...buildFoilOpeningSession([foil], cost),
            foilFaceUrl: foil.videoUrl,
            foilLabel: foil.label,
          }
        : await submitPurchase(quantity, diamonds);
      onSpend(next.diamondCost);
      setSession(next);
      setScratched([]);
      setSelectedCard(0);
      awarded.current = false;
      await loadOpeningAssets();
      setStage("ready");
    } catch (error) {
      const kind = error instanceof PurchaseError ? error.kind : "failed";
      if (kind === "insufficient") setModal("insufficient");
      else if (kind === "assets") setStage("load-failed");
      else setModal("failed");
    } finally {
      setSubmitting(false);
      setPending(null);
      setPendingFoil(null);
    }
  }

  async function retryPackLoad() {
    if (retrying) return;
    setRetrying(true);
    try {
      await loadOpeningAssets();
      setStage(session ? "ready" : model?.packs.length ? "choose" : "select");
    } catch {
      setStage("load-failed");
    } finally {
      setRetrying(false);
    }
  }

  function scratch(amount = 34) {
    setScratchProgress((value) => Math.min(100, value + amount));
  }

  function finishSession(current: OpeningSession) {
    if (!awarded.current) {
      awarded.current = true;
      onComplete({
        cards: current.cards.length,
        coins: current.cards.reduce((total, card) => total + card.reward, 0),
      });
    }
    setStage("complete");
  }

  function nextCard() {
    if (!session) return;
    const card = session.cards[selectedCard];
    const nextScratched =
      card && !scratched.includes(card.id) ? [...scratched, card.id] : scratched;
    setScratched(nextScratched);

    const next = nextUnscratchedIndex(session, nextScratched);
    if (next === null) {
      finishSession(session);
      return;
    }
    setSelectedCard(next);
    setScratchProgress(0);
  }

  // Ends the session for good — plain back-out keeps it so the opening resumes.
  function exit(destination?: () => void) {
    clearOpening();
    (destination ?? onClose)();
  }

  const terminal =
    stage === "complete" ||
    stage === "no-packs" ||
    stage === "expired" ||
    stage === "load-failed";

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Pack purchase and opening"
      className="absolute inset-0 z-50 flex min-h-0 flex-col overflow-hidden bg-[#090909]"
    >
      <header
        className={[
          "relative z-20 flex h-16 shrink-0 items-center px-4",
          stage === "choose" || stage === "reveal"
            ? "absolute inset-x-0 top-0 border-transparent bg-transparent"
            : "border-b border-white/[0.08]",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onClose}
          className="grid size-11 place-items-center rounded-full text-white/75 hover:bg-white/10"
          aria-label="Close purchase flow"
        >
          <ChevronLeft className="size-5" />
        </button>
        {stage === "choose" || stage === "reveal" ? null : (
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <p className="text-[13px] font-semibold">{stageTitle(stage)}</p>
            {terminal ? null : (
              <p className="text-[10px] text-white/40">{stageStep(stage)} of 4</p>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
          <Gem className="size-3.5 text-sky-300" />
          <span className="text-[12px] font-semibold tabular-nums">{diamonds}</span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={[
            "flex min-h-0 flex-1 flex-col",
            stage === "choose" || stage === "reveal"
              ? "overflow-hidden"
              : "overflow-y-auto",
          ].join(" ")}
        >
          {stage === "choose" ? (
            <ChoosePackStage
              packs={model?.packs ?? []}
              modelId={model?.id ?? pack.packId}
              girlName={model?.name ?? pack.creator}
              submitting={submitting}
              diamondCost={packCost(1)}
              onOpen={(foil) => void purchase(1, foil)}
            />
          ) : null}

          {stage === "select" ? (
            <SelectStage
              pack={pack}
              packImage={packImage}
              diamonds={diamonds}
              submitting={submitting}
              pending={pending}
              onPurchase={(quantity) => void purchase(quantity)}
            />
          ) : null}

          {stage === "ready" && session ? (
            <ReadyStage
              packName={packDisplayName}
              packImage={packImage}
              quantity={session.quantity}
              designed={Boolean(session.foilFaceUrl)}
              collection={model?.collectionLabel}
              onOpened={() => setStage("reveal")}
            />
          ) : null}

          {stage === "reveal" && session ? (
            <MotionRevealStage
              modelId={model?.id ?? pack.packId}
              girlName={model?.name ?? pack.creator}
              city={model?.city ?? null}
              country={model?.country ?? null}
              flagEmoji={model?.flagEmoji ?? null}
              flagSvgUrl={model?.flagSvgUrl ?? null}
              overlayColorStart={model?.overlayColorStart ?? null}
              overlayColorEnd={model?.overlayColorEnd ?? null}
              onCards={(cards) => {
                setSession((current) =>
                  current
                    ? {
                        ...current,
                        cards: cards.map((card, index) => ({
                          id: card.id,
                          rarity:
                            index === cards.length - 1 ? "Ultra Rare" : "Super Rare",
                          reward: 10 + index * 5,
                          faceUrl: card.mediaUrl,
                        })),
                      }
                    : current,
                );
              }}
              onContinue={() => setStage("preview")}
            />
          ) : null}

          {stage === "preview" && session ? (
            <PreviewStage
              session={session}
              index={selectedCard}
              packName={packDisplayName}
              onSelect={setSelectedCard}
              onPlay={() => setStage("scratch")}
              onSkip={() => setStage("grid")}
            />
          ) : null}

          {stage === "grid" && session ? (
            <GridStage
              session={session}
              selected={selectedCard}
              scratched={scratched}
              onSelect={(index) => {
                setSelectedCard(index);
                setScratchProgress(0);
                setStage("scratch");
              }}
            />
          ) : null}

          {stage === "scratch" && session ? (
            <ScratchStage
              card={session.cards[selectedCard]}
              image={cardImages[selectedCard % cardImages.length]}
              progress={scratchProgress}
              onScratch={scratch}
              onContinue={nextCard}
              isLast={
                nextUnscratchedIndex(session, [
                  ...scratched,
                  session.cards[selectedCard]?.id ?? "",
                ]) === null
              }
            />
          ) : null}

          {stage === "complete" && session ? (
            <StateScreen
              icon={<Check className="size-7" />}
              tone="success"
              title="Every card is revealed"
              body={`You played all ${session.cards.length} scratch cards from this opening. Your rewards are already in your balance.`}
              primary={{
                label: "Return to Homepage",
                onClick: () => exit(onGoHome),
              }}
              secondary={{
                label: "View Collection",
                onClick: () => exit(onViewCollection),
              }}
            />
          ) : null}

          {stage === "load-failed" ? (
            <StateScreen
              icon={<CloudOff className="size-7" />}
              tone="danger"
              title="Pack couldn’t be loaded"
              body="We couldn’t download this pack’s artwork. Check your connection and try again — your pack is safe."
              primary={{
                label: retrying ? "Retrying…" : "Retry",
                onClick: retryPackLoad,
                busy: retrying,
              }}
              secondary={{ label: "Exit", onClick: onClose }}
            />
          ) : null}

          {stage === "no-packs" ? (
            <StateScreen
              icon={<PackageOpen className="size-7" />}
              tone="neutral"
              title="No packs left to open"
              body="You’ve already opened every pack from this collection. Grab another pack to keep collecting."
              primary={{
                label: "Go to My Bag",
                onClick: () => exit(onGoMyBag ?? onViewCollection),
              }}
              secondary={{
                label: "Back to Homepage",
                onClick: () => exit(onGoHome),
              }}
            />
          ) : null}

          {stage === "expired" ? (
            <StateScreen
              icon={<TimerOff className="size-7" />}
              tone="danger"
              title="This opening session expired"
              body="We couldn’t restore your previous opening. Nothing was lost from your collection."
              primary={{ label: "Return Home", onClick: () => exit(onGoHome) }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {modal === "insufficient" ? (
          <FlowModal
            key="insufficient"
            icon={<Gem className="size-6 text-sky-300" />}
            title="Insufficient Diamonds"
            body="You don’t have enough Diamonds for this pack. Nothing was charged."
            primary={{
              label: "Get More Diamonds",
              onClick: () => {
                setModal(null);
                if (onGetDiamonds) exit(onGetDiamonds);
              },
            }}
            secondary={{ label: "Cancel", onClick: () => setModal(null) }}
            onDismiss={() => setModal(null)}
          />
        ) : null}

        {modal === "failed" ? (
          <FlowModal
            key="failed"
            icon={<AlertTriangle className="size-6 text-[#F87171]" />}
            title="Purchase Failed"
            body="We couldn’t complete the purchase. No Diamonds were deducted."
            primary={{
              label: "Try Again",
              onClick: () => {
                const quantity = pending ?? PACK_OPTIONS[0].quantity;
                setModal(null);
                void purchase(quantity, lastFoilRef.current ?? pendingFoil ?? undefined);
              },
            }}
            secondary={{ label: "Cancel", onClick: () => setModal(null) }}
            onDismiss={() => setModal(null)}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Shared state surfaces
 * ----------------------------------------------------------------------- */

type CtaConfig = { label: string; onClick: () => void; busy?: boolean };

function StateScreen({
  icon,
  tone,
  title,
  body,
  primary,
  secondary,
}: {
  icon: ReactNode;
  tone: "success" | "danger" | "neutral";
  title: string;
  body: string;
  primary: CtaConfig;
  secondary?: CtaConfig;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : tone === "danger"
        ? "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]"
        : "border-white/12 bg-white/[0.06] text-white/70";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <span
        className={["grid size-16 place-items-center rounded-full border", toneClass].join(" ")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h1 className="mt-5 text-[24px] font-bold tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/55">{body}</p>
      <button
        type="button"
        onClick={primary.onClick}
        disabled={primary.busy}
        className="mt-7 inline-flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#8B5CF6] text-[15px] font-semibold disabled:opacity-60"
      >
        {primary.busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {primary.label}
      </button>
      {secondary ? (
        <button
          type="button"
          onClick={secondary.onClick}
          className="mt-3 h-11 px-6 text-[13px] font-medium text-white/55 hover:text-white/80"
        >
          {secondary.label}
        </button>
      ) : null}
    </div>
  );
}

function FlowModal({
  icon,
  title,
  body,
  primary,
  secondary,
  onDismiss,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  primary: CtaConfig;
  secondary: CtaConfig;
  onDismiss: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-40 grid place-items-center bg-black/70 px-6 backdrop-blur-sm"
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-[28px] border border-white/[0.1] bg-[#151318] p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
      >
        <span
          className="mx-auto grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.05]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h2 className="mt-4 text-[19px] font-bold">{title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-white/55">{body}</p>
        <button
          type="button"
          onClick={primary.onClick}
          className="mt-6 h-13 w-full rounded-full bg-[#8B5CF6] text-[15px] font-semibold"
        >
          {primary.label}
        </button>
        <button
          type="button"
          onClick={secondary.onClick}
          className="mt-2 h-11 w-full rounded-full text-[14px] font-medium text-white/55 hover:text-white/85"
        >
          {secondary.label}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* --------------------------------------------------------------------------
 * Stages
 * ----------------------------------------------------------------------- */

function ChoosePackStage({
  packs,
  modelId,
  girlName,
  submitting,
  diamondCost,
  onOpen,
}: {
  packs: readonly FoilPack[];
  modelId: string;
  girlName: string;
  submitting: boolean;
  diamondCost: number;
  onOpen: (foil: FoilPack) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(packs[0]?.id ?? null);
  const items = useMemo(
    () =>
      packs.map((foil) =>
        packItemToIteration({
          id: foil.id,
          characterId: modelId,
          name: girlName,
          modelUrl: PACK_MODEL_URL,
          modelName: "card2.glb",
          videoUrl: foil.videoUrl,
          price: diamondCost,
          girlName,
          packNumber: foil.slot === 1 ? 101 : 102,
          packName: foil.label,
          flagEmoji: "",
          backgroundColor: "#5fd0e0",
        }),
      ),
    [diamondCost, girlName, modelId, packs],
  );

  useEffect(() => {
    if (!selectedId && packs[0]) setSelectedId(packs[0].id);
  }, [packs, selectedId]);

  if (!items.length) return null;

  return (
    <div
      className="stage-packs"
      style={{ ["--overlay-gradient-color-end" as string]: "#5fd0e0" }}
    >
      <div className="packs-glow-stack packs-glow-stack--base" aria-hidden="true">
        <div className="packs-circle packs-circle--bloom" />
        <div className="packs-circle packs-circle--core" />
      </div>
      <CoverFlowCarousel
        items={items}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDeselect={() => setSelectedId(null)}
        formatPrice={() => String(diamondCost)}
        onBuy={(item) => {
          if (submitting) return;
          const foil = packs.find((pack) => pack.id === item.id);
          if (foil) onOpen(foil);
        }}
      />
    </div>
  );
}

function SelectStage({
  pack,
  packImage,
  diamonds,
  submitting,
  pending,
  onPurchase,
}: {
  pack: PurchaseFlowPack;
  packImage: string;
  diamonds: number;
  submitting: boolean;
  pending: PackQuantity | null;
  onPurchase: (quantity: PackQuantity) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-6 lg:flex-row lg:items-center lg:gap-16 lg:px-10">
      <div className="flex justify-center lg:flex-1">
        <HolographicPackCard src={packImage} name={pack.packName} badge="Featured" compact />
      </div>
      <div className="mt-6 lg:mt-0 lg:flex-1">
        <p className="text-[13px] text-white/50">{pack.creator}</p>
        <h1 className="mt-1 text-[30px] leading-tight font-bold tracking-[-0.03em]">
          Choose your opening
        </h1>
        <p className="mt-2 text-[14px] text-white/55">
          Pick a pack quantity. Your cards stay hidden until you tear the seal.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {PACK_OPTIONS.map((option) => {
            const short = option.diamondCost - diamonds;
            const busy = submitting && pending === option.quantity;
            return (
              <button
                key={option.quantity}
                type="button"
                disabled={submitting}
                aria-busy={busy}
                onClick={() => onPurchase(option.quantity)}
                className="group flex min-h-24 items-center rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-left transition hover:-translate-y-1 hover:border-[#8B5CF6]/50 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:hover:translate-y-0 aria-busy:border-[#8B5CF6]/60"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-[#8B5CF6]/20 text-[#C4B5FD]">
                  {busy ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Layers3 className="size-5" />
                  )}
                </span>
                <span className="ml-3 min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">
                    {busy ? "Processing purchase…" : option.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-white/45">
                    {short > 0 ? `Need ${short} more Diamonds` : option.detail}
                  </span>
                </span>
                <span className="flex items-center gap-1 rounded-full bg-black/35 px-3 py-1.5 text-[13px] font-semibold">
                  <Gem className="size-3.5 text-sky-300" />
                  {option.diamondCost}
                </span>
              </button>
            );
          })}
        </div>
        {submitting ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-white/55" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Confirming your purchase…
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ReadyStage({
  packName,
  packImage,
  quantity,
  designed = false,
  collection,
  onOpened,
}: {
  packName: string;
  packImage: string;
  quantity: PackQuantity;
  designed?: boolean;
  collection?: string;
  onOpened: () => void;
}) {
  const rotate = useMotionValue(0);
  const rotateY = useTransform(rotate, [-180, 180], [-35, 35]);

  function tear(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > 100) onOpened();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
      <p className="text-[12px] font-semibold tracking-[0.16em] text-[#D4AF37] uppercase">
        {quantity === 1 ? "Pack ready" : `${quantity} packs ready`}
      </p>
      <h1 className="mt-2 text-[28px] font-bold">Inspect. Then tear the seal.</h1>
      <p className="mt-2 text-[13px] text-white/45">Drag the pack to rotate it.</p>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x: rotate, rotateY }}
        className="relative mt-8 cursor-grab touch-none active:cursor-grabbing"
      >
        {designed ? (
          <FoilPackFace src={packImage} collection={collection} packLabel={packName} sealed>
            <motion.button
              type="button"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={tear}
              onClick={onOpened}
              className="absolute inset-x-3 top-[48%] z-10 flex h-12 cursor-ew-resize items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/50 bg-black/55 text-[12px] font-bold tracking-[0.14em] uppercase backdrop-blur-md"
            >
              <motion.span animate={{ x: [-8, 8, -8] }} transition={{ repeat: Infinity, duration: 1.8 }}>
                ← Drag to tear →
              </motion.span>
            </motion.button>
          </FoilPackFace>
        ) : (
          <>
            <HolographicPackCard src={packImage} name={packName} badge="Sealed" interactive={false} />
            <motion.button
              type="button"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={tear}
              onClick={onOpened}
              className="absolute inset-x-3 top-[48%] flex h-12 cursor-ew-resize items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/50 bg-black/55 text-[12px] font-bold tracking-[0.14em] uppercase backdrop-blur-md"
            >
              <motion.span animate={{ x: [-8, 8, -8] }} transition={{ repeat: Infinity, duration: 1.8 }}>
                ← Drag to tear →
              </motion.span>
            </motion.button>
          </>
        )}
      </motion.div>
    </div>
  );
}

function MotionRevealStage({
  modelId,
  girlName,
  city,
  country,
  flagEmoji,
  flagSvgUrl,
  overlayColorStart,
  overlayColorEnd,
  onCards,
  onContinue,
}: {
  modelId: string;
  girlName: string;
  city: string | null;
  country: string | null;
  flagEmoji: string | null;
  flagSvgUrl: string | null;
  overlayColorStart: string | null;
  overlayColorEnd: string | null;
  onCards: (cards: RevealCard[]) => void;
  onContinue: () => void;
}) {
  const [backendFan, setBackendFan] = useState<BackendFanCatalog | null>(null);
  const [ready, setReady] = useState(false);
  const [fanLayout] = useState(() => loadFanLayout());
  const [fanDrag] = useState(() => loadFanDrag());
  const onCardsRef = useRef(onCards);
  onCardsRef.current = onCards;
  const sequence = useRevealSequence({
    autoStart: ready,
    autoStartKey: modelId,
    autoStartDelayMs: 80,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchPackFanCatalog(modelId).then(async (result) => {
      if (cancelled) return;
      const fan =
        result && result.cards.length > 0 ? result : await fetchPackFanCatalog();
      if (cancelled) return;
      setBackendFan(fan);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const cards = useMemo(() => {
    if (!ready) return [];
    return createMixedCategoryPackCards({
      backendFan,
      seed: `${modelId}:${sequence.runId}`,
      girlName,
      overlay: {
        name: girlName,
        city: city ?? "",
        country: country ?? "",
        flagEmoji: flagEmoji ?? "",
        flagSvgUrl: flagSvgUrl ?? "",
        gradientColor: overlayColorStart ?? "#5fd0e0",
        gradientColorEnd: overlayColorEnd ?? "#5fd0e0",
      },
    });
  }, [
    backendFan,
    city,
    country,
    flagEmoji,
    flagSvgUrl,
    girlName,
    modelId,
    overlayColorEnd,
    overlayColorStart,
    ready,
    sequence.runId,
  ]);

  useEffect(() => {
    if (cards.length) onCardsRef.current(cards);
  }, [cards]);

  return (
    <div className="motion-reveal">
      <div className="reveal-stage__fan">
        <CardFan
          cards={cards}
          active={sequence.fanActive}
          layout={fanLayout}
          dragConfig={fanDrag}
          onComplete={sequence.handleFanComplete}
        />
      </div>
      {sequence.showPlay ? (
        <button type="button" className="motion-reveal__continue" onClick={onContinue}>
          Continue
        </button>
      ) : null}
    </div>
  );
}

function PreviewStage({
  session,
  index,
  packName,
  onSelect,
  onPlay,
  onSkip,
}: {
  session: OpeningSession;
  index: number;
  packName: string;
  onSelect: (index: number) => void;
  onPlay: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
      <p className="text-[12px] text-white/45">
        Card {index + 1} of {session.cards.length}
      </p>
      <h1 className="mt-2 text-[26px] font-bold">{packName}</h1>
      <div className="relative mt-8 h-80 w-56">
        {session.cards
          .map((card, cardIndex) => ({ card, cardIndex }))
          .slice(index, index + 3)
          .reverse()
          .map(({ card, cardIndex }, stackIndex) => (
            <motion.button
              key={card.id}
              type="button"
              onClick={() => onSelect(cardIndex)}
              animate={{ y: stackIndex * -10, x: stackIndex * 5, rotate: stackIndex * 2 }}
              className="absolute inset-0 rounded-[24px] border border-white/20 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,.8),#151515_55%)] shadow-2xl"
            >
              <div className="absolute inset-4 rounded-[18px] border border-white/25" />
              <Sparkles className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-white/45" />
              <span className="absolute inset-x-0 bottom-7 text-[11px] font-semibold tracking-[0.16em] uppercase">
                Hidden card
              </span>
            </motion.button>
          ))}
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="mt-7 h-14 w-full max-w-sm rounded-full bg-[#8B5CF6] text-[15px] font-semibold"
      >
        Start Playing
      </button>
      <button type="button" onClick={onSkip} className="mt-3 h-11 px-6 text-[13px] text-white/55">
        Skip to card grid
      </button>
    </div>
  );
}

function GridStage({
  session,
  selected,
  scratched,
  onSelect,
}: {
  session: OpeningSession;
  selected: number;
  scratched: string[];
  onSelect: (index: number) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <h1 className="text-[28px] font-bold">Choose a card</h1>
      <p className="mt-2 text-[14px] text-white/50">
        {scratched.length
          ? `${session.cards.length - scratched.length} of ${session.cards.length} cards still sealed.`
          : "Every card remains unopened."}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {session.cards.map((card, index) => {
          const done = scratched.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              disabled={done}
              onClick={() => onSelect(index)}
              className={[
                "aspect-[3/4] rounded-[20px] border bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,.7),#151515_58%)] p-3 text-left transition",
                done
                  ? "cursor-not-allowed border-white/10 opacity-45"
                  : "hover:-translate-y-1",
                selected === index && !done ? "border-[#8B5CF6]" : "border-white/15",
              ].join(" ")}
            >
              <div className="flex size-full flex-col justify-between rounded-[14px] border border-white/20 p-3">
                {done ? (
                  <Check className="size-5 text-emerald-300" />
                ) : (
                  <Sparkles className="size-5 text-white/45" />
                )}
                <span className="text-[11px] font-semibold tracking-wide text-white/55">
                  {done ? card.rarity.toUpperCase() : `CARD ${index + 1}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScratchStage({
  card,
  image,
  progress,
  onScratch,
  onContinue,
  isLast,
}: {
  card: OpeningSession["cards"][number];
  image: string;
  progress: number;
  onScratch: (amount?: number) => void;
  onContinue: () => void;
  isLast: boolean;
}) {
  function drag(_: unknown, info: PanInfo) {
    onScratch(Math.max(18, Math.min(45, Math.abs(info.offset.x) / 4)));
  }

  const revealed = progress >= 100;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
      <p className="text-[12px] font-semibold tracking-[0.15em] text-[#D4AF37] uppercase">
        {revealed ? card.rarity : `${Math.round(progress)}% scratched`}
      </p>
      <h1 className="mt-2 text-[28px] font-bold">
        {revealed ? "Card revealed" : "Scratch to reveal"}
      </h1>
      <div className="relative mt-7 aspect-[3/4] w-[240px] overflow-hidden rounded-[24px] border border-white/20 bg-[#151515] shadow-2xl">
        {isVideoSrc(card.faceUrl ?? image) ? (
          <video
            src={card.faceUrl ?? image}
            muted
            loop
            playsInline
            autoPlay
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <img src={card.faceUrl ?? image} alt="Revealed collectible" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-5 z-10">
          <p className="text-[20px] font-bold">{card.rarity}</p>
          <p className="text-[13px] text-[#D4AF37]">+{card.reward} Sugar Coins</p>
        </div>
        <motion.button
          type="button"
          aria-label="Scratch card cover"
          drag={revealed ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={drag}
          onClick={() => onScratch()}
          animate={{ opacity: Math.max(0, 1 - progress / 100) }}
          className="absolute inset-0 z-20 cursor-ew-resize touch-none bg-[linear-gradient(135deg,#6d5aa8,#171421_45%,#d4af37_100%)]"
          style={{ pointerEvents: revealed ? "none" : "auto" }}
        >
          <div className="absolute inset-4 rounded-[18px] border border-white/35" />
          <Sparkles className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-white/45" />
          <span className="absolute inset-x-0 bottom-7 text-[11px] font-bold tracking-[0.16em] uppercase">
            Drag or tap to scratch
          </span>
        </motion.button>
      </div>
      {revealed ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          type="button"
          onClick={onContinue}
          className="mt-7 inline-flex h-14 items-center gap-2 rounded-full bg-[#8B5CF6] px-8 text-[15px] font-semibold"
        >
          <Check className="size-4" />
          {isLast ? "Finish opening" : "Next card"}
        </motion.button>
      ) : (
        <p className="mt-5 text-[13px] text-white/45">Drag across the card or tap three times.</p>
      )}
    </div>
  );
}

function stageTitle(stage: Stage) {
  if (stage === "choose") return "Choose Pack";
  if (stage === "select") return "Purchase Pack";
  if (stage === "ready") return "Pack Ready";
  if (stage === "reveal") return "Opening Reveal";
  if (stage === "preview" || stage === "grid") return "Card Preview";
  if (stage === "complete") return "Session Complete";
  if (stage === "load-failed") return "Loading Failed";
  if (stage === "no-packs") return "No Packs Left";
  if (stage === "expired") return "Session Expired";
  return "Scratch Card";
}

function stageStep(stage: Stage) {
  if (stage === "choose" || stage === "select") return 1;
  if (stage === "ready") return 2;
  if (stage === "reveal") return 3;
  return 4;
}
