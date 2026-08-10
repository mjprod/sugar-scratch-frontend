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
import { HolographicPackCard } from "../components/HolographicPackCard";
import { PACK_PHOTOS } from "../flow/photos";
import {
  PACK_OPTIONS,
  PurchaseError,
  buildOpeningSession,
  clearOpening,
  loadOpeningAssets,
  nextUnscratchedIndex,
  packCost,
  restoreOpening,
  saveOpening,
  submitPurchase,
  type OpeningSession,
  type OpeningStage,
  type PackQuantity,
  type PurchaseFlowPack,
} from "../flow/purchase";
import {
  noteCreatorStarted,
  recordRevealedCards,
} from "../flow/collectionState";
import {
  addUnopenedFromPurchase,
  countUnopened,
  getPackInstance,
  markPackOpened,
  nextUnopenedInPurchase,
  peekUnopenedInstance,
} from "../flow/packInventory";
import {
  getReadyToScratch,
  trackScratchEvent,
  upsertReadyToScratch,
} from "../flow/readyToScratch";

type Stage =
  | "select"
  | "ready"
  | "reveal"
  | "cards-ready"
  | "preview"
  | "grid"
  | "scratch"
  | "saved"
  | "saved-unopened"
  | "complete"
  | "load-failed"
  | "no-packs"
  | "expired"
  | "opening-interrupted";

type Modal = null | "insufficient" | "failed";

const OPENED_STAGES: OpeningStage[] = [
  "reveal",
  "cards-ready",
  "preview",
  "grid",
  "scratch",
  "complete",
];

