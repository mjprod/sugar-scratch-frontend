import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { EmptyState } from "@/components/EmptyState";
import { CoverFlowCarouselV2 } from "@/features/packs/CoverFlowCarouselV2";
import { packItemToIteration } from "@/features/packs/types";
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
  upsertInstancesFromApi,
} from "@/services/packInventory";
import {
  PurchaseError,
  cartCheckoutIdempotencyKey,
  commitPurchaseIdempotencyKey,
  packCost,
  submitPurchase,
} from "@/services/purchase";
import {
  getCardTopDebug,
  setCardTopTearT,
  setPackOpenRequested,
  rewindCardTopTear,
} from "@/features/packs/cardTopDebug";
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

function cartPacksToItems(
  packs: CartPack[],
  profiles: Awaited<ReturnType<typeof loadModels>> | null,
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
      price: pack.price,
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

export function CartPage() {
  const {
    requestTab,
    openPurchase,
    authed,
    bumpInventoryRevision,
    setPurchasedPacks,
    setNavNotice,
  } = useAuth();
  const { diamonds, coins, setDiamonds, setCoins } = useWallet();
  const [packs, setPacks] = useState<CartPack[]>(() => listCartPacks());
  const [selectedId, setSelectedId] = useState<string | null>(
    () => listCartPacks()[0]?.cartItemId ?? null,
  );
  const [glow, setGlow] = useState(
    () => listCartPacks()[0]?.backgroundColor || DEFAULT_GLOW,
  );
  const [models, setModels] = useState<Awaited<ReturnType<typeof loadModels>> | null>(
    null,
  );
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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

  const items = useMemo(
    () => cartPacksToItems(packs, models),
    [models, packs],
  );

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

  async function continueToTear() {
    if (checkingOut) return;
    const remaining = listCartPacks();
    const first = remaining[0];
    if (!first) return;
    setCheckoutError(null);
    setCheckingOut(true);
    try {
      if (authed && !isDemoMode()) {
        let balance = diamonds;
        const purchasedLines: CartPack[] = [];
        const instanceIds: string[] = [];
        let lastPurchaseId = "";
        let partialFailure: PurchaseError | null = null;

        for (const cartPack of remaining) {
          const catalogId = catalogPackIdForCartItem(cartPack, models);
          const cost = packCost(1, catalogId);
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
              catalogId,
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
            purchasedLines.push(cartPack);
            instanceIds.push(instanceId);
            lastPurchaseId = result.purchaseId;
            removePackFromCart(cartPack.cartItemId);
            commitPurchaseIdempotencyKey(catalogId, 1);
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
      const created = addUnopenedFromPurchase({
        purchaseId,
        catalogPackId: packId,
        packName: matched?.foil?.label || first.packName,
        creator: matched?.profile.name || first.creator,
        count: remaining.length,
        themeName: matched?.foil?.label || first.packName,
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
      const message =
        error instanceof PurchaseError
          ? error.kind === "insufficient"
            ? "Not enough diamonds to open these packs."
            : "Checkout failed. Your packs are still in Pack Pocket."
          : "Checkout failed. Your packs are still in Pack Pocket.";
      setCheckoutError(message);
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
      aria-label="Cart"
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
          onRemove={(item) => {
            const next = removePackFromCart(item.id);
            setPacks(next);
          }}
        />
        <div className="cart-continue">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            label={checkingOut ? "Checking out…" : "Continue"}
            costAmount={null}
            width={220}
            height={56}
            fontSize={16}
            disabled={checkingOut}
            onClick={() => void continueToTear()}
          />
          {checkoutError ? (
            <p className="mt-3 text-center text-[13px] text-[oklch(0.711_0.166_22.22)]">
              {checkoutError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
