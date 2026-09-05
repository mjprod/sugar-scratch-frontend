import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  CloudOff,
  Layers3,
  Loader2,
  PackageOpen,
  Sparkles,
  TimerOff,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HolographicPackCard } from "@/components/HolographicPackCard";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { FirstPlayTutorial } from "@/components/game/FirstPlayTutorial";
import { isScratchTutorialCompleted } from "@/services/scratchTutorial";
import { CoverFlowCarousel } from "@/features/packs/CoverFlowCarousel";
import {
  CoverFlowCarouselV2,
  type CoverFlowCameraSettings,
} from "@/features/packs/CoverFlowCarouselV2";
import { DragToTearControl } from "@/features/packs/DragToTearControl";
import { packItemToIteration } from "@/features/packs/types";
import { useCoverflowTearSlider } from "@/features/packs/useCoverflowTearSlider";
import {
  rewindCardTopTear,
  setCardTopTearT,
  setPackOpenRequested,
} from "@/features/packs/cardTopDebug";
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
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import { PACK_PHOTOS, resolveInventoryCoverUrl } from "@/lib/photos";
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
  buildOpeningSession,
  clearOpening,
  commitPurchaseIdempotencyKey,
  loadOpeningAssets,
  loadPackCatalog,
  nextUnscratchedIndex,
  openPackInstance,
  packCost,
  revealPackCard,
  restoreOpening,
  saveOpening,
  areServerRevealCardIds,
  buildFoilOpeningSession,
  submitPurchase,
  type OpeningSession,
  type OpeningStage,
  type PackQuantity,
  type PurchaseFlowPack,
} from "@/services/purchase";
import { useAuth } from "@/contexts/AuthContext";
import { isDemoMode } from "@/lib/demo";
import {
  noteCreatorStarted,
  recordRevealedCards,
} from "@/services/collectionState";
import { resolveCollectionThemeLabel } from "@/services/collection";
import {
  countUnopened,
  getPackInstance,
  isLocalPackInstanceId,
  markPackOpened,
  nextUnopenedInPurchase,
  peekUnopenedInstance,
  syncMyPacks,
  upsertInstancesFromApi,
  type OwnedPackInstance,
} from "@/services/packInventory";
import { recordPackPurchaseTransaction } from "@/services/transactionHistory";
import { packHistoryIds, recordGameReveal } from "@/services/gameHistory";
import {
  clearCart,
  removePackFromCart,
} from "@/services/cart";
import {
  getReadyToScratch,
  trackScratchEvent,
  upsertReadyToScratch,
} from "@/services/readyToScratch";
import { unlockCountdownSound } from "@/features/game/modules/InitialCountdown";
import {
  motionPlayHref,
  navigateTo,
  photoPlayHref,
  startMotionSession,
  loadGameSessionForPack,
  activateGameSessionForPack,
} from "@/features/game/modules/gameSession";
import {
  loadGameCatalog,
  resolveMotionHandFromIds,
} from "@/features/game/modules/session";

type Stage =
  | "choose"
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

function PurchaseCtaButton({
  label,
  onClick,
  disabled = false,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <CtaButton
      {...ctaButtonPropsFromTemplate("squircleCTA")}
      fillParent
      type="button"
      label={label}
      costAmount={null}
      fontSize={15}
      strokeWidth={1}
      disabled={disabled}
      className={className}
      onClick={onClick}
    />
  );
}

function resetTearOpenState() {
  rewindCardTopTear();
  setPackOpenRequested(false);
  setCardTopTearT(0, false);
}

function cartFoilsForTear(pack: PurchaseFlowPack): FoilPack[] {
  return (pack.cartFoils ?? []).map((foil, index) => ({
    slot: foil.slot ?? ((index === 0 ? 1 : 2) as FoilPack["slot"]),
    id: foil.id,
    label: foil.label,
    videoUrl: foil.videoUrl,
  }));
}

/** Prefer face identity so the same design never appears twice in coverflow. */
function foilIdentityKey(foil: Pick<FoilPack, "id" | "videoUrl" | "label" | "slot">) {
  const face = `${foil.videoUrl.trim()}|${foil.label.trim()}|${foil.slot}`;
  if (foil.videoUrl.trim() || foil.label.trim()) return face;
  return foil.id.trim() || face;
}

/** One coverflow entry per pack face — never clone / repeat the same pack. */
function nextQueuedTearInstance(
  pack: PurchaseFlowPack,
  currentId: string,
  purchaseId: string | null,
): OwnedPackInstance | null {
  // Cart checkout and Pack Pocket owned opens both pass an ordered instance queue.
  if (
    (pack.entry === "cart-tear" || pack.entry === "open") &&
    pack.tearInstanceIds?.length
  ) {
    const index = pack.tearInstanceIds.indexOf(currentId);
    const nextId = index >= 0 ? pack.tearInstanceIds[index + 1] : undefined;
    return nextId ? getPackInstance(nextId) : null;
  }
  return purchaseId != null ? nextUnopenedInPurchase(purchaseId) : null;
}

function dedupeTearFoils(foils: readonly FoilPack[]): FoilPack[] {
  const seen = new Set<string>();
  const unique: FoilPack[] = [];
  for (const foil of foils) {
    const key = foilIdentityKey(foil);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(foil);
  }
  return unique;
}

function readyPacksForSession(
  purchasedFoil: FoilPack | null,
  session: OpeningSession | null,
  pack: PurchaseFlowPack,
  _count: number,
  modelPacks: readonly FoilPack[],
): FoilPack[] {
  const cartFoils = cartFoilsForTear(pack);
  if (cartFoils.length) return dedupeTearFoils(cartFoils);

  // Prefer distinct designed foils from the model (slot 1 / slot 2), not N clones.
  if (modelPacks.length) return dedupeTearFoils(modelPacks);

  const source =
    purchasedFoil ??
    (session?.foilFaceUrl
      ? {
          slot: 1 as const,
          id: session.cards[0]?.id ?? `${pack.packId}-1`,
          label: session.foilLabel ?? pack.packName,
          videoUrl: session.foilFaceUrl,
        }
      : null);
  if (!source) return [];
  return dedupeTearFoils([source]);
}

