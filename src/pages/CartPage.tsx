import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { EmptyState } from "@/components/EmptyState";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { CoverFlowCarouselV2 } from "@/features/packs/CoverFlowCarouselV2";
import { packItemToIteration } from "@/features/packs/types";
import "@/features/packs/packs.css";
import { useAuth } from "@/contexts/AuthContext";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import {
  clearCart,
  listCartPacks,
  removePackFromCart,
  subscribeCart,
  type CartPack,
} from "@/services/cart";
import { addUnopenedFromPurchase } from "@/services/packInventory";
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
  const { requestTab, openPurchase } = useAuth();
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

  const combinedPrice = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [items],
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

  function continueToTear() {
    const remaining = listCartPacks();
    const first = remaining[0];
    if (!first) return;
    const matched = models ? foilForCartPack(first, models) : null;
    const packId = matched?.profile.id || first.characterId || first.packId;
    const purchaseId = `cart-${Date.now().toString(36)}`;
    const created = addUnopenedFromPurchase({
      purchaseId,
      catalogPackId: packId,
      packName: matched?.foil?.label || first.packName,
      creator: matched?.profile.name || first.creator,
      count: remaining.length,
      coverUrl: matched?.foil?.videoUrl || first.videoUrl,
      themeName: matched?.foil?.label || first.packName,
    });
    openPurchase(
      {
        packId,
        packName: matched?.foil?.label || first.packName,
        price: String(first.price || 0),
        creator: matched?.profile.name || first.creator,
        entry: "cart-tear",
        unopenedPacks: remaining.length,
        instanceId: created[0]?.instanceId,
        purchaseId,
        cartFoils: remaining.map((pack) => {
          const item = models ? foilForCartPack(pack, models) : null;
          return {
            id: pack.cartItemId,
            label: item?.foil?.label || pack.packName,
            videoUrl: item?.foil?.videoUrl || pack.videoUrl,
            slot: item?.foil?.slot,
          };
        }),
      },
      "open-pack",
    );
    // Checkout empties Pack Pocket; opened packs live in inventory / ready-to-scratch.
    clearCart();
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
            className="cart-continue__cta"
            leadingIcon={
              <span className="cart-continue__cost">
                <DiamondLottie size={16} aria-hidden />
                <span className="cart-continue__cost-amount">{combinedPrice}</span>
              </span>
            }
            label="Confirm"
            costAmount={null}
            width={248}
            height={56}
            fontSize={16}
            aria-label={`${combinedPrice} diamonds, Confirm`}
            onClick={continueToTear}
          />
        </div>
      </div>
    </section>
  );
}
