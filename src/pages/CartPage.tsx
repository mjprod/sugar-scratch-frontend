import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ShoppingBag } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { EmptyState } from "@/components/EmptyState";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { CoverFlowCarouselV2 } from "@/features/packs/CoverFlowCarouselV2";
import { packItemToIteration, type Iteration } from "@/features/packs/types";
import "@/features/packs/packs.css";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import { isDemoMode } from "@/lib/demo";
import {
  clearCart,
  listCartPacks,
  removePackFromCart,
  subscribeCart,
  type CartPack,
} from "@/services/cart";
import {
  addUnopenedFromPurchase,
  listUnopenedInstances,
  type OwnedPackInstance,
  upsertInstancesFromApi,
} from "@/services/packInventory";
import {
  PurchaseError,
  cartCheckoutIdempotencyKey,
  commitPurchaseIdempotencyKey,
  loadPackCatalog,
  packCost,
  resolvePurchasePackId,
  submitPurchase,
} from "@/services/purchase";
import { recordPackPurchaseTransaction } from "@/services/transactionHistory";
import {
  getCardTopDebug,
  setCardTopTearT,
  setPackOpenRequested,
  rewindCardTopTear,
} from "@/features/packs/cardTopDebug";
import { resolveCollectionThemeLabel } from "@/services/collection";
import {
  loadModels,
  matchModel,
  profileFromModel,
} from "@/services/models";

const DEFAULT_GLOW = "oklch(0.798 0.104 207.84)";
const PACK_MODEL_URL = "/assets/CardPack2-min.glb";

function catalogPackIdForCartItem(
  cartPack: CartPack,
  profiles: Awaited<ReturnType<typeof loadModels>> | null,
) {
  const matched = profiles ? foilForCartPack(cartPack, profiles) : null;
  return matched?.profile.id || cartPack.characterId || cartPack.packId;
}

function cartFoilsFromPacks(
  packs: CartPack[],
  profiles: Awaited<ReturnType<typeof loadModels>> | null,
) {
  return packs.map((cartPack) => {
    const item = profiles ? foilForCartPack(cartPack, profiles) : null;
    return {
      id: cartPack.cartItemId,
      label: item?.foil?.label || cartPack.packName,
      videoUrl: item?.foil?.videoUrl || cartPack.videoUrl,
      slot: item?.foil?.slot,
    };
  });
}

function openCartTearFlow(input: {
  remaining: CartPack[];
  profiles: Awaited<ReturnType<typeof loadModels>> | null;
  instanceIds: string[];
  purchaseId: string;
  openPurchase: ReturnType<typeof useAuth>["openPurchase"];
  /** Demo checkout still holds cart rows until tear opens; authed removes per line. */
  clearCartAfterOpen?: boolean;
}) {
  const {
    remaining,
    profiles,
    instanceIds,
    purchaseId,
    openPurchase,
    clearCartAfterOpen = false,
  } = input;
  const first = remaining[0];
  if (!first || !instanceIds.length) return;
  const matched = profiles ? foilForCartPack(first, profiles) : null;
  const packId = catalogPackIdForCartItem(first, profiles);
  openPurchase(
    {
      packId,
      packName: matched?.foil?.label || first.packName,
      price: String(first.price || 0),
      creator: matched?.profile.name || first.creator,
      entry: "cart-tear",
      unopenedPacks: remaining.length,
      instanceId: instanceIds[0],
      purchaseId,
      tearInstanceIds: instanceIds,
      cartFoils: cartFoilsFromPacks(remaining, profiles),
    },
    "open-pack",
  );
  if (clearCartAfterOpen) clearCart();
}

function foilForCartPack(
  pack: CartPack,
  profiles: Awaited<ReturnType<typeof loadModels>>,
) {
  const model = matchModel(profiles, {
    packId: pack.characterId || pack.packId,
    name: pack.creator,
  });
  if (!model) return null;
  const profile = profileFromModel(model);
  const byId = profile.packs.find((foil) => foil.id === pack.packId);
  if (byId) return { profile, foil: byId };
  const bySlot = profile.packs.find(
    (foil) => foil.slot === (pack.packNumber === 102 ? 2 : 1),
  );
  return { profile, foil: bySlot ?? profile.packs[0] ?? null };
}

function diamondCostForCartPack(
  cartPack: CartPack,
  profiles: Awaited<ReturnType<typeof loadModels>> | null,
  catalog: Awaited<ReturnType<typeof loadPackCatalog>>,
) {
  const catalogId = catalogPackIdForCartItem(cartPack, profiles);
  if (catalog.length) {
    const purchaseId = resolvePurchasePackId(catalog, catalogId);
    return packCost(1, purchaseId);
  }
  // Catalog still loading — keep the cart snapshot so we don't flash the demo default.
  if (cartPack.price > 0) return cartPack.price;
  return packCost(1, catalogId);
}