export function PurchaseFlow({
  pack,
  diamonds,
  coins = 0,
  onClose,
  onWalletUpdate,
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
  coins?: number;
  onClose: () => void;
  onWalletUpdate?: (wallet: { diamonds: number; coins: number }) => void;
  onComplete: (result: { cards: number; coins: number }) => void;
  onGetDiamonds?: () => void;
  onGoHome?: () => void;
  onViewCollection?: () => void;
  onGoMyBag?: () => void;
  onReturnContext?: () => void;
  onInventoryChange?: () => void;
}) {
  const { authed } = useAuth();
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
  const buying = pack.entry !== "open";

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
    if (pack.entry === "cart-tear") return "ready";
    if (pack.entry === "open") return openResume ? "ready" : "no-packs";
    if (buying) return "choose";
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
  const [session, setSession] = useState<OpeningSession | null>(() => {
    if (initialSession) return initialSession;
    if (pack.entry !== "cart-tear") return null;
    const foils = cartFoilsForTear(pack);
    const first = foils[0];
    if (!first) return buildOpeningSession(1, pack.packId);
    return {
      ...buildFoilOpeningSession(foils, packCost(1, pack.packId)),
      foilFaceUrl: first.videoUrl,
      foilLabel: first.label,
    };
  });
  const [model, setModel] = useState<ModelProfile | null>(null);
  const [, setPendingFoil] = useState<FoilPack | null>(null);
  const lastFoilRef = useRef<FoilPack | null>(null);
  const [purchasedFoil, setPurchasedFoil] = useState<FoilPack | null>(() => {
    const cartFirst = cartFoilsForTear(pack)[0];
    if (cartFirst) return cartFirst;
    const faceUrl = initialSession?.foilFaceUrl?.trim();
    if (!faceUrl) return null;
    return {
      slot: 1,
      id: initialSession?.cards[0]?.id ?? `${pack.packId}-1`,
      label: initialSession?.foilLabel ?? pack.packName,
      videoUrl: faceUrl,
    };
  });
  const [selectedCard, setSelectedCard] = useState(
    resumeIndex ?? resumed?.cardIndex ?? 0,
  );
  const [scratched, setScratched] = useState<string[]>(initialScratched);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [revealSettling, setRevealSettling] = useState(false);
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
  const [openingIdRef] = useState(() => ({
    current: resumed?.openingId ?? (null as string | null),
  }));
  const resumedServerIds = resumed?.serverRevealCardIds;
  /** Server PackOpeningCard ids — parallel to session.cards (survives fan remap). */
  const serverRevealCardIdsRef = useRef<string[] | null>(
    areServerRevealCardIds(resumedServerIds) ? resumedServerIds! : null,
  );
  const [readyPackCount, setReadyPackCount] = useState(
    () => pack.unopenedPacks ?? Math.max(1, session?.quantity ?? 1),
  );
  /** Foils still available on the tear coverflow (opened ones are dropped). */
  const [tearFoils, setTearFoils] = useState<FoilPack[]>(() =>
    readyPacksForSession(
      null,
      initialSession,
      pack,
      pack.unopenedPacks ?? Math.max(1, initialSession?.quantity ?? 1),
      [],
    ),
  );
  /** Foil identity last torn — removed when returning to the tear stage. */
  const openedTearFoilKeyRef = useRef<string | null>(null);
  const [, setUnopenedRemaining] = useState(() =>
    countUnopened(),
  );
  const [tearTutorialFade, setTearTutorialFade] = useState(false);
  /** Seal torn — hide tear tutorial so it can't block Scratch Now. */
  const [sealTorn, setSealTorn] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const tearTutorialWasReady = useRef(false);
  useMarkPageReady(!buying || model !== null || stage !== "choose");

  // Clear leftover tear/open state from a previous pack so Pack Ready isn't a
  // black torn foil on a black stage.
  useLayoutEffect(() => {
    rewindCardTopTear();
  }, []);

  const awardedIds = useRef<Set<string>>(new Set(initialScratched));
  /** Cards with a reveal API call in flight — blocks duplicate settlement. */
  const settlingRevealIdsRef = useRef<Set<string>>(new Set());
  function releaseUnsettledRevealIds(ids: readonly string[]) {
    ids.forEach((id) => {
      if (!awardedIds.current.has(id)) {
        settlingRevealIdsRef.current.delete(id);
      }
    });
  }
  const revealActionLockedRef = useRef(false);
  const trackedResume = useRef(false);
  const tearLocked = useRef(false);
  /** Skip pack opening when resuming from Collection Ready to Scratch. */
  const autoLaunchScratchRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const sealTornRef = useRef(sealTorn);
  sealTornRef.current = sealTorn;
  const scratchedRef = useRef(scratched);
  scratchedRef.current = scratched;
  const instanceIdRef = useRef(instanceId);
  instanceIdRef.current = instanceId;
  const savingLaterRef = useRef(savingLater);
  savingLaterRef.current = savingLater;
  const purchasedFoilRef = useRef(purchasedFoil);
  purchasedFoilRef.current = purchasedFoil;
  /** Skip duplicate silent save when header close already persisted. */
  const leavePersistedRef = useRef(false);
  const collectionTheme =
    resolveCollectionThemeLabel({
      themeName: pack.themeName,
      packName: session?.foilLabel ?? purchasedFoil?.label ?? pack.packName,
      catalogPackId: pack.packId,
      creator: pack.creator,
    }) ||
    pack.themeName?.trim() ||
    pack.packName;
  const collectionThemeRef = useRef(collectionTheme);
  collectionThemeRef.current = collectionTheme;
  const packCoverUrl =
    purchasedFoil?.videoUrl ||
    session?.foilFaceUrl ||
    resolveInventoryCoverUrl({
      packId: pack.packId,
      themeName: collectionTheme,
      creator: pack.creator,
    });
  /** Single source for foil-aware Ready-to-Scratch inventory labels. */
  function upsertPackReadyToScratch(input: {
    packId: string;
    session: OpeningSession;
    revealed: string[];
  }) {
    const foilName =
      input.session.foilLabel || purchasedFoil?.label || pack.packName;
    upsertReadyToScratch({
      packId: input.packId,
      packName: foilName,
      creator: pack.creator,
      session: input.session,
      revealed: input.revealed,
      coverUrl: input.session.foilFaceUrl || packCoverUrl,
      // Foil label is display-only; collection grouping needs the theme.
      themeName: collectionTheme,
    });
  }
  const packImage = session?.foilFaceUrl ?? packCoverUrl;
  const cardImages = useMemo(() => {
    const faces = session?.cards
      .map((card) => card.faceUrl)
      .filter((url): url is string => Boolean(url));
    if (faces?.length) return faces;
    return Object.values(PACK_PHOTOS).slice(0, 8);
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    void loadPackCatalog().then(() => {
      if (!cancelled) setCatalogRevision((value) => value + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Buy path needs the model for foil picker; open-from-inventory needs it
    // so Pack Ready can show a real foil instead of an empty shell.
    if (!buying && pack.entry !== "open") return;
    void loadModelProfile(pack.packId, pack.creator).then((profile) => {
      setModel(profile);
      if (!profile?.packs.length) {
        setStage((current) => (current === "choose" ? "select" : current));
      }
    });
  }, [buying, pack.entry, pack.creator, pack.packId]);

  // Once model foils load, seed the tear coverflow with unique packs only
  // (never N clones of the same face).
  useEffect(() => {
    if (!model?.packs.length) return;
    setTearFoils((current) => {
      if (current.length) return dedupeTearFoils(current);
      return dedupeTearFoils(model.packs);
    });
  }, [model]);

  useEffect(() => {
    if (stage === "expired") clearOpening();
  }, [stage]);

  // Always leave global tear/open debug clean when this flow unmounts so Cart /
  // homepage coverflows never inherit an in-progress open.
  // Also auto-save like "Save for later" when the user navigates away mid-flow:
  // torn → Ready to Scratch; not torn → stays under Unopened Packs.
  useEffect(() => {
    return () => {
      try {
        if (!leavePersistedRef.current && !savingLaterRef.current) {
          const currentStage = stageRef.current;
          const terminalLeave =
            currentStage === "complete" ||
            currentStage === "saved" ||
            currentStage === "saved-unopened" ||
            currentStage === "no-packs" ||
            currentStage === "expired" ||
            currentStage === "load-failed";
          if (!terminalLeave) {
            const liveSession = sessionRef.current;
            const readyId =
              instanceIdRef.current ?? pack.instanceId ?? pack.packId;
            if (sealTornRef.current && liveSession && readyId) {
              const foil = purchasedFoilRef.current;
              const theme = collectionThemeRef.current;
              upsertReadyToScratch({
                packId: readyId,
                packName:
                  liveSession.foilLabel || foil?.label || pack.packName,
                creator: pack.creator,
                session: liveSession,
                revealed: scratchedRef.current,
                coverUrl:
                  liveSession.foilFaceUrl ||
                  foil?.videoUrl ||
                  resolveInventoryCoverUrl({
                    packId: pack.packId,
                    themeName: theme,
                    creator: pack.creator,
                  }),
                themeName: theme,
              });
              trackScratchEvent("Scratch Progress Saved", {
                packId: readyId,
                remaining:
                  liveSession.cards.length - scratchedRef.current.length,
              });
              onInventoryChange?.();
            } else {
              // Untorn owned pack is already in inventory from purchase —
              // just refresh collection so Unopened Packs / Pack Pocket see it.
              onInventoryChange?.();
            }
            clearOpening();
          }
        }
      } finally {
        resetTearOpenState();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only autosave
  }, []);

  useEffect(() => {
    if (isScratchTutorialCompleted()) return;
    if (stage === "ready") {
      tearTutorialWasReady.current = true;
      setTearTutorialFade(false);
      return;
    }
    if (!tearTutorialWasReady.current) return;
    tearTutorialWasReady.current = false;
    setTearTutorialFade(true);
    const id = window.setTimeout(() => setTearTutorialFade(false), 280);
    return () => window.clearTimeout(id);
  }, [stage]);

  useEffect(() => {
    if (pack.entry === "scratch" && !trackedResume.current && session) {
      trackedResume.current = true;
      trackScratchEvent("Scratch Resumed", { packId: pack.packId });
      trackScratchEvent("Scratch Session Started", { packId: pack.packId });
    }
  }, [pack.entry, pack.packId, session]);

  // Recover server openingId only after tear (or mid-scratch resume). Never deal
  // cards while the pack is still on Pack Ready — completeTear owns first open.
  useEffect(() => {
    if (!authed || isDemoMode()) return;
    const currentId = instanceId ?? pack.instanceId;
    if (!currentId || isLocalPackInstanceId(currentId)) return;
    if (
      openingIdRef.current &&
      areServerRevealCardIds(serverRevealCardIdsRef.current)
    ) {
      return;
    }
    if (stage === "ready" && !sealTorn) return;
    if (
      stage !== "scratch" &&
      !sealTorn &&
      !OPENED_STAGES.includes(stage as OpeningStage)
    ) {
      return;
    }

    void (async () => {
      try {
        const result = await openPackInstance(currentId);
        if ((instanceId ?? pack.instanceId) !== currentId) return;
        openingIdRef.current = result.openingId;
        result.scratched.forEach((id) => awardedIds.current.add(id));
        serverRevealCardIdsRef.current = result.session.cards.map((card) => card.id);
      } catch {
        /* resume without openingId — reveal will fail closed */
      }
    })();
  }, [authed, instanceId, pack.instanceId, stage, sealTorn]);

  useEffect(() => {
    if (!session) return;
    const openingId = openingIdRef.current ?? undefined;
    if (stage === "ready") {
      saveOpening({
        packId: pack.packId,
        session,
        stage: sealTorn ? "reveal" : "ready",
        cardIndex: selectedCard,
        scratched,
        openingId,
        serverRevealCardIds: serverRevealCardIdsRef.current ?? undefined,
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
      openingId,
      serverRevealCardIds: serverRevealCardIdsRef.current ?? undefined,
    });
    upsertPackReadyToScratch({
      packId: instanceId ?? pack.packId,
      session,
      revealed: scratched,
    });
  }, [
    stage,
    session,
    selectedCard,
    scratched,
    pack.packId,
    pack.packName,
    pack.creator,
    collectionTheme,
    packCoverUrl,
    instanceId,
    sealTorn,
  ]);

  function bumpInventory() {
    setUnopenedRemaining(countUnopened());
    onInventoryChange?.();
  }

  async function purchase(quantity: PackQuantity, foil?: FoilPack) {
    if (submitting) return;
    const cost = packCost(quantity, pack.packId);
    if (cost > diamonds) {
      setModal("insufficient");
      return;
    }
    setSubmitting(true);
    setPending(quantity);
    if (foil) {
      lastFoilRef.current = foil;
      setPurchasedFoil(foil);
      setPendingFoil(foil);
    }
    try {
      const result = await submitPurchase(
        quantity,
        diamonds,
        pack.packId,
        undefined,
        coins,
      );
      onWalletUpdate?.({
        diamonds: result.wallet.diamonds,
        coins: result.wallet.coins,
      });
      const themeName =
        resolveCollectionThemeLabel({
          themeName: pack.themeName,
          packName: pack.packName,
          catalogPackId: pack.packId,
          creator: pack.creator,
        }) ||
        pack.themeName?.trim() ||
        pack.packName;
      const owned = upsertInstancesFromApi(result.instances);
      const firstInstance = result.instances[0];
      recordPackPurchaseTransaction({
        purchaseId: result.purchaseId,
        packId: pack.packId,
        packName:
          firstInstance?.packName || foil?.label || pack.packName,
        creatorName: firstInstance?.creator || pack.creator,
        quantity: result.instances.length || quantity,
        diamondCost: result.diamondCost,
      });
      if (authed && !isDemoMode()) {
        await syncMyPacks();
      }
      const first =
        getPackInstance(result.instances[0]?.instanceId ?? "") ??
        owned[0];
      if (!first) throw new PurchaseError("failed", "Pack ownership failed.");
      commitPurchaseIdempotencyKey(pack.packId, quantity);
      noteCreatorStarted(first.creatorId, pack.creator, themeName);
      setPurchaseId(result.purchaseId);
      setInstanceId(first.instanceId);
      setReadyPackCount(owned.length || quantity);
      const seededFoils = dedupeTearFoils(
        foil ? [foil] : model?.packs ?? [],
      );
      setTearFoils(
        seededFoils.length
          ? seededFoils
          : readyPacksForSession(foil ?? null, null, pack, quantity, []),
      );
      openedTearFoilKeyRef.current = null;
      setSession(
        foil
          ? {
              ...buildFoilOpeningSession([foil], cost),
              foilFaceUrl: foil.videoUrl,
              foilLabel: foil.label,
            }
          : null,
      );
      setScratched([]);
      setSelectedCard(0);
      awardedIds.current = new Set();
      settlingRevealIdsRef.current.clear();
      serverRevealCardIdsRef.current = null;
      tearLocked.current = false;
      setSealTorn(false);
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
      setPendingFoil(null);
    }
  }

  async function retryPackLoad() {
    if (retrying) return;
    setRetrying(true);
    try {
      await loadOpeningAssets();
      setStage(
        instanceId || session
          ? "ready"
          : model?.packs.length
            ? "choose"
            : "select",
      );
    } catch {
      setStage("load-failed");
    } finally {
      setRetrying(false);
    }
  }

  function remainingTearFoils(
    current: readonly FoilPack[],
    openedKey: string | null,
    remainingUnopened: number,
  ): FoilPack[] {
    if (!openedKey) return [...current];
    const next = current.filter((foil) => foilIdentityKey(foil) !== openedKey);
    // Distinct foil faces: drop the opened design. Same-face multi-buy with
    // inventory left: keep a single coverflow entry (never re-clone).
    if (!next.length && remainingUnopened > 0) {
      const kept = current.find((foil) => foilIdentityKey(foil) === openedKey);
      return kept ? [kept] : current.slice(0, 1);
    }
    return next;
  }

  async function completeTear(openedFoilId?: string | null) {
    if (tearLocked.current) return;
    const currentId =
      instanceId ??
      openResume?.instanceId ??
      pack.tearInstanceIds?.[0] ??
      peekUnopenedInstance(pack.packId)?.instanceId ??
      (purchaseId ? nextUnopenedInPurchase(purchaseId)?.instanceId : null) ??
      null;
    if (!currentId) {
      setStage("opening-interrupted");
      return;
    }
    tearLocked.current = true;

    try {
      let opened = getPackInstance(currentId);
      let next: OpeningSession;
      let scratchedIds: string[] = [];
      const live = sessionRef.current;

      if (authed && !isDemoMode() && !isLocalPackInstanceId(currentId)) {
        try {
          const result = await openPackInstance(currentId);
          upsertInstancesFromApi([
            { ...result.instance, status: "opened" },
          ]);
          openingIdRef.current = result.openingId;
          opened =
            getPackInstance(currentId) ?? markPackOpened(currentId) ?? opened;
          next = live?.foilFaceUrl
            ? {
                ...result.session,
                foilFaceUrl: live.foilFaceUrl,
                foilLabel: live.foilLabel,
              }
            : result.session;
          scratchedIds = result.scratched;
          scratchedIds.forEach((id) => awardedIds.current.add(id));
          serverRevealCardIdsRef.current = next.cards.map((card) => card.id);
        } catch {
          // Soft-continue after a paid purchase — open API blips shouldn't
          // dead-end the tear (pack stays owned locally as opened).
          if (!getPackInstance(currentId)) {
            upsertInstancesFromApi([
              {
                instanceId: currentId,
                catalogPackId: pack.packId,
                packName: pack.packName,
                creator: pack.creator,
                themeName: pack.themeName ?? pack.packName,
                coverUrl: "",
                status: "unopened",
                purchaseId:
                  purchaseId ?? pack.purchaseId ?? `local-${currentId}`,
                savedAt: Date.now(),
              },
            ]);
          }
          opened = markPackOpened(currentId) ?? getPackInstance(currentId);
          next = live?.foilFaceUrl
            ? live
            : live ?? buildOpeningSession(1, currentId);
          scratchedIds = [];
        }
      } else {
        opened = markPackOpened(currentId);
        next = live?.foilFaceUrl
          ? live
          : live ?? buildOpeningSession(1, currentId);
      }

      if (!opened || opened.status !== "opened") {
        opened = markPackOpened(currentId);
      }
      if (!opened || opened.status !== "opened") {
        tearLocked.current = false;
        setStage("opening-interrupted");
        return;
      }

      setSealTorn(true);
      const openedFoil =
        (openedFoilId
          ? tearFoils.find((foil) => foil.id === openedFoilId) ?? null
          : null) ??
        purchasedFoil ??
        (live?.foilFaceUrl
          ? {
              slot: 1 as const,
              id: live.cards[0]?.id ?? `${pack.packId}-1`,
              label: live.foilLabel ?? pack.packName,
              videoUrl: live.foilFaceUrl,
            }
          : null);
      openedTearFoilKeyRef.current = openedFoil
        ? foilIdentityKey(openedFoil)
        : openedFoilId?.trim() || null;
      if (openedFoil) setPurchasedFoil(openedFoil);
      setInstanceId(currentId);
      setPurchaseId(opened.purchaseId);
      setSession(next);
      sessionRef.current = next;
      setScratched(scratchedIds);
      setSelectedCard(0);
      upsertPackReadyToScratch({
        packId: currentId,
        session: next,
        revealed: scratchedIds,
      });
      if (pack.entry === "cart-tear") {
        const cartItemId = openedFoil?.id?.trim();
        if (cartItemId) removePackFromCart(cartItemId);
        if (tearFoils.filter((foil) => foil.id !== cartItemId).length <= 0) {
          clearCart();
        }
      }
      bumpInventory();
      trackScratchEvent("Pack Opened", { packId: currentId });
    } catch {
      tearLocked.current = false;
      setStage("opening-interrupted");
    }
  }

  function scratch(amount = 34) {
    setScratchProgress((value) => Math.min(100, value + amount));
  }

  function needsServerReveal() {
    const currentId = instanceId ?? pack.instanceId;
    return Boolean(
      authed &&
        !isDemoMode() &&
        currentId &&
        !isLocalPackInstanceId(currentId),
    );
  }

  /** Map a session/fan card id to the server PackOpeningCard uuid (by slot index). */
  function serverCardIdForReveal(sessionCardId: string): string {
    const index = session?.cards.findIndex((card) => card.id === sessionCardId) ?? -1;
    const serverId =
      index >= 0 ? serverRevealCardIdsRef.current?.[index]?.trim() : "";
    return serverId || sessionCardId;
  }

  function recordSettledRevealHistory(
    cardIds: string[],
    rewardForCard: (cardId: string) => number,
  ) {
    if (!session) return;
    const packInstanceId = instanceId ?? pack.packId;
    const historyIds = packHistoryIds(packInstanceId);
    const creatorId = pack.creator.trim().toLowerCase().replace(/\s+/g, "-");
    const openingId = openingIdRef.current;
    for (const cardId of cardIds) {
      const card = session.cards.find((entry) => entry.id === cardId);
      recordGameReveal({
        cardId,
        cardName: card?.rarity ? `${card.rarity} Card` : "Card",
        cardImageUrl: card?.faceUrl,
        packInstanceId: historyIds.packInstanceId,
        packId: historyIds.packId,
        packName: pack.packName,
        creatorId,
        creatorName: pack.creator,
        rewardCoins: rewardForCard(cardId),
        revealSessionId: openingId
          ? `${openingId}:${cardId}`
          : `${packInstanceId}:${cardId}`,
        purchaseTransactionId: purchaseId ?? historyIds.purchaseTransactionId,
      });
    }
  }

  async function resolveServerOpeningForMotion(): Promise<{
    openingId: string;
    cardIds: string[];
  } | null> {
    const currentId = instanceId ?? pack.instanceId;
    if (
      !authed ||
      isDemoMode() ||
      !currentId ||
      isLocalPackInstanceId(currentId)
    ) {
      return null;
    }
    if (
      openingIdRef.current &&
      areServerRevealCardIds(serverRevealCardIdsRef.current)
    ) {
      return {
        openingId: openingIdRef.current,
        cardIds: serverRevealCardIdsRef.current!,
      };
    }
    try {
      const result = await openPackInstance(currentId);
      openingIdRef.current = result.openingId;
      result.scratched.forEach((id) => awardedIds.current.add(id));
      serverRevealCardIdsRef.current = result.session.cards.map((card) => card.id);
      return {
        openingId: result.openingId,
        cardIds: serverRevealCardIdsRef.current,
      };
    } catch {
      return null;
    }
  }

  async function settleRevealed(revealedIds: string[]): Promise<boolean> {
    const fresh = revealedIds.filter(
      (id) =>
        !awardedIds.current.has(id) && !settlingRevealIdsRef.current.has(id),
    );
    if (!fresh.length || !session) return true;

    fresh.forEach((id) => settlingRevealIdsRef.current.add(id));

    try {
      if (needsServerReveal()) {
        const serverOpen = await resolveServerOpeningForMotion();
        if (!serverOpen) {
          releaseUnsettledRevealIds(fresh);
          setStage("opening-interrupted");
          return false;
        }
        try {
          let wallet: { diamonds: number; coins: number } | null = null;
          const rewards = new Map<string, number>();
          for (const cardId of fresh) {
            const result = await revealPackCard(
              serverOpen.openingId,
              serverCardIdForReveal(cardId),
            );
            wallet = result.wallet;
            const card = session.cards.find((entry) => entry.id === cardId);
            rewards.set(
              cardId,
              result.card.reward ?? card?.reward ?? 0,
            );
            awardedIds.current.add(cardId);
            settlingRevealIdsRef.current.delete(cardId);
          }
          recordSettledRevealHistory(fresh, (cardId) => rewards.get(cardId) ?? 0);
          if (wallet) {
            onWalletUpdate?.(wallet);
          }
          recordRevealedCards({
            count: fresh.length,
            creatorId: pack.creator.trim().toLowerCase().replace(/\s+/g, "-"),
            creatorName: pack.creator,
            themeName: collectionTheme,
          });
          onComplete({ cards: fresh.length, coins: 0 });
          return true;
        } catch {
          releaseUnsettledRevealIds(fresh);
          setStage("opening-interrupted");
          return false;
        }
      }

      fresh.forEach((id) => {
        awardedIds.current.add(id);
        settlingRevealIdsRef.current.delete(id);
      });
      recordSettledRevealHistory(fresh, (cardId) => {
        const card = session.cards.find((entry) => entry.id === cardId);
        return card?.reward ?? 0;
      });
      const coins = session.cards
        .filter((card) => fresh.includes(card.id))
        .reduce((total, card) => total + card.reward, 0);
      recordRevealedCards({
        count: fresh.length,
        creatorId: pack.creator.trim().toLowerCase().replace(/\s+/g, "-"),
        creatorName: pack.creator,
        themeName: collectionTheme,
      });
      onComplete({ cards: fresh.length, coins });
      return true;
    } catch {
      releaseUnsettledRevealIds(fresh);
      return false;
    }
  }

  async function finishSession(revealedIds: string[]) {
    const settled = await settleRevealed(revealedIds);
    if (!settled) return;
    const readyId = instanceId ?? pack.packId;
    upsertPackReadyToScratch({
      packId: readyId,
      session: session!,
      revealed: revealedIds,
    });
    trackScratchEvent("All Cards Revealed", { packId: readyId });

    const nextPack = nextQueuedTearInstance(
      pack,
      instanceId ?? pack.packId,
      purchaseId,
    );
    if (nextPack) {
      clearOpening();
      const remainingAfter = Math.max(0, readyPackCount - 1);
      const openedKey = openedTearFoilKeyRef.current;
      const remainingFoils = remainingTearFoils(
        tearFoils,
        openedKey,
        remainingAfter,
      );
      setTearFoils(remainingFoils);
      openedTearFoilKeyRef.current = null;
      const nextFace = remainingFoils[0] ?? purchasedFoil;
      setPurchasedFoil(nextFace);
      setInstanceId(nextPack.instanceId);
      setPurchaseId(nextPack.purchaseId);
      setSession(
        nextFace
          ? {
              ...buildFoilOpeningSession([nextFace], packCost(1, pack.packId)),
              foilFaceUrl: nextFace.videoUrl,
              foilLabel: nextFace.label,
            }
          : null,
      );
      setReadyPackCount((count) => Math.max(1, count - 1));
      setScratched([]);
      setSelectedCard(0);
      setScratchProgress(0);
      awardedIds.current = new Set();
      settlingRevealIdsRef.current.clear();
      openingIdRef.current = null;
      serverRevealCardIdsRef.current = null;
      tearLocked.current = false;
      setSealTorn(false);
      bumpInventory();
      setStage("ready");
      return;
    }
    setTearFoils([]);
    openedTearFoilKeyRef.current = null;
    if (pack.entry === "cart-tear") clearCart();
    setStage("complete");
  }

  async function markCurrentRevealed(): Promise<{ ids: string[]; ok: boolean }> {
    if (!session) return { ids: scratched, ok: true };
    const card = session.cards[selectedCard];
    if (
      !card ||
      scratched.includes(card.id) ||
      settlingRevealIdsRef.current.has(card.id)
    ) {
      return {
        ids: scratched,
        ok: !settlingRevealIdsRef.current.has(card?.id ?? ""),
      };
    }

    const ok = await settleRevealed([card.id]);
    if (!ok) return { ids: scratched, ok: false };

    const next = [...scratched, card.id];
    setScratched(next);
    trackScratchEvent("Card Revealed", {
      packId: instanceId ?? pack.packId,
      cardId: card.id,
    });
    return { ids: next, ok: true };
  }

  async function scratchNext() {
    if (!session || revealActionLockedRef.current) return;
    revealActionLockedRef.current = true;
    setRevealSettling(true);
    try {
      trackScratchEvent("Scratch Next Selected", {
        packId: instanceId ?? pack.packId,
      });
      const { ids: revealedIds, ok } = await markCurrentRevealed();
      if (!ok) return;
      const next = nextUnscratchedIndex(session, revealedIds);
      if (next === null) {
        await finishSession(revealedIds);
        return;
      }
      setSelectedCard(next);
      setScratchProgress(0);
    } finally {
      revealActionLockedRef.current = false;
      setRevealSettling(false);
    }
  }

  function persistOpened(revealedIds: string[]) {
    if (!session) return;
    const readyId = instanceId ?? pack.packId;
    upsertPackReadyToScratch({
      packId: readyId,
      session,
      revealed: revealedIds,
    });
    trackScratchEvent("Scratch Progress Saved", {
      packId: readyId,
      remaining: session.cards.length - revealedIds.length,
    });
    leavePersistedRef.current = true;
    bumpInventory();
  }

  function scratchLater(from: "decision" | "finish" | "exit") {
    if (savingLater || !session) return;
    setSavingLater(true);
    void persistCurrentAndLeave(from).then((ok) => {
      setSavingLater(false);
      if (ok) setStage("saved");
    });
  }

  async function persistCurrentAndLeave(
    from: "decision" | "finish" | "exit",
  ): Promise<boolean> {
    setScratchProgress(0);
    let revealedIds = scratched;
    if (from === "decision") {
      trackScratchEvent("Scratch Later Selected", {
        packId: instanceId ?? pack.packId,
      });
    } else {
      const result = await markCurrentRevealedIfDone();
      revealedIds = result.ids;
      if (!result.ok) return false;
      if (from === "finish") {
        trackScratchEvent("Finish Later Selected", {
          packId: instanceId ?? pack.packId,
        });
      } else {
        trackScratchEvent("Scratch Session Exited", {
          packId: instanceId ?? pack.packId,
        });
      }
    }
    persistOpened(revealedIds);
    clearOpening();
    return true;
  }

  function openNextPurchasedPack() {
    if (savingLater || !session) return;
    const nextPack = nextQueuedTearInstance(
      pack,
      instanceId ?? pack.packId,
      purchaseId,
    );
    if (!nextPack) {
      setTearFoils([]);
      openedTearFoilKeyRef.current = null;
      if (pack.entry === "cart-tear") clearCart();
      scratchLater("decision");
      return;
    }
    void persistCurrentAndLeave("decision").then((ok) => {
      if (!ok) {
        setSavingLater(false);
        return;
      }
      resetTearOpenState();
      const remainingAfter = Math.max(0, readyPackCount - 1);
      const openedKey = openedTearFoilKeyRef.current;
      // Drop the pack that was just opened before rebuilding the tear coverflow.
      const remainingFoils = remainingTearFoils(
        tearFoils,
        openedKey,
        remainingAfter,
      );
      setTearFoils(remainingFoils);
      openedTearFoilKeyRef.current = null;
      const nextFace = remainingFoils[0] ?? purchasedFoil;
      setPurchasedFoil(nextFace);
      setInstanceId(nextPack.instanceId);
      setPurchaseId(nextPack.purchaseId);
      openingIdRef.current = null;
      serverRevealCardIdsRef.current = null;
      setSession(
        nextFace
          ? {
              ...buildFoilOpeningSession([nextFace], packCost(1, pack.packId)),
              foilFaceUrl: nextFace.videoUrl,
              foilLabel: nextFace.label,
            }
          : {
              ...buildOpeningSession(1, nextPack.instanceId),
            },
      );
      setReadyPackCount((count) => Math.max(1, count - 1));
      setScratched([]);
      setSelectedCard(0);
      awardedIds.current = new Set();
      settlingRevealIdsRef.current.clear();
      serverRevealCardIdsRef.current = null;
      tearLocked.current = false;
      setSealTorn(false);
      setSavingLater(false);
      bumpInventory();
      setStage("ready");
    });
  }

  async function markCurrentRevealedIfDone(): Promise<{ ids: string[]; ok: boolean }> {
    if (!session || scratchProgress < 100) return { ids: scratched, ok: true };
    return markCurrentRevealed();
  }

  async function launchMotionScratch(revealCards?: RevealCard[]) {
    if (savingLater) return;

    let active = sessionRef.current;
    if (revealCards?.length) {
      const mapped = revealCards.map((card, index) => ({
        id: card.id,
        rarity:
          (index === revealCards.length - 1
            ? "Ultra Rare"
            : "Super Rare") as OpeningSession["cards"][number]["rarity"],
        reward: 10 + index * 5,
        faceUrl: card.mediaUrl,
      }));
      active = active
        ? { ...active, cards: mapped }
        : {
            ...buildOpeningSession(
              1,
              instanceId ?? pack.instanceId ?? pack.packId,
            ),
            cards: mapped,
          };
      sessionRef.current = active;
      setSession(active);
    }

    if (!active?.cards.length) {
      setModal("failed");
      return;
    }

    setSavingLater(true);
    setSealTorn(true);
    trackScratchEvent("Scratch Now Selected", {
      packId: instanceId ?? pack.packId,
    });
    trackScratchEvent("Scratch Session Started", {
      packId: instanceId ?? pack.packId,
    });
    try {
      const catalog = await loadGameCatalog();
      const modelId = model?.id ?? pack.packId;
      const openingIds = active.cards.map((card) => card.id);
      const hand = resolveMotionHandFromIds(openingIds, catalog.motion, {
        modelId,
      });
      if (hand.length === 0) {
        autoLaunchScratchRef.current = false;
        if (stage === "cards-ready") setStage("reveal");
        setModal("failed");
        return;
      }
      unlockCountdownSound();
      const openingCardIds = openingIds.slice(0, hand.length);
      const openingToMotion = new Map(
        openingCardIds.map((oid, index) => [oid, hand[index]!.id]),
      );
      const completedMotionIds = scratched
        .map((oid) => openingToMotion.get(oid))
        .filter((id): id is string => Boolean(id));
      const readyId = instanceId ?? pack.packId;
      const existing = loadGameSessionForPack(readyId);
      if (
        existing?.packScratch?.readyPackId === readyId &&
        (existing.phase === "photo_reveal" || existing.phase === "done")
      ) {
        activateGameSessionForPack(readyId);
        navigateTo("/game");
        return;
      }
      if (
        existing?.packScratch?.readyPackId === readyId &&
        existing.phase === "photo"
      ) {
        activateGameSessionForPack(readyId);
        navigateTo(photoPlayHref(existing));
        return;
      }
      upsertPackReadyToScratch({
        packId: readyId,
        session: active,
        revealed: scratched,
      });
      const serverOpen = await resolveServerOpeningForMotion();
      const created = startMotionSession(hand, {
        packScratch: {
          readyPackId: readyId,
          packName: pack.packName,
          creator: pack.creator,
          coverUrl: packCoverUrl,
          themeName: collectionTheme,
          openingSession: active,
          openingCardIds,
          settledOpeningIds: [...scratched],
          serverOpeningId: serverOpen?.openingId,
          serverRevealCardIds: serverOpen?.cardIds.slice(0, openingCardIds.length),
        },
        completedMotionIds,
      });
      clearOpening();
      bumpInventory();
      navigateTo(motionPlayHref(created));
    } catch {
      autoLaunchScratchRef.current = false;
      if (stage === "cards-ready") setStage("reveal");
      setModal("failed");
    } finally {
      setSavingLater(false);
    }
  }

  // Resume from My Collection — launch motion without replaying pack opening.
  useEffect(() => {
    if (pack.entry !== "scratch" || !session || autoLaunchScratchRef.current) {
      return;
    }
    autoLaunchScratchRef.current = true;
    void launchMotionScratch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- launchMotionScratch closes over latest session
  }, [pack.entry, session]);

  function leaveSaved(destination?: () => void) {
    leavePersistedRef.current = true;
    resetTearOpenState();
    bumpInventory();
    (destination ?? onReturnContext ?? onClose)();
  }

  function exit(destination?: () => void) {
    leavePersistedRef.current = true;
    clearOpening();
    resetTearOpenState();
    bumpInventory();
    (destination ?? onClose)();
  }

  function exitUnopened() {
    leavePersistedRef.current = true;
    clearOpening();
    resetTearOpenState();
    bumpInventory();
    setStage("saved-unopened");
  }

  function onHeaderClose() {
    if (stage === "ready") {
      if (sealTorn && session) {
        scratchLater("decision");
        return;
      }
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
      setSealTorn(false);
      settlingRevealIdsRef.current.clear();
      resetTearOpenState();
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
      className="absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[oklch(0.14_0_0)]"
    >
      {stage === "choose" || stage === "reveal" || stage === "cards-ready" ? null : (
      <header
        className="relative z-20 flex h-16 shrink-0 items-center px-4 border-b border-white/[0.08]"
      >
        <button
          type="button"
          onClick={onHeaderClose}
          className="grid size-11 place-items-center rounded-full text-white/75 hover:bg-white/10"
          aria-label={
            stage === "ready"
              ? "Save pack and exit"
              : stage === "scratch" || stage === "grid"
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
      </header>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={[
            "flex min-h-0 flex-1 flex-col bg-[oklch(0.14_0_0)]",
            stage === "choose" ||
            stage === "reveal" ||
            stage === "cards-ready" ||
            stage === "ready"
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
              diamondCost={packCost(1, model?.id ?? pack.packId)}
              catalogRevision={catalogRevision}
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
              catalogRevision={catalogRevision}
              onPurchase={(quantity) => void purchase(quantity)}
            />
          ) : null}

          {/* Open-from-Collection lands on ready with no session yet — tear
              builds one in completeTear. Requiring session hid ReadyStage and
              made Ready to Reveal "Open Pack" look broken. */}
          {stage === "ready" ? (
            <ReadyStage
              key={`${pack.packId}:${tearFoils.map((f) => f.id).join(",") || "empty"}`}
              remainingUnopened={Math.max(readyPackCount, tearFoils.length)}
              onOpened={completeTear}
              packs={
                tearFoils.length
                  ? tearFoils
                  : readyPacksForSession(
                      purchasedFoil,
                      session,
                      pack,
                      readyPackCount,
                      model?.packs ?? [],
                    )
              }
              modelId={model?.id ?? pack.packId}
              girlName={model?.name ?? pack.creator}
              overlayColor={model?.overlayColorEnd ?? "oklch(0.798 0.104 207.84)"}
              city={model?.city ?? null}
              country={model?.country ?? null}
              flagEmoji={model?.flagEmoji ?? null}
              flagSvgUrl={model?.flagSvgUrl ?? null}
              overlayColorStart={model?.overlayColorStart ?? null}
              overlayColorEnd={model?.overlayColorEnd ?? null}
              launching={savingLater}
              onCards={(cards) => {
                setSession((current) => {
                  const mapped = cards.map((card, index) => ({
                    id: card.id,
                    rarity:
                      (index === cards.length - 1
                        ? "Ultra Rare"
                        : "Super Rare") as OpeningSession["cards"][number]["rarity"],
                    reward: 10 + index * 5,
                    faceUrl: card.mediaUrl,
                  }));
                  const next = current
                    ? { ...current, cards: mapped }
                    : {
                        ...buildOpeningSession(
                          1,
                          instanceId ?? pack.instanceId ?? pack.packId,
                        ),
                        cards: mapped,
                      };
                  sessionRef.current = next;
                  return next;
                });
              }}
              onContinue={(cards) => void launchMotionScratch(cards)}
              onSaveLater={() => scratchLater("decision")}
              onSaveAndOpenNext={
                readyPackCount > 1 || tearFoils.length > 1
                  ? openNextPurchasedPack
                  : undefined
              }
            />
          ) : null}

          {stage === "reveal" ? (
            <MotionRevealStage
              modelId={model?.id ?? pack.packId}
              girlName={model?.name ?? pack.creator}
              city={model?.city ?? null}
              country={model?.country ?? null}
              flagEmoji={model?.flagEmoji ?? null}
              flagSvgUrl={model?.flagSvgUrl ?? null}
              overlayColorStart={model?.overlayColorStart ?? null}
              overlayColorEnd={model?.overlayColorEnd ?? null}
              launching={savingLater}
              onCards={(cards) => {
                setSession((current) => {
                  const mapped = cards.map((card, index) => ({
                    id: card.id,
                    rarity:
                      (index === cards.length - 1
                        ? "Ultra Rare"
                        : "Super Rare") as OpeningSession["cards"][number]["rarity"],
                    reward: 10 + index * 5,
                    faceUrl: card.mediaUrl,
                  }));
                  const next = current
                    ? { ...current, cards: mapped }
                    : {
                        ...buildOpeningSession(
                          1,
                          instanceId ?? pack.instanceId ?? pack.packId,
                        ),
                        cards: mapped,
                      };
                  sessionRef.current = next;
                  return next;
                });
              }}
              onContinue={(cards) => void launchMotionScratch(cards)}
              onSaveLater={() => scratchLater("decision")}
              onSaveAndOpenNext={
                readyPackCount > 1 ? openNextPurchasedPack : undefined
              }
            />
          ) : null}

          {stage === "cards-ready" && session ? (
            <div className="flex flex-1 flex-col items-center justify-end px-5 pb-10 text-center">
              <div className="motion-reveal__continue">
                <PurchaseCtaButton
                  label={savingLater ? "Starting…" : "Scratch Now"}
                  onClick={() => void launchMotionScratch()}
                  disabled={savingLater}
                />
              </div>
              <button
                type="button"
                className="motion-reveal__later"
                onClick={() => scratchLater("decision")}
                disabled={savingLater}
              >
                Save for Later
              </button>
              {readyPackCount > 1 ? (
                <button
                  type="button"
                  className="motion-reveal__later"
                  onClick={openNextPurchasedPack}
                  disabled={savingLater}
                >
                  Save for later and open another
                </button>
              ) : null}
            </div>
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
              settling={revealSettling}
              onScratch={scratch}
              onScratchNext={scratchNext}
              onFinishLater={() => scratchLater("finish")}
            />
          ) : null}

          {stage === "saved" ? (
            <StateScreen
              icon={<PackageOpen className="size-7" />}
              tone="success"
              title="Saved to My Collection"
              body="Scratch them whenever you're ready."
              primary={{
                label: "Continue",
                onClick: () => leaveSaved(),
              }}
              secondary={
                onGoMyBag
                  ? {
                      label: "View My Collection",
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
              title="Saved to My Collection"
              body="Your pack is waiting under Unopened Packs."
              primary={{
                label: "Continue",
                onClick: () => leaveSaved(),
              }}
              secondary={
                onGoMyBag
                  ? {
                      label: "View My Collection",
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
                label: "View My Collection",
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
                  setSealTorn(false);
                  settlingRevealIdsRef.current.clear();
                  resetTearOpenState();
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
              body="Your opening session expired. Owned packs are still in My Collection."
              primary={{
                label: "Close",
                onClick: onClose,
              }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>

      {!isScratchTutorialCompleted() &&
      !sealTorn &&
      (stage === "ready" || tearTutorialFade) ? (
        <FirstPlayTutorial scene="tear" fading={tearTutorialFade} />
      ) : null}

      {modal ? (
        <ModalShell onClose={() => setModal(null)}>
          {modal === "insufficient" ? (
            <StateScreen
              icon={<DiamondLottie size={28} aria-hidden />}
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
        ? "border-[oklch(0.711_0.166_22.22)]/30 bg-[oklch(0.711_0.166_22.22)]/10 text-[oklch(0.711_0.166_22.22)]"
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
      <div className="mt-7 h-14 w-full max-w-sm">
        <PurchaseCtaButton
          label={primary.busy ? "Working…" : primary.label}
          onClick={primary.onClick}
          disabled={primary.busy}
        />
      </div>
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

/* --------------------------------------------------------------------------
 * Stages
 * ----------------------------------------------------------------------- */

function ChoosePackStage({
  packs,
  modelId,
  girlName,
  submitting,
  diamondCost,
  catalogRevision = 0,
  onOpen,
}: {
  packs: readonly FoilPack[];
  modelId: string;
  girlName: string;
  submitting: boolean;
  diamondCost: number;
  catalogRevision?: number;
  onOpen: (foil: FoilPack) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(packs[0]?.id ?? null);
  const liveCost = packCost(1, modelId) || diamondCost;
  void catalogRevision;
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
          price: liveCost,
          girlName,
          packNumber: foil.slot === 1 ? 101 : 102,
          packName: foil.label,
          flagEmoji: "",
          backgroundColor: "oklch(0.798 0.104 207.84)",
        }),
      ),
    [catalogRevision, girlName, liveCost, modelId, packs],
  );

  useEffect(() => {
    if (!selectedId && packs[0]) setSelectedId(packs[0].id);
  }, [packs, selectedId]);

  if (!items.length) return null;

  return (
    <div
      className="stage-packs"
      style={{ ["--overlay-gradient-color-end" as string]: "oklch(0.798 0.104 207.84)" }}
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
        formatPrice={() => String(liveCost)}
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
  catalogRevision = 0,
  onPurchase,
}: {
  pack: PurchaseFlowPack;
  packImage: string;
  diamonds: number;
  submitting: boolean;
  pending: PackQuantity | null;
  catalogRevision?: number;
  onPurchase: (quantity: PackQuantity) => void;
}) {
  void catalogRevision;
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
                className="group flex min-h-24 items-center rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-left transition hover:-translate-y-1 hover:border-[oklch(0.606_0.219_292.72)]/50 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:hover:translate-y-0 aria-busy:border-[oklch(0.606_0.219_292.72)]/60"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-[oklch(0.606_0.219_292.72)]/20 text-[oklch(0.811_0.101_293.57)]">
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
                  <DiamondLottie size={14} aria-hidden />
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

const COVERFLOW_MOBILE_QUERY = "(max-width: 980px)";

const TEAR_OPEN_MOBILE_CAMERA: CoverFlowCameraSettings = {
  cameraX: 0.11,
  cameraY: 0.27,
  cameraZ: 6.45,
  fov: 36,
  lookAtY: 0,
  packsX: 0.115,
  packsY: -0.58,
  modelY: -0.59,
};

function isMobileCoverflowViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(COVERFLOW_MOBILE_QUERY).matches
  );
}

function ReadyStage({
  remainingUnopened,
  onOpened,
  packs,
  modelId,
  girlName,
  overlayColor,
  city,
  country,
  flagEmoji,
  flagSvgUrl,
  overlayColorStart,
  overlayColorEnd,
  launching = false,
  onCards,
  onContinue,
  onSaveLater,
  onSaveAndOpenNext,
}: {
  remainingUnopened: number;
  onOpened: (openedFoilId?: string | null) => void;
  packs: readonly FoilPack[];
  modelId: string;
  girlName: string;
  overlayColor: string;
  city: string | null;
  country: string | null;
  flagEmoji: string | null;
  flagSvgUrl: string | null;
  overlayColorStart: string | null;
  overlayColorEnd: string | null;
  launching?: boolean;
  onCards: (cards: RevealCard[]) => void;
  onContinue: (cards?: RevealCard[]) => void;
  onSaveLater: () => void;
  onSaveAndOpenNext?: () => void;
}) {
  const tear = useCoverflowTearSlider();
  const openedRef = useRef(false);
  const onCardsRef = useRef(onCards);
  const onContinueRef = useRef(onContinue);
  const onSaveLaterRef = useRef(onSaveLater);
  const onSaveAndOpenNextRef = useRef(onSaveAndOpenNext);
  onCardsRef.current = onCards;
  onContinueRef.current = onContinue;
  onSaveLaterRef.current = onSaveLater;
  onSaveAndOpenNextRef.current = onSaveAndOpenNext;
  const handleRevealCards = useCallback((cards: RevealCard[]) => {
    onCardsRef.current(cards);
  }, []);
  const handleRevealContinue = useCallback((cards: RevealCard[]) => {
    onContinueRef.current(cards);
  }, []);
  const handleRevealSaveLater = useCallback(() => {
    onSaveLaterRef.current();
  }, []);
  const handleRevealSaveAndOpenNext = useCallback(() => {
    onSaveAndOpenNextRef.current?.();
  }, []);
  // Parent rebuilds `packs` every render; key off stable foil identity so the
  // coverflow doesn't thrash focus/selection on unrelated parent updates.
  const packsKey = packs.map((foil) => `${foil.id}|${foil.videoUrl}|${foil.slot}`).join(";");
  // Only settle after a user-driven tear finish this mount — never from a
  // leftover tearT≈1 in memory from a previous open.
  const userTearRef = tear.finishStartedRef;
  const items = useMemo(
    () =>
      (packs.length
        ? packs
        : [
            {
              id: `pack-${modelId}`,
              slot: 1 as const,
              label: girlName,
              videoUrl: "",
            },
          ]
      ).map((foil) =>
        packItemToIteration({
          id: foil.id,
          characterId: modelId,
          name: girlName,
          modelUrl: "/assets/CardPack2-min.glb",
          modelName: "CardPack2-min.glb",
          videoUrl: foil.videoUrl,
          price: 0,
          girlName,
          packNumber: foil.slot === 1 ? 101 : 102,
          packName: foil.label,
          flagEmoji: flagEmoji ?? "",
          flagSvgUrl: flagSvgUrl ?? "",
          city: city ?? "",
          country: country ?? "",
          overlayColorStart: overlayColorStart ?? overlayColor,
          overlayColorEnd: overlayColorEnd ?? overlayColor,
          backgroundColor: overlayColor,
        }),
      ),
    // packsKey captures foil identity; packs itself is intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      city,
      country,
      flagEmoji,
      flagSvgUrl,
      girlName,
      modelId,
      overlayColor,
      overlayColorEnd,
      overlayColorStart,
      packsKey,
    ],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => items[0]?.id ?? null,
  );
  const [isMobileViewport, setIsMobileViewport] = useState(
    isMobileCoverflowViewport,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(COVERFLOW_MOBILE_QUERY);
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const cameraSettings = isMobileViewport ? TEAR_OPEN_MOBILE_CAMERA : undefined;

  useEffect(() => {
    if (!items.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) =>
      current && items.some((item) => item.id === current)
        ? current
        : items[0]!.id,
    );
  }, [items]);

  // Reset tear state before paint so a prior session's tearT≈1 cannot
  // auto-fire onOpened / open reveal mode on mount.
  useLayoutEffect(() => {
    tear.replayTear();
  }, []);

  const lastTearResetIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Switching the front pack should never leave a half-torn seal behind.
    // Skip no-op re-entry of the same id so tear/open state doesn't thrash.
    if (!selectedId || selectedId === lastTearResetIdRef.current) return;
    lastTearResetIdRef.current = selectedId;
    tear.replayTear();
    openedRef.current = false;
  }, [selectedId]);

  useEffect(() => {
    if (openedRef.current || !selectedId) return;
    // Only settle after a user-driven tear finish this mount — never from a
    // persisted tearT≈1 left over from a previous pack open.
    if (!userTearRef.current) return;
    if (tear.debug.tearT < 0.999) return;
    openedRef.current = true;
    onOpened(selectedId);
  }, [onOpened, selectedId, tear.debug.tearT, userTearRef]);

  // Opening the next purchased pack rewinds tear without remounting ReadyStage.
  useEffect(() => {
    if (tear.debug.tearT > 0.01 || tear.debug.packOpenRequested) return;
    openedRef.current = false;
  }, [tear.debug.packOpenRequested, tear.debug.tearT]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {!selectedId ? (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-20 px-5 text-center">
          <p className="text-[12px] font-semibold tracking-[0.16em] text-[oklch(0.767_0.139_91.06)] uppercase">
            {remainingUnopened <= 1
              ? "Pack ready"
              : `${remainingUnopened} packs ready to open`}
          </p>
          <h1 className="mt-2 text-[28px] font-bold">Inspect. Then tear the seal.</h1>
          <p className="mt-2 text-[13px] text-white/45">Select a pack, then swipe to open.</p>
        </div>
      ) : null}
      <div
        className="stage-packs"
        style={{ ["--overlay-gradient-color-end" as string]: overlayColor }}
      >
        <div className="packs-glow-stack packs-glow-stack--base" aria-hidden="true">
          <div className="packs-circle packs-circle--bloom" />
          <div className="packs-circle packs-circle--core" />
        </div>
        <CoverFlowCarouselV2
          items={items}
          selectedId={selectedId}
          cameraSettings={cameraSettings}
          onSelect={setSelectedId}
          onDeselect={() => {
            // Tear page always keeps a pack selected (carousel also ignores
            // deselect while disableSwipeDownDeactivate is on).
            openedRef.current = false;
          }}
          hideActiveCta
          disableSwipeDownDeactivate
          disableWheelPaging
          tearDrivesReveal
          revealModelId={modelId}
          revealGirlName={girlName}
          revealOverlay={{
            city,
            country,
            flagEmoji,
            flagSvgUrl,
            gradientColor: overlayColorStart ?? overlayColor,
            gradientColorEnd: overlayColorEnd ?? overlayColor,
          }}
          revealContinueLabel={launching ? "Starting…" : "Scratch Now"}
          onRevealCards={handleRevealCards}
          onRevealContinue={handleRevealContinue}
          onRevealSaveLater={handleRevealSaveLater}
          onRevealSaveAndOpenNext={
            onSaveAndOpenNext ? handleRevealSaveAndOpenNext : undefined
          }
          tearHud={
            selectedId && !tear.debug.packOpenRequested ? (
              <DragToTearControl
                percent={tear.sliderPercent}
                finishing={tear.finishing}
                onScrub={tear.scrubSlider}
              />
            ) : null
          }
        />
      </div>
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
  launching = false,
  onCards,
  onContinue,
  onSaveLater,
  onSaveAndOpenNext,
}: {
  modelId: string;
  girlName: string;
  city: string | null;
  country: string | null;
  flagEmoji: string | null;
  flagSvgUrl: string | null;
  overlayColorStart: string | null;
  overlayColorEnd: string | null;
  launching?: boolean;
  onCards: (cards: RevealCard[]) => void;
  onContinue: (cards?: RevealCard[]) => void;
  onSaveLater: () => void;
  onSaveAndOpenNext?: () => void;
}) {
  const [backendFan, setBackendFan] = useState<BackendFanCatalog | null>(null);
  const [fanLayout] = useState(() => loadFanLayout());
  const [fanDrag] = useState(() => loadFanDrag());
  const onCardsRef = useRef(onCards);
  onCardsRef.current = onCards;
  const sequence = useRevealSequence({
    autoStart: true,
    autoStartKey: modelId,
    autoStartDelayMs: 80,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchPackFanCatalog(modelId).then(async (result) => {
      if (cancelled) return;
      const fan =
        result && result.cards.length > 0 ? result : await fetchPackFanCatalog();
      if (cancelled || !fan) return;
      setBackendFan(fan);
    });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  useEffect(() => {
    if (!sequence.showPlay) return;
    trackScratchEvent("Scratch Decision Shown", { packId: modelId });
  }, [modelId, sequence.showPlay]);

  const cards = useMemo(() => {
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
        gradientColor: overlayColorStart ?? "oklch(0.798 0.104 207.84)",
        gradientColorEnd: overlayColorEnd ?? "oklch(0.798 0.104 207.84)",
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
        <div className="motion-reveal__cta">
          <div className="motion-reveal__continue">
            <PurchaseCtaButton
              label={launching ? "Starting…" : "Scratch Now"}
              onClick={() => onContinue(cards)}
              disabled={launching}
            />
          </div>
          <button
            type="button"
            className="motion-reveal__later"
            onClick={onSaveLater}
            disabled={launching}
          >
            Save for Later
          </button>
          {onSaveAndOpenNext ? (
            <button
              type="button"
              className="motion-reveal__later"
              onClick={onSaveAndOpenNext}
              disabled={launching}
            >
              Save for later and open another
            </button>
          ) : null}
        </div>
      ) : null}
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
                "aspect-[3/4] rounded-[20px] border bg-[radial-gradient(circle_at_30%_20%,oklch(0.627_0.233_303.9_/_0.7),#151515_58%)] p-3 text-left transition",
                done
                  ? "cursor-not-allowed border-white/10 opacity-45"
                  : "hover:-translate-y-1",
                selected === index && !done ? "border-[oklch(0.606_0.219_292.72)]" : "border-white/15",
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
  settling = false,
  onScratch,
  onScratchNext,
  onFinishLater,
}: {
  card: OpeningSession["cards"][number];
  image: string;
  progress: number;
  remainingAfterReveal: number;
  settling?: boolean;
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
      <p className="text-[12px] font-semibold tracking-[0.15em] text-[oklch(0.767_0.139_91.06)] uppercase">
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
      <div className="relative mt-7 aspect-[3/4] w-[240px] overflow-hidden rounded-[24px] border border-white/20 bg-[oklch(0.196_0_0)] shadow-2xl">
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
          <p className="text-[13px] text-[oklch(0.767_0.139_91.06)]">+{card.reward} Sugar Coins</p>
        </div>
        <motion.button
          type="button"
          aria-label="Scratch card cover"
          drag={revealed ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={drag}
          onClick={() => onScratch()}
          animate={{ opacity: Math.max(0, 1 - progress / 100) }}
          className="absolute inset-0 z-20 cursor-ew-resize touch-none bg-[linear-gradient(135deg,oklch(0.522_0.12_292.97),#171421_45%,#d4af37_100%)]"
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
          <div className="h-14 w-full">
            <PurchaseCtaButton
              label={
                settling
                  ? "Revealing…"
                  : hasMore
                    ? "Scratch Next"
                    : "Finish"
              }
              onClick={onScratchNext}
              disabled={settling}
            />
          </div>
          {hasMore ? (
            <button
              type="button"
              onClick={onFinishLater}
              disabled={settling}
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
      <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-white/[0.1] bg-[oklch(0.191_0.01_303.57)] shadow-[0_24px_60px_oklch(0_0_0_/_0.55)]">
        {children}
      </div>
    </div>
  );
}

function stageTitle(stage: Stage) {
  if (stage === "choose") return "Choose Pack";
  if (stage === "select") return "Purchase Pack";
  if (stage === "ready") return "Pack Ready";
  if (stage === "reveal") return "Opening Reveal";
  if (stage === "preview" || stage === "grid") return "Choose Card";
  if (stage === "cards-ready") return "Starting";
  if (stage === "complete") return "Session Complete";
  if (stage === "saved" || stage === "saved-unopened") return "Saved";
  if (stage === "load-failed") return "Loading Failed";
  if (stage === "opening-interrupted") return "Opening Interrupted";
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
