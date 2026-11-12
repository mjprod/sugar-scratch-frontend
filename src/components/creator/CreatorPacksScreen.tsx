import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Paths } from "@/routes/Paths";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";
import { type BackendModel } from "@/shared/backend/collection";
import { modelDisplayName } from "@/shared/backend/modelProfile";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import { loadPackCatalog, type PurchaseFlowPack } from "@/services/purchase";
import { useMarkPageReady } from "@/shared/ui/usePageReady";
import "./creator-influencer.css";
import "./motion-card-page.css";

const FeaturedCoverFlow = lazy(() =>
  import("@/components/home/FeaturedCoverFlow").then((m) => ({
    default: m.FeaturedCoverFlow,
  })),
);

const EMPTY_FEATURED: [] = [];

export function CreatorPacksScreen({
  creatorId,
  onBuyPack,
}: {
  creatorId: string;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const [model, setModel] = useState<BackendModel | null>(null);
  const [resolved, setResolved] = useState(false);
  const [packsReady, setPacksReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolveModelIdForCreator(creatorId).then(({ model: next }) => {
      if (!cancelled) {
        setModel(next);
        setResolved(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  useEffect(() => {
    let cancelled = false;
    void loadPackCatalog().finally(() => {
      if (!cancelled) setPacksReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CatalogProvider preferredModelId={model?.id ?? null}>
      <CreatorPacksScreenInner
        creatorId={creatorId}
        model={model}
        resolved={resolved}
        packsReady={packsReady}
        onBuyPack={onBuyPack}
      />
    </CatalogProvider>
  );
}

function titleCaseSlug(value: string): string {
  const slug = value.trim();
  if (!slug || !/^[a-z][a-z0-9_-]{0,63}$/i.test(slug)) return "";
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function CreatorPacksScreenInner({
  creatorId,
  model,
  resolved,
  packsReady,
  onBuyPack,
}: {
  creatorId: string;
  model: BackendModel | null;
  resolved: boolean;
  packsReady: boolean;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const navigate = useNavigate();
  const creatorName =
    (model ? modelDisplayName(model) : "") ||
    titleCaseSlug(creatorId) ||
    creatorId;
  const purchaseCreatorId = creatorId || model?.id || "";

  useMarkPageReady(resolved && packsReady);

  const title = useMemo(
    () => `Buy ${creatorName} pack`,
    [creatorName],
  );

  function addCoverflowPackToPocket(pack: {
    id: string;
    foilId?: string;
    name: string;
    creatorName: string;
    diamondCost: number;
    themeName?: string;
  }) {
    const packId = pack.foilId ?? pack.id;
    onBuyPack({
      packId,
      packName: pack.name,
      themeName: pack.themeName,
      price: `${pack.diamondCost} ◆`,
      creator: pack.creatorName || creatorName,
      entry: "purchase",
    });
  }

  return (
    <section data-page-scroll className="cpv2-page no-sticky-cta">
      <div className="cpv2-shell">
        <header className="mcp-top cpv2-theme-page-top">
          <button
            type="button"
            className="mcp-back"
            aria-label="Back to profile"
            onClick={() => navigate(Paths.creator(creatorId))}
          >
            <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
          </button>
          <h1 className="cpv2-theme-page-title">{title}</h1>
        </header>

        {resolved && packsReady ? (
          <div className="cpv2-packs-coverflow">
            <Suspense fallback={null}>
              <FeaturedCoverFlow
                featured={EMPTY_FEATURED}
                creatorId={purchaseCreatorId}
                onPlay={addCoverflowPackToPocket}
                influencerBackdrop
                forceDesktopCoverflow
              />
            </Suspense>
          </div>
        ) : (
          <div className="cpv2-influencer" aria-busy="true">
            <span className="cpv2-skeleton-block cpv2-skeleton-coverflow" />
          </div>
        )}
      </div>
    </section>
  );
}