function cartPacksToItems(
  packs: CartPack[],
  profiles: Awaited<ReturnType<typeof loadModels>> | null,
  catalog: Awaited<ReturnType<typeof loadPackCatalog>>,
) {
  return packs.map((pack) => {
    const matched = profiles ? foilForCartPack(pack, profiles) : null;
    const foil = matched?.foil;
    const profile = matched?.profile;
    return packItemToIteration({
      id: pack.cartItemId,
      characterId: profile?.id || pack.characterId,
      name: profile?.name || pack.creator,
      modelUrl: PACK_MODEL_URL,
      modelName: "CardPack2-min.glb",
      videoUrl: foil?.videoUrl || pack.videoUrl,
      price: diamondCostForCartPack(pack, profiles, catalog),
      girlName: profile?.name || pack.creator,
      packNumber: foil?.slot === 2 ? 102 : pack.packNumber,
      packName: foil?.label || pack.packName,
      flagEmoji: profile?.flagEmoji || pack.flagEmoji,
      flagSvgUrl: profile?.flagSvgUrl || pack.flagSvgUrl,
      city: profile?.city || pack.city,
      country: profile?.country || pack.country,
      overlayColorStart:
        profile?.overlayColorStart || pack.overlayColorStart || DEFAULT_GLOW,
      overlayColorEnd:
        profile?.overlayColorEnd || pack.overlayColorEnd || DEFAULT_GLOW,
      backgroundColor:
        profile?.overlayColorEnd || pack.backgroundColor || DEFAULT_GLOW,
    });
  });
}

function foilForOwnedInstance(
  pack: OwnedPackInstance,
  profiles: Awaited<ReturnType<typeof loadModels>> | null,
) {
  if (!profiles) return null;
  const model = matchModel(profiles, {
    packId: pack.catalogPackId,
    name: pack.creator,
  });
  if (!model) return null;
  const profile = profileFromModel(model);
  const byId = profile.packs.find((foil) => foil.id === pack.catalogPackId);
  return { profile, foil: byId ?? profile.packs[0] ?? null };
}

/** Owned sealed packs shown in Pack Pocket when the cart itself is empty. */
function unopenedInstancesToItems(
  instances: OwnedPackInstance[],
  profiles: Awaited<ReturnType<typeof loadModels>> | null,
): Iteration[] {
  // Newest first so the pack just left on tear-open is front-and-center.
  const ordered = [...instances].sort((a, b) => b.savedAt - a.savedAt);
  return ordered.map((pack) => {
    const matched = foilForOwnedInstance(pack, profiles);
    const foil = matched?.foil;
    const profile = matched?.profile;
    return packItemToIteration({
      id: pack.instanceId,
      characterId: profile?.id || pack.creatorId,
      name: profile?.name || pack.creator,
      modelUrl: PACK_MODEL_URL,
      modelName: "CardPack2-min.glb",
      videoUrl: foil?.videoUrl || pack.coverUrl,
      price: 0,
      girlName: profile?.name || pack.creator,
      packNumber: foil?.slot === 2 ? 102 : 101,
      packName: foil?.label || pack.packName,
      flagEmoji: profile?.flagEmoji || "",
      flagSvgUrl: profile?.flagSvgUrl || undefined,
      city: profile?.city || undefined,
      country: profile?.country || undefined,
      overlayColorStart: profile?.overlayColorStart || DEFAULT_GLOW,
      overlayColorEnd: profile?.overlayColorEnd || DEFAULT_GLOW,
      backgroundColor: profile?.overlayColorEnd || DEFAULT_GLOW,
    });
  });
}

