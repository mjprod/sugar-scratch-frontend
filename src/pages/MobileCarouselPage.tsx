import { useEffect, useState } from "react";
import { MobileCssCarousel } from "@/features/packs/MobileCssCarousel";
import { packItemToIteration, type Iteration } from "@/features/packs/types";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import {
  loadModels,
  profileFromModel,
  type BackendModel,
} from "@/services/models";
import { loadPackCatalog, packUnitCost } from "@/services/purchase";

const DEFAULT_GLOW = "oklch(0.798 0.104 207.84)";
const MAX_PACKS = 10;
const PACK_MODEL_URL = "/assets/CardPack2-min.glb";
const COVERFLOW_MOBILE_QUERY = "(max-width: 980px)";

function isMobileCoverflowViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(COVERFLOW_MOBILE_QUERY).matches
  );
}

function iterationsFromModels(models: BackendModel[]): Iteration[] {
  const items: Iteration[] = [];

  for (const model of models) {
    const profile = profileFromModel(model);
    for (const foil of profile.packs) {
      if (items.length >= MAX_PACKS) return items;
      items.push(
        packItemToIteration({
          id: foil.id,
          characterId: profile.id,
          name: profile.name,
          modelUrl: PACK_MODEL_URL,
          modelName: "CardPack2-min.glb",
          videoUrl: foil.videoUrl,
          price: packUnitCost(profile.id),
          girlName: profile.name,
          packNumber: foil.slot === 1 ? 101 : 102,
          packName: foil.label,
          flagEmoji: profile.flagEmoji ?? "",
          flagSvgUrl: profile.flagSvgUrl ?? "",
          city: profile.city ?? "",
          country: profile.country ?? "",
          overlayColorStart: profile.overlayColorStart ?? DEFAULT_GLOW,
          overlayColorEnd: profile.overlayColorEnd ?? DEFAULT_GLOW,
          backgroundColor: profile.overlayColorEnd ?? DEFAULT_GLOW,
        }),
      );
    }
  }

  return items;
}

/** Isolated playground: Swiper coverflow pack videos on mobile. */
export function MobileCarouselPage() {
  const [items, setItems] = useState<Iteration[] | null>(null);
  const [carouselReady, setCarouselReady] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    isMobileCoverflowViewport,
  );

  useMarkPageReady(carouselReady);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(COVERFLOW_MOBILE_QUERY);
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadModels(), loadPackCatalog()])
      .then(([models]) => {
        if (!cancelled) setItems(iterationsFromModels(models));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items || !isMobileViewport) {
    return (
      <section
        className="absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[oklch(0.14_0_0)]"
        aria-label="Mobile carousel"
      />
    );
  }

  return (
    <section
      className="absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[oklch(0.14_0_0)]"
      aria-label="Mobile carousel"
    >
      <MobileCssCarousel items={items} onReady={() => setCarouselReady(true)} />
    </section>
  );
}