function newPurchaseId() {
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  onReturnContext,
  onInventoryChange,
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
  onReturnContext?: () => void;
  onInventoryChange?: () => void;
}) {
  const bagResume = useRef(
    pack.entry === "scratch" ? getReadyToScratch(pack.packId) : null,
  ).current;

  const openResume = useRef(() => {
    if (pack.entry !== "open") return null;
    if (pack.instanceId) {
      const owned = getPackInstance(pack.instanceId);
      return owned?.status === "unopened" ? owned : null;
    }
    return peekUnopenedInstance(pack.packId);
  }).current();

  const noPacksLeft =
    pack.entry === "open" && !openResume && countUnopened() === 0;

  const restored = useRef(
    noPacksLeft || bagResume || openResume
      ? ({ status: "none" } as const)
      : restoreOpening(pack.packId),
  ).current;

  const resumed = restored.status === "resume" ? restored.data : null;
  const initialSession = bagResume?.session ?? resumed?.session ?? null;
  const initialScratched = bagResume?.revealed ?? resumed?.scratched ?? [];
  const resumeIndex = initialSession
    ? nextUnscratchedIndex(initialSession, initialScratched)
    : null;

  const [stage, setStage] = useState<Stage>(() => {
    if (noPacksLeft) return "no-packs";
    if (pack.entry === "scratch") {
      if (!bagResume || resumeIndex === null) return "expired";
      return "scratch";
    }
    if (pack.entry === "open") return openResume ? "ready" : "no-packs";
    if (restored.status === "expired") return "expired";
    if (resumed) {
      if (resumeIndex === null) return "complete";
      if (resumed.stage === "preview" || resumed.stage === "cards-ready") {
        return "cards-ready";
      }
      if (resumed.stage === "ready") return "ready";
      return resumed.stage as Stage;
    }
    return "select";
  });
  const [session, setSession] = useState<OpeningSession | null>(initialSession);
  const [selectedCard, setSelectedCard] = useState(
    resumeIndex ?? resumed?.cardIndex ?? 0,
  );
  const [scratched, setScratched] = useState<string[]>(initialScratched);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PackQuantity | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [savingLater, setSavingLater] = useState(false);
  const [instanceId, setInstanceId] = useState<string | null>(
    openResume?.instanceId ?? pack.instanceId ?? null,
  );
  const [purchaseId, setPurchaseId] = useState<string | null>(
    openResume?.purchaseId ?? pack.purchaseId ?? null,
  );
  const [unopenedRemaining, setUnopenedRemaining] = useState(() =>
    countUnopened(),
  );

  const awardedIds = useRef<Set<string>>(new Set(initialScratched));
  const packImage = PACK_PHOTOS[pack.packId] ?? PACK_PHOTOS.ep1;
  const cardImages = useMemo(() => Object.values(PACK_PHOTOS).slice(0, 8), []);
  const trackedDecision = useRef(false);
  const trackedResume = useRef(false);
  const tearLocked = useRef(false);

  useEffect(() => {
    if (stage === "expired") clearOpening();
  }, [stage]);

  useEffect(() => {
    if (pack.entry === "scratch" && !trackedResume.current && session) {
      trackedResume.current = true;
      trackScratchEvent("Scratch Resumed", { packId: pack.packId });
      trackScratchEvent("Scratch Session Started", { packId: pack.packId });
    }
  }, [pack.entry, pack.packId, session]);

  useEffect(() => {
    if (stage === "cards-ready" && !trackedDecision.current) {
      trackedDecision.current = true;
      trackScratchEvent("Scratch Decision Shown", { packId: pack.packId });
    }
  }, [stage, pack.packId]);

  useEffect(() => {
    if (!session) return;
    if (stage === "ready") {
      saveOpening({
        packId: pack.packId,
        session,
        stage: "ready",
        cardIndex: selectedCard,
        scratched,
      });
      return;
    }
    if (!OPENED_STAGES.includes(stage as OpeningStage)) return;
    saveOpening({
      packId: pack.packId,
      session,
      stage: stage as OpeningStage,
      cardIndex: selectedCard,
      scratched,
    });
    upsertReadyToScratch({
      packId: instanceId ?? pack.packId,
      packName: pack.packName,
      creator: pack.creator,
      session,
      revealed: scratched,
      coverUrl: packImage,
      themeName: pack.packName,
    });
  }, [
    stage,
    session,
    selectedCard,
    scratched,
    pack.packId,
    pack.packName,
    pack.creator,
    packImage,
    instanceId,
  ]);

  function bumpInventory() {
    setUnopenedRemaining(countUnopened());
    onInventoryChange?.();
  }

  async function purchase(quantity: PackQuantity) {
    if (submitting) return;
    if (packCost(quantity, pack.packId) > diamonds) {
      setModal("insufficient");
      return;
    }
    setSubmitting(true);
    setPending(quantity);
    try {
      const paid = await submitPurchase(quantity, diamonds, pack.packId);
      onSpend(paid.diamondCost);
      const tx = newPurchaseId();
      const owned = addUnopenedFromPurchase({
        purchaseId: tx,
        catalogPackId: pack.packId,
        packName: pack.packName,
        creator: pack.creator,
        count: quantity,
        coverUrl: packImage,
        themeName: pack.packName,
      });
      const first = owned[0];
      if (!first) throw new PurchaseError("failed", "Pack ownership failed.");
      noteCreatorStarted(first.creatorId, pack.creator);
      setPurchaseId(tx);
      setInstanceId(first.instanceId);
      setSession(null);
      setScratched([]);
      setSelectedCard(0);
      awardedIds.current = new Set();
      tearLocked.current = false;
      bumpInventory();
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
    }
  }

  async function retryPackLoad() {
    if (retrying) return;
    setRetrying(true);
    try {
      await loadOpeningAssets();
      setStage(instanceId || session ? "ready" : "select");
    } catch {
      setStage("load-failed");
    } finally {
      setRetrying(false);
    }
  }

  function completeTear() {
    if (tearLocked.current) return;
    const currentId =
      instanceId ??
      openResume?.instanceId ??
      peekUnopenedInstance(pack.packId)?.instanceId;
    if (!currentId) {
      setStage("opening-interrupted");
      return;
    }
    tearLocked.current = true;
    const opened = markPackOpened(currentId);
    if (!opened || opened.status !== "opened") {
      tearLocked.current = false;
      setStage("opening-interrupted");
      return;
    }
    const next = buildOpeningSession(1, currentId);
    setInstanceId(currentId);
    setPurchaseId(opened.purchaseId);
    setSession(next);
    setScratched([]);
    setSelectedCard(0);
    upsertReadyToScratch({
      packId: currentId,
      packName: pack.packName,
      creator: pack.creator,
      session: next,
      revealed: [],
      coverUrl: packImage,
      themeName: pack.packName,
    });
    bumpInventory();
    trackScratchEvent("Pack Opened", { packId: currentId });
    setStage("reveal");
  }

  function scratch(amount = 34) {
    setScratchProgress((value) => Math.min(100, value + amount));
  }

  function settleRevealed(revealedIds: string[]) {
    const fresh = revealedIds.filter((id) => !awardedIds.current.has(id));
    if (!fresh.length || !session) return;
    fresh.forEach((id) => awardedIds.current.add(id));
    const coins = session.cards
      .filter((card) => fresh.includes(card.id))
      .reduce((total, card) => total + card.reward, 0);
    recordRevealedCards({
      count: fresh.length,
      creatorId: pack.creator.trim().toLowerCase().replace(/\s+/g, "-"),
      creatorName: pack.creator,
    });
    onComplete({ cards: fresh.length, coins });
  }

  function finishSession(revealedIds: string[]) {
    settleRevealed(revealedIds);
    const readyId = instanceId ?? pack.packId;
    upsertReadyToScratch({
      packId: readyId,
      packName: pack.packName,
      creator: pack.creator,
      session: session!,
      revealed: revealedIds,
      coverUrl: packImage,
      themeName: pack.packName,
    });
    trackScratchEvent("All Cards Revealed", { packId: readyId });

    const nextPack =
      purchaseId != null ? nextUnopenedInPurchase(purchaseId) : null;
    if (nextPack) {
      clearOpening();
      setInstanceId(nextPack.instanceId);
      setSession(null);
      setScratched([]);
      setSelectedCard(0);
      setScratchProgress(0);
      awardedIds.current = new Set();
      tearLocked.current = false;
      trackedDecision.current = false;
      bumpInventory();
      setStage("ready");
      return;
    }
    setStage("complete");
  }

  function markCurrentRevealed() {
    if (!session) return scratched;
    const card = session.cards[selectedCard];
    if (!card || scratched.includes(card.id)) return scratched;
    const next = [...scratched, card.id];
    setScratched(next);
    trackScratchEvent("Card Revealed", {
      packId: instanceId ?? pack.packId,
      cardId: card.id,
    });
    settleRevealed(next);
    return next;
  }

  function scratchNext() {
    if (!session) return;
    trackScratchEvent("Scratch Next Selected", {
      packId: instanceId ?? pack.packId,
    });
    const revealedIds = markCurrentRevealed();
    const next = nextUnscratchedIndex(session, revealedIds);
    if (next === null) {
      finishSession(revealedIds);
      return;
    }
    setSelectedCard(next);
    setScratchProgress(0);
  }

  function persistOpened(revealedIds: string[]) {
    if (!session) return;
    const readyId = instanceId ?? pack.packId;
    upsertReadyToScratch({
      packId: readyId,
      packName: pack.packName,
      creator: pack.creator,
      session,
      revealed: revealedIds,
      coverUrl: packImage,
      themeName: pack.packName,
    });
    trackScratchEvent("Scratch Progress Saved", {
      packId: readyId,
      remaining: session.cards.length - revealedIds.length,
    });
    bumpInventory();
  }

  function scratchLater(from: "decision" | "finish" | "exit") {
    if (savingLater || !session) return;
    setSavingLater(true);
    setScratchProgress(0);
    const revealedIds =
      from === "decision" ? scratched : markCurrentRevealedIfDone();
    if (from === "decision") {
      trackScratchEvent("Scratch Later Selected", {
        packId: instanceId ?? pack.packId,
      });
    } else if (from === "finish") {
      trackScratchEvent("Finish Later Selected", {
        packId: instanceId ?? pack.packId,
      });
    } else {
      trackScratchEvent("Scratch Session Exited", {
        packId: instanceId ?? pack.packId,
      });
    }
    persistOpened(revealedIds);
    clearOpening();
    setStage("saved");
  }

  function markCurrentRevealedIfDone() {
    if (!session || scratchProgress < 100) return scratched;
    return markCurrentRevealed();
  }

  function startScratchNow() {
    if (!session) return;
    trackScratchEvent("Scratch Now Selected", {
      packId: instanceId ?? pack.packId,
    });
    trackScratchEvent("Scratch Session Started", {
      packId: instanceId ?? pack.packId,
    });
    const next = nextUnscratchedIndex(session, scratched) ?? 0;
    setSelectedCard(next);
    setScratchProgress(0);
    setStage("scratch");
  }

  function leaveSaved(destination?: () => void) {
    bumpInventory();
    (destination ?? onReturnContext ?? onClose)();
  }

  function exit(destination?: () => void) {
    clearOpening();
    bumpInventory();
    (destination ?? onClose)();
  }

  function exitUnopened() {
    clearOpening();
    bumpInventory();
    setStage("saved-unopened");
  }

  function onHeaderClose() {
    if (stage === "ready") {
      exitUnopened();
      return;
    }
    if (stage === "cards-ready" || stage === "scratch" || stage === "grid") {
      scratchLater(stage === "cards-ready" ? "decision" : "exit");
      return;
    }
    if (stage === "reveal") {
      if (session) scratchLater("decision");
      else exitUnopened();
      return;
    }
    if (stage === "saved" || stage === "saved-unopened") {
      leaveSaved();
      return;
    }
    if (stage === "opening-interrupted") {
      tearLocked.current = false;
      setStage("ready");
      return;
    }
    onClose();
  }

  const terminal =
    stage === "complete" ||
    stage === "saved" ||
    stage === "saved-unopened" ||
    stage === "no-packs" ||
    stage === "expired" ||
    stage === "load-failed" ||
    stage === "opening-interrupted";

  const remainingAfterCurrent =
    session == null
      ? 0
      : session.cards.filter((card) => {
          if (scratched.includes(card.id)) return false;
          if (
            scratchProgress >= 100 &&
            card.id === session.cards[selectedCard]?.id
          ) {
            return false;
          }
          return true;
        }).length;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Pack purchase and opening"
      className="absolute inset-0 z-50 flex min-h-0 flex-col overflow-hidden bg-[#090909]"
    >
      <header className="relative z-20 flex h-16 shrink-0 items-center border-b border-white/[0.08] px-4">
        <button
          type="button"
          onClick={onHeaderClose}
          className="grid size-11 place-items-center rounded-full text-white/75 hover:bg-white/10"
          aria-label={
            stage === "ready"
              ? "Save pack and exit"
              : stage === "cards-ready" || stage === "scratch" || stage === "grid"
                ? "Save and exit scratch session"
                : "Close purchase flow"
          }
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-[13px] font-semibold">{stageTitle(stage)}</p>
          {terminal ? null : (
            <p className="text-[10px] text-white/40">{stageStep(stage)} of 4</p>
          )}
        </div>
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
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {stage === "select" ? (
            <SelectStage
              pack={pack}
              packImage={packImage}
              diamonds={diamonds}
              submitting={submitting}
              pending={pending}
              onPurchase={purchase}
            />
          ) : null}

          {stage === "ready" ? (
            <ReadyStage
              packName={pack.packName}
              packImage={packImage}
              remainingUnopened={Math.max(1, unopenedRemaining)}
              onOpened={completeTear}
            />
          ) : null}

          {stage === "reveal" && session ? (
            <RevealStage
              cardCount={session.cards.length}
              packImage={packImage}
              cardImages={cardImages}
              onContinue={() => setStage("cards-ready")}
            />
          ) : null}

          {stage === "cards-ready" && session ? (
            <CardsReadyStage
              session={session}
              packName={pack.packName}
              saving={savingLater}
              onScratchNow={startScratchNow}
              onLater={() => scratchLater("decision")}
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
              remainingAfterReveal={remainingAfterCurrent}
              onScratch={scratch}
              onScratchNext={scratchNext}
              onFinishLater={() => scratchLater("finish")}
            />
          ) : null}

          {stage === "saved" ? (
            <StateScreen
              icon={<PackageOpen className="size-7" />}
              tone="success"
              title="Saved to My Bag"
              body="Scratch them whenever you're ready."
              primary={{
                label: "Continue",
                onClick: () => leaveSaved(),
              }}
              secondary={
                onGoMyBag
                  ? {
                      label: "View My Bag",
                      onClick: () => leaveSaved(onGoMyBag),
                    }
                  : undefined
              }
            />
          ) : null}

          {stage === "saved-unopened" ? (
            <StateScreen
              icon={<PackageOpen className="size-7" />}
              tone="success"
              title="Saved to My Bag"
              body="Your pack is waiting under Unopened Packs."
              primary={{
                label: "Continue",
                onClick: () => leaveSaved(),
              }}
              secondary={
                onGoMyBag
                  ? {
                      label: "View My Bag",
                      onClick: () => leaveSaved(onGoMyBag),
                    }
                  : undefined
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

          {stage === "opening-interrupted" ? (
            <StateScreen
              icon={<CloudOff className="size-7" />}
              tone="danger"
              title="Opening interrupted"
              body="Your pack is safe."
              primary={{
                label: "Try Again",
                onClick: () => {
                  tearLocked.current = false;
                  setStage("ready");
                },
              }}
              secondary={{ label: "Exit", onClick: exitUnopened }}
            />
          ) : null}

          {stage === "no-packs" ? (
            <StateScreen
              icon={<PackageOpen className="size-7" />}
              tone="neutral"
              title="No packs left to open"
              body="You don’t have an unopened pack for this collection right now."
              primary={{
                label: "Back",
                onClick: onClose,
              }}
            />
          ) : null}

          {stage === "expired" ? (
            <StateScreen
              icon={<TimerOff className="size-7" />}
              tone="neutral"
              title="Session expired"
              body="Your opening session expired. Owned packs are still in My Bag."
              primary={{
                label: "Close",
                onClick: onClose,
              }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>

      {modal ? (
        <ModalShell onClose={() => setModal(null)}>
          {modal === "insufficient" ? (
            <StateScreen
              icon={<Gem className="size-7" />}
              tone="warn"
              title="Not enough diamonds"
              body="Top up diamonds to continue this purchase. Your balance was not charged."
              primary={{
                label: "Get Diamonds",
                onClick: () => {
                  setModal(null);
                  onGetDiamonds?.();
                },
              }}
              secondary={{ label: "Close", onClick: () => setModal(null) }}
            />
          ) : (
            <StateScreen
              icon={<AlertTriangle className="size-7" />}
              tone="danger"
              title="Purchase failed"
              body="Something went wrong and you were not charged. Try again."
              primary={{ label: "Close", onClick: () => setModal(null) }}
            />
          )}
        </ModalShell>
      ) : null}
    </section>
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
            const cost = packCost(option.quantity, pack.packId);
            const short = cost - diamonds;
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
                  {cost}
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
  remainingUnopened,
  onOpened,
}: {
  packName: string;
  packImage: string;
  remainingUnopened: number;
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
        {remainingUnopened <= 1
          ? "Pack ready"
          : `${remainingUnopened} packs ready to open`}
      </p>
      <h1 className="mt-2 text-[28px] font-bold">Inspect. Then tear the seal.</h1>
      <p className="mt-2 text-[13px] text-white/45">Drag the pack to rotate it.</p>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x: rotate, rotateY }}
        className="relative mt-8 cursor-grab touch-none active:cursor-grabbing"
      >
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
      </motion.div>
    </div>
  );
}

function RevealStage({
  cardCount,
  packImage,
  cardImages,
  onContinue,
}: {
  cardCount: number;
  packImage: string;
  cardImages: string[];
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-8 text-center">
      <motion.img
        src={packImage}
        alt=""
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 1.2, opacity: 0.15, y: -70 }}
        transition={{ duration: 0.6 }}
        className="absolute h-72 w-52 rounded-[24px] object-cover"
      />
      <div className="relative h-72 w-60">
        {Array.from({ length: Math.min(cardCount, 5) }, (_, index) => (
          <motion.div
            key={index}
            initial={{ y: 100, opacity: 0, rotate: 0 }}
            animate={{
              y: index * 4,
              x: (index - Math.min(cardCount, 5) / 2) * 18,
              rotate: (index - 2) * 5,
              opacity: 1,
            }}
            transition={{ delay: 0.15 + index * 0.08, duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 overflow-hidden rounded-[20px] border border-white/20 bg-[#151515] shadow-2xl"
          >
            <img src={cardImages[index % cardImages.length]} alt="" className="size-full object-cover opacity-35" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(139,92,246,.65),transparent,rgba(212,175,55,.45))] mix-blend-color-dodge" />
            <div className="absolute inset-3 rounded-[14px] border border-white/30" />
            <p className="absolute inset-x-0 bottom-5 text-[11px] font-bold tracking-[0.16em] uppercase">
              Scratch to reveal
            </p>
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}>
        <h1 className="mt-5 text-[28px] font-bold">{cardCount} cards discovered</h1>
        <p className="mt-2 text-[14px] text-white/50">Their artwork is still hidden.</p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 h-14 rounded-full bg-[#8B5CF6] px-8 text-[15px] font-semibold"
        >
          Continue
        </button>
      </motion.div>
    </div>
  );
}

function CardsReadyStage({
  session,
  packName,
  saving,
  onScratchNow,
  onLater,
}: {
  session: OpeningSession;
  packName: string;
  saving: boolean;
  onScratchNow: () => void;
  onLater: () => void;
}) {
  const stack = session.cards.slice(0, Math.min(session.cards.length, 3));

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
      <p className="text-[12px] font-semibold tracking-[0.14em] text-white/45 uppercase">
        {packName}
      </p>
      <h1 className="mt-2 text-[28px] font-bold">Your Cards Are Ready</h1>
      <p className="mt-2 text-[14px] text-white/50">Ready to see what you got?</p>
      <motion.div
        className="relative mt-8 h-80 w-56"
        initial={{ scale: 0.96, opacity: 0.85 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {stack
          .map((card, cardIndex) => ({ card, cardIndex }))
          .reverse()
          .map(({ card, cardIndex }, stackIndex) => (
            <div
              key={card.id}
              aria-hidden="true"
              className="absolute inset-0 rounded-[24px] border border-white/20 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,.8),#151515_55%)] shadow-2xl"
              style={{
                transform: `translate(${stackIndex * 5}px, ${stackIndex * -10}px) rotate(${stackIndex * 2}deg)`,
              }}
            >
              <div className="absolute inset-4 rounded-[18px] border border-white/25" />
              <Sparkles className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-white/45" />
              <span className="absolute inset-x-0 bottom-7 text-[11px] font-semibold tracking-[0.16em] uppercase">
                Card {cardIndex + 1}
              </span>
            </div>
          ))}
      </motion.div>
      <p className="mt-6 text-[13px] text-white/45">
        {session.cards.length} {session.cards.length === 1 ? "card" : "cards"} waiting
      </p>
      <button
        type="button"
        onClick={onScratchNow}
        disabled={saving}
        className="mt-5 h-14 w-full max-w-sm rounded-full bg-[#8B5CF6] text-[15px] font-semibold disabled:opacity-60"
      >
        Scratch Now
      </button>
      <button
        type="button"
        onClick={onLater}
        disabled={saving}
        aria-label="Scratch Later"
        className="mt-3 h-11 px-6 text-[13px] text-white/45 hover:text-white/70 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Later"}
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
  remainingAfterReveal,
  onScratch,
  onScratchNext,
  onFinishLater,
}: {
  card: OpeningSession["cards"][number];
  image: string;
  progress: number;
  remainingAfterReveal: number;
  onScratch: (amount?: number) => void;
  onScratchNext: () => void;
  onFinishLater: () => void;
}) {
  function drag(_: unknown, info: PanInfo) {
    onScratch(Math.max(18, Math.min(45, Math.abs(info.offset.x) / 4)));
  }

  const revealed = progress >= 100;
  const hasMore = remainingAfterReveal > 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
      <p className="text-[12px] font-semibold tracking-[0.15em] text-[#D4AF37] uppercase">
        {revealed ? card.rarity : `${Math.round(progress)}% scratched`}
      </p>
      <h1 className="mt-2 text-[28px] font-bold">
        {revealed ? "Card Revealed" : "Scratch to reveal"}
      </h1>
      {revealed && hasMore ? (
        <p className="mt-2 text-[14px] text-white/50">
          {remainingAfterReveal}{" "}
          {remainingAfterReveal === 1 ? "Card Remaining" : "Cards Remaining"}
        </p>
      ) : null}
      <div className="relative mt-7 aspect-[3/4] w-[240px] overflow-hidden rounded-[24px] border border-white/20 bg-[#151515] shadow-2xl">
        <img src={image} alt="Revealed collectible" className="absolute inset-0 size-full object-cover" />
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-7 flex w-full max-w-sm flex-col items-center"
        >
          <button
            type="button"
            onClick={onScratchNext}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#8B5CF6] px-8 text-[15px] font-semibold"
          >
            <Check className="size-4" />
            {hasMore ? "Scratch Next" : "Finish"}
          </button>
          {hasMore ? (
            <button
              type="button"
              onClick={onFinishLater}
              className="mt-3 h-11 px-6 text-[13px] text-white/45 hover:text-white/70"
            >
              Finish Later
            </button>
          ) : null}
        </motion.div>
      ) : (
        <p className="mt-5 text-[13px] text-white/45">Drag across the card or tap three times.</p>
      )}
    </div>
  );
}

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
  tone: "success" | "danger" | "neutral" | "warn";
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
        : tone === "warn"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
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

function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#151318] shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
        {children}
      </div>
    </div>
  );
}

function stageTitle(stage: Stage) {
  if (stage === "select") return "Purchase Pack";
  if (stage === "ready") return "Pack Ready";
  if (stage === "reveal") return "Opening Reveal";
  if (stage === "preview" || stage === "grid" || stage === "cards-ready") return "Cards Ready";
  if (stage === "complete") return "Session Complete";
  if (stage === "saved" || stage === "saved-unopened") return "Saved";
  if (stage === "load-failed") return "Loading Failed";
  if (stage === "opening-interrupted") return "Opening Interrupted";
  if (stage === "no-packs") return "No Packs Left";
  if (stage === "expired") return "Session Expired";
  return "Scratch Card";
}

function stageStep(stage: Stage) {
  if (stage === "select") return 1;
  if (stage === "ready") return 2;
  if (stage === "reveal") return 3;
  return 4;
}