function openOwnedUnopenedFlow(input: {
  instances: OwnedPackInstance[];
  profiles: Awaited<ReturnType<typeof loadModels>> | null;
  openPurchase: ReturnType<typeof useAuth>["openPurchase"];
  startInstanceId?: string;
}) {
  const { instances, profiles, openPurchase, startInstanceId } = input;
  if (!instances.length) return;
  const ordered = [...instances].sort((a, b) => b.savedAt - a.savedAt);
  const startIndex = startInstanceId
    ? Math.max(
        0,
        ordered.findIndex((pack) => pack.instanceId === startInstanceId),
      )
    : 0;
  const rotated =
    startIndex > 0
      ? [...ordered.slice(startIndex), ...ordered.slice(0, startIndex)]
      : ordered;
  const first = rotated[0];
  const matched = foilForOwnedInstance(first, profiles);
  openPurchase(
    {
      packId: first.catalogPackId,
      packName: matched?.foil?.label || first.packName,
      themeName: first.themeName || first.packName,
      price: "Free",
      creator: matched?.profile.name || first.creator,
      entry: "open",
      unopenedPacks: rotated.length,
      instanceId: first.instanceId,
      purchaseId: first.purchaseId,
      tearInstanceIds: rotated.map((pack) => pack.instanceId),
      cartFoils: rotated.map((pack, index) => {
        const foilMatch = foilForOwnedInstance(pack, profiles);
        return {
          id: pack.instanceId,
          label: foilMatch?.foil?.label || pack.packName,
          videoUrl: foilMatch?.foil?.videoUrl || pack.coverUrl,
          slot: foilMatch?.foil?.slot ?? ((index === 0 ? 1 : 2) as 1 | 2),
        };
      }),
    },
    "open-pack",
  );
}

export function CartPage() {
  const {
    requestTab,
    openPurchase,
    openStore,
    requireAuth,
    guest,
    authed,
    bumpInventoryRevision,
    inventoryRevision,
    setPurchasedPacks,
    setNavNotice,
  } = useAuth();
  const { diamonds, coins, setDiamonds, setCoins } = useWallet();
  const [packs, setPacks] = useState<CartPack[]>(() => listCartPacks());
  const [unopenedOwned, setUnopenedOwned] = useState<OwnedPackInstance[]>(() =>
    listUnopenedInstances(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => listCartPacks()[0]?.cartItemId ?? null,
  );
  const [glow, setGlow] = useState(
    () => listCartPacks()[0]?.backgroundColor || DEFAULT_GLOW,
  );
  const [models, setModels] = useState<Awaited<ReturnType<typeof loadModels>> | null>(
    null,
  );
  const [packCatalog, setPackCatalog] = useState<
    Awaited<ReturnType<typeof loadPackCatalog>>
  >([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState<
    null | "insufficient" | "failed"
  >(null);
  const [openingOwned, setOpeningOwned] = useState(false);

  useMarkPageReady(true);

  // Synchronous too: CoverFlow reads packOpenRequested in useState initializers
  // during this render (before layout effects). Only write when dirty.
  /* sync tear reset */
  {
    const debug = getCardTopDebug();
    if (debug.packOpenRequested || debug.tearPlaying || debug.tearT > 0) {
      rewindCardTopTear();
      setPackOpenRequested(false);
      setCardTopTearT(0, false);
    }
  }

  useEffect(() => subscribeCart(() => setPacks(listCartPacks())), []);

  // Refresh owned sealed packs when inventory changes (e.g. left tear-open).
  useEffect(() => {
    setUnopenedOwned(listUnopenedInstances());
  }, [inventoryRevision, packs.length]);

  // Pack Pocket is browse-only. Clear leftover tear/open state before paint so
  // CoverFlow never mounts already mid-tear / auto-opening from a prior checkout.
  useLayoutEffect(() => {
    rewindCardTopTear();
    setPackOpenRequested(false);
    setCardTopTearT(0, false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadModels()
      .then((loaded) => {
        if (!cancelled) setModels(loaded);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPackCatalog()
      .then((loaded) => {
        if (!cancelled) setPackCatalog(loaded);
      })
      .catch(() => {
        if (!cancelled) setPackCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cartItems = useMemo(
    () => cartPacksToItems(packs, models, packCatalog),
    [models, packCatalog, packs],
  );

  const ownedItems = useMemo(
    () => unopenedInstancesToItems(unopenedOwned, models),
    [models, unopenedOwned],
  );

  /** Cart rows win; when empty, show ready-to-tear owned packs instead. */
  const showingOwnedUnopened = cartItems.length === 0 && ownedItems.length > 0;
  const items = showingOwnedUnopened ? ownedItems : cartItems;

  const combinedPrice = useMemo(() => {
    return packs.reduce(
      (sum, cartPack) =>
        sum + diamondCostForCartPack(cartPack, models, packCatalog),
      0,
    );
  }, [models, packCatalog, packs]);

  useEffect(() => {
    if (!items.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
      setGlow(items[0].backgroundColor || DEFAULT_GLOW);
    }
  }, [items, selectedId]);

  function openSelectedOwnedPack() {
    if (openingOwned || !showingOwnedUnopened || !unopenedOwned.length) return;
    setOpeningOwned(true);
    try {
      openOwnedUnopenedFlow({
        instances: unopenedOwned,
        profiles: models,
        openPurchase,
        startInstanceId: selectedId ?? undefined,
      });
    } finally {
      setOpeningOwned(false);
    }
  }

  async function continueToTear() {
    if (checkingOut) return;
    const remaining = listCartPacks();
    const first = remaining[0];
    if (!first) return;
    setCheckoutModal(null);
    setCheckingOut(true);
    try {
      if (authed && !isDemoMode()) {
        let balance = diamonds;
        const purchasedLines: CartPack[] = [];
        const instanceIds: string[] = [];
        let lastPurchaseId = "";
        let partialFailure: PurchaseError | null = null;

        const catalog = packCatalog.length ? packCatalog : await loadPackCatalog();
        if (!packCatalog.length && catalog.length) setPackCatalog(catalog);

        for (const cartPack of remaining) {
          const catalogId = catalogPackIdForCartItem(cartPack, models);
          const purchaseId = resolvePurchasePackId(catalog, catalogId);
          const cost = packCost(1, purchaseId);
          if (cost > balance) {
            partialFailure = new PurchaseError(
              "insufficient",
              "Not enough diamonds to open these packs.",
            );
            break;
          }
          try {
            const result = await submitPurchase(
              1,
              balance,
              purchaseId,
              cartCheckoutIdempotencyKey(cartPack.cartItemId),
              coins,
            );
            balance = result.wallet.diamonds;
            setDiamonds(result.wallet.diamonds);
            setCoins(result.wallet.coins);
            const owned = upsertInstancesFromApi(result.instances);
            const instanceId =
              result.instances[0]?.instanceId ?? owned[0]?.instanceId;
            if (!instanceId) {
              throw new PurchaseError("failed", "Pack ownership failed.");
            }
            recordPackPurchaseTransaction({
              purchaseId: result.purchaseId,
              packId: catalogId,
              packName:
                result.instances[0]?.packName || cartPack.packName,
              creatorName:
                result.instances[0]?.creator || cartPack.creator,
              quantity: result.instances.length || 1,
              diamondCost: result.diamondCost,
            });
            purchasedLines.push(cartPack);
            instanceIds.push(instanceId);
            lastPurchaseId = result.purchaseId;
            removePackFromCart(cartPack.cartItemId);
            commitPurchaseIdempotencyKey(purchaseId, 1);
          } catch (error) {
            partialFailure =
              error instanceof PurchaseError
                ? error
                : new PurchaseError("failed", "Checkout failed.");
            break;
          }
        }

        setPacks(listCartPacks());

        if (purchasedLines.length > 0) {
          bumpInventoryRevision();
          setPurchasedPacks((count) => count + purchasedLines.length);
          openCartTearFlow({
            remaining: purchasedLines,
            profiles: models,
            instanceIds,
            purchaseId: lastPurchaseId,
            openPurchase,
          });
          if (partialFailure && purchasedLines.length < remaining.length) {
            setNavNotice(
              partialFailure.kind === "insufficient"
                ? "Some packs purchased. The rest are still in Pack Pocket."
                : "Some packs purchased. Retry the rest from Pack Pocket.",
            );
            window.setTimeout(() => setNavNotice(""), 3200);
          }
          return;
        }

        if (partialFailure) {
          throw partialFailure;
        }
        return;
      }

      const matched = models ? foilForCartPack(first, models) : null;
      const packId = catalogPackIdForCartItem(first, models);
      const purchaseId = `cart-${Date.now().toString(36)}`;
      const themeName =
        resolveCollectionThemeLabel({
          packName: matched?.foil?.label || first.packName,
          catalogPackId: packId,
          creator: matched?.profile.name || first.creator,
        }) ||
        matched?.foil?.label ||
        first.packName;
      const created = addUnopenedFromPurchase({
        purchaseId,
        catalogPackId: packId,
        packName: matched?.foil?.label || first.packName,
        creator: matched?.profile.name || first.creator,
        count: remaining.length,
        themeName,
      });
      openCartTearFlow({
        remaining,
        profiles: models,
        instanceIds: created.map((pack) => pack.instanceId),
        purchaseId,
        openPurchase,
        clearCartAfterOpen: true,
      });
    } catch (error) {
      setCheckoutModal(
        error instanceof PurchaseError && error.kind === "insufficient"
          ? "insufficient"
          : "failed",
      );
      setPacks(listCartPacks());
    } finally {
      setCheckingOut(false);
    }
  }

  if (!items.length) {
    return (
      <section
        className="absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[oklch(0.14_0_0)]"
        aria-label="Pack Pocket"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <EmptyState
            icon={ShoppingBag}
            title="Your pack pocket is empty"
            copy="Buy a pack and it will wait here, ready to check out."
            action={
              <CtaButton
                {...ctaButtonPropsFromTemplate("squircleCTA")}
                label="Browse packs"
                costAmount={null}
                width={200}
                height={48}
                fontSize={14}
                onClick={() => requestTab("feed")}
              />
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className="absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[oklch(0.14_0_0)]"
      aria-label={showingOwnedUnopened ? "Pack Pocket" : "Cart"}
    >
      <div
        className="stage-packs"
        style={{ ["--overlay-gradient-color-end" as string]: glow }}
      >
        <div
          className="packs-glow-stack packs-glow-stack--base"
          aria-hidden="true"
        >
          <div className="packs-circle packs-circle--bloom" />
          <div className="packs-circle packs-circle--core" />
        </div>
        <CoverFlowCarouselV2
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDeselect={() => setSelectedId(null)}
          // Browse-only: never inherit tear/open reveal from a prior checkout.
          disablePackOpenReveal
          onFocusChange={(item) => {
            setGlow(item?.backgroundColor || DEFAULT_GLOW);
          }}
          formatPrice={(price) => String(price)}
          // Owned ready-to-tear packs are not cart lines — no remove chrome.
          onRemove={
            showingOwnedUnopened
              ? undefined
              : (item) => {
                  const next = removePackFromCart(item.id);
                  setPacks(next);
                }
          }
          hideActiveCta={showingOwnedUnopened}
        />
        <div className="cart-continue">
          {showingOwnedUnopened ? (
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              className="cart-continue__cta"
              label={openingOwned ? "Opening…" : "Open Pack"}
              costAmount={null}
              width={248}
              height={56}
              fontSize={16}
              aria-label="Open pack"
              disabled={openingOwned}
              onClick={() => openSelectedOwnedPack()}
            />
          ) : (
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              className="cart-continue__cta"
              leadingIcon={
                <span className="cart-continue__cost">
                  <DiamondLottie size={16} aria-hidden />
                  <span className="cart-continue__cost-amount">
                    {combinedPrice}
                  </span>
                </span>
              }
              label={checkingOut ? "Checking out…" : "Confirm"}
              costAmount={null}
              width={248}
              height={56}
              fontSize={16}
              aria-label={`${combinedPrice} diamonds, Confirm`}
              disabled={checkingOut}
              onClick={() => void continueToTear()}
            />
          )}
        </div>
      </div>

      {checkoutModal ? (
        <CartCheckoutModal
          kind={checkoutModal}
          onClose={() => setCheckoutModal(null)}
          onGetDiamonds={() => {
            setCheckoutModal(null);
            if (!guest) openStore();
            else requireAuth({ type: "store" });
          }}
        />
      ) : null}
    </section>
  );
}

function CartCheckoutModal({
  kind,
  onClose,
  onGetDiamonds,
}: {
  kind: "insufficient" | "failed";
  onClose: () => void;
  onGetDiamonds: () => void;
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
        {kind === "insufficient" ? (
          <CartCheckoutModalBody
            icon={<DiamondLottie size={28} aria-hidden />}
            tone="warn"
            title="Not enough diamonds"
            body="Not enough diamonds to open these packs. Top up to continue — your balance was not charged."
            primary={{ label: "Get Diamonds", onClick: onGetDiamonds }}
            secondary={{ label: "Close", onClick: onClose }}
          />
        ) : (
          <CartCheckoutModalBody
            icon={<AlertTriangle className="size-7" />}
            tone="danger"
            title="Checkout failed"
            body="Something went wrong and you were not charged. Your packs are still in Pack Pocket."
            primary={{ label: "Close", onClick: onClose }}
          />
        )}
      </div>
    </div>
  );
}

function CartCheckoutModalBody({
  icon,
  tone,
  title,
  body,
  primary,
  secondary,
}: {
  icon: ReactNode;
  tone: "warn" | "danger";
  title: string;
  body: string;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
      : "border-[oklch(0.711_0.166_22.22)]/30 bg-[oklch(0.711_0.166_22.22)]/10 text-[oklch(0.711_0.166_22.22)]";

  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span
        className={["grid size-16 place-items-center rounded-full border", toneClass].join(" ")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="mt-5 text-[24px] font-bold tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/55">{body}</p>
      <div className="mt-7 h-14 w-full max-w-sm">
        <CtaButton
          {...ctaButtonPropsFromTemplate("squircleCTA")}
          fillParent
          label={primary.label}
          costAmount={null}
          fontSize={15}
          strokeWidth={1}
          onClick={primary.onClick}
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
