import { useEffect, useMemo, useRef, useState } from "react";
import { useMarkPageReady } from "@/shared/ui/usePageReady";
import { useNavigate } from "react-router-dom";
import { Paths } from "@/routes/Paths";
import { CreatorHeader } from "@/components/creator/CreatorHeader";
import { CreatorProgressPanel } from "@/components/creator/CreatorProgressPanel";
import { buildProfileThemeMotionSlides } from "@/components/creator/creatorThemeMotionSlides";
import { ReadyToReveal } from "@/components/collection/ReadyToReveal";
import { MobileCoverFlow } from "@/components/home/MobileCoverFlow";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { useAuth } from "@/contexts/useAuth";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";
import { type BackendModel } from "@/shared/backend/collection";
import { normalizeMediaUrl } from "@/lib/mediaUrl";
import { modelDisplayName } from "@/shared/backend/modelProfile";
import { formatSocialHandle } from "@/shared/catalog/characters";
import { useCreatorCollection } from "@/features/collection/useCreatorCollection";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import {
  resolveCollectionThemeLabel,
  type ScratchReadyGroup,
  type ThemeCardData,
  type UnopenedPack,
} from "@/services/collection";
import {
  followCreator,
  followedCreatorFromModel,
  isFollowing,
  unfollowCreator,
} from "@/services/following";
import { modelAvatarUrl } from "@/services/models";
import { loadPackCatalog } from "@/services/purchase";
import { trackScratchEvent } from "@/services/readyToScratch";
import { resolveUnopenedOpenTarget } from "@/services/scratchResume";
import {
  fetchCreatorBoard,
  type CreatorBoard,
} from "@/services/creatorBoard";
import "@/components/collection/CollectionPage.css";
import "./creator-collection.css";
import "./creator-influencer.css";

const BUY_PACK_CTA = ctaButtonPropsFromTemplate("squircleCTA");
const PROFILE_COVERFLOW_BACKDROP = "/images/creator/womanCharcoalModel";

/**
 * Creator profile — collapsed header (progress when expanded), theme motion coverflow, Buy Pack CTA.
 */
export function CreatorScreen({
  creatorId,
  onBack,
}: {
  creatorId: string;
  onBack: () => void;
}) {
  const [resolution, setResolution] = useState<{
    creatorId: string;
    model: BackendModel | null;
  } | null>(null);
  const [packsReady, setPacksReady] = useState(false);

  // Model first so `/api/collection` starts without waiting on `/api/packs`.
  useEffect(() => {
    let cancelled = false;
    void resolveModelIdForCreator(creatorId).then(({ model }) => {
      if (!cancelled) setResolution({ creatorId, model });
    });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  // `packUnitCost()` reads the pack catalog synchronously; hold the page
  // skeleton until it is loaded so prices never render from demo fallback.
  useEffect(() => {
    let cancelled = false;
    void loadPackCatalog().finally(() => {
      if (!cancelled) setPacksReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const modelResolved = resolution?.creatorId === creatorId;
  const resolvedModel = modelResolved ? resolution.model : null;
  const preferredModelId = resolvedModel?.id ?? null;

  return (
    <CatalogProvider preferredModelId={preferredModelId}>
      <CreatorScreenInner
        creatorId={creatorId}
        model={resolvedModel}
        modelResolved={modelResolved}
        packsReady={packsReady}
        onBack={onBack}
      />
    </CatalogProvider>
  );
}

function titleCaseSlug(value: string): string {
  const slug = value.trim();
  if (!slug || !/^[a-z][a-z0-9_-]{0,63}$/i.test(slug)) return "";
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function CreatorScreenInner({
  creatorId,
  model,
  modelResolved,
  packsReady,
  onBack,
}: {
  creatorId: string;
  model: BackendModel | null;
  modelResolved: boolean;
  packsReady: boolean;
  onBack: () => void;
}) {
  const modelId = model?.id ?? null;
  const collection = useCreatorCollection(modelId, {
    enabled: modelResolved && modelId != null,
  });
  const pageLoading = !model || collection.loading;
  useMarkPageReady(
    packsReady &&
      (!pageLoading ||
        collection.themes.length > 0 ||
        collection.cards.length > 0),
  );
  const navigate = useNavigate();
  const { authed, requireAuth, openPurchase, inventoryRevision } = useAuth();
  const pageRef = useRef<HTMLElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [board, setBoard] = useState<CreatorBoard | null>(null);
  const followId = (model?.id ?? creatorId).trim();
  const [following, setFollowing] = useState(() => isFollowing(followId));

  useEffect(() => {
    setFollowing(isFollowing(followId));
  }, [followId, authed]);

  useEffect(() => {
    if (!authed) {
      setBoard(null);
      return;
    }
    let cancelled = false;
    void fetchCreatorBoard(creatorId).then((next) => {
      if (!cancelled) setBoard(next);
    });
    return () => {
      cancelled = true;
    };
  }, [authed, creatorId]);

  const themes: ThemeCardData[] = useMemo(
    () =>
      collection.themes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        thumbnailUrl: theme.coverUrl,
        // Guests browse catalog only — personal progress is API/session owned.
        collected: authed ? theme.collected : 0,
        total: theme.total,
        progressColor: "pink" as const,
      })),
    [collection.themes, authed],
  );

  const creatorName =
    (model ? modelDisplayName(model) : "") ||
    titleCaseSlug(creatorId) ||
    creatorId;
  const username =
    formatSocialHandle(model?.label) ||
    formatSocialHandle(creatorId) ||
    "";
  const themeMotionSlides = useMemo(
    () => buildProfileThemeMotionSlides(themes),
    [themes],
  );
  const themeMotionItems = useMemo(
    () => themeMotionSlides.map((slide) => slide.item),
    [themeMotionSlides],
  );
  const themeIdByCardId = useMemo(() => {
    const map = new Map<string, string>();
    for (const slide of themeMotionSlides) {
      map.set(slide.item.id, slide.themeId);
    }
    return map;
  }, [themeMotionSlides]);

  const locationLabel = useMemo(() => {
    const city = model?.influencerCity?.trim() || "";
    const country = model?.influencerCountry?.trim() || "";
    if (city && country) return `${city}, ${country}`;
    return city || country || "";
  }, [model?.influencerCity, model?.influencerCountry]);

  // Profile avatar always comes from this model's `/api/models` avatar field
  // (extension varies: .jpg / .jpeg / .png / .webp) — never a hardcoded path.
  const avatarUrl = useMemo(() => modelAvatarUrl(model) ?? "", [model]);
  // Prefer uploaded landscape cover for the top hero; never swap in theme art.
  const coverUrl =
    (model?.coverUrl ? normalizeMediaUrl(model.coverUrl) : "") ||
    avatarUrl ||
    "/img/placeholder.webp";

  function notice(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function openContinuePack(pack: UnopenedPack) {
    const target = resolveUnopenedOpenTarget(pack);
    const themeName =
      resolveCollectionThemeLabel({
        themeName: pack.name,
        packName: pack.name,
        catalogPackId: target.catalogPackId,
        creator: pack.creator,
      }) || pack.name;
    openPurchase(
      {
        packId: target.catalogPackId,
        packName: pack.name,
        themeName,
        price: "Free",
        creator: pack.creator,
        entry: "open",
        unopenedPacks: pack.count,
        instanceId: target.instanceId,
        purchaseId: target.purchaseId,
      },
      "open-pack",
    );
  }

  function openContinueScratch(group: ScratchReadyGroup) {
    trackScratchEvent("Ready To Scratch Opened", {
      packId: group.id,
    });
    if (group.kind === "photo") {
      const packId = group.id.startsWith("photo:")
        ? group.id.slice("photo:".length)
        : undefined;
      requireAuth({ type: "photo-scratch", packId });
      return;
    }
    requireAuth({
      type: "scratch",
      pack: {
        packId: group.id,
        packName: group.collectionName,
        price: "",
        creator: group.creatorName,
        entry: "scratch",
      },
    });
  }

  function handleToggleFollow() {
    if (!authed) {
      requireAuth({
        type: "follow",
        creatorId: followId || creatorId,
        displayName: creatorName,
        avatarUrl: avatarUrl || "/img/placeholder.webp",
      });
      return;
    }

    if (following) {
      unfollowCreator(followId);
      setFollowing(false);
      notice(`Unfollowed ${creatorName}`);
      return;
    }

    const fromModel = model ? followedCreatorFromModel(model) : null;
    const entry =
      fromModel ??
      ({
        id: followId || creatorId,
        displayName: creatorName,
        username: "",
        avatarUrl: avatarUrl || "/img/placeholder.webp",
        followedAt: Date.now(),
        hasUnseenActivity: false,
      } as const);

    followCreator(entry);
    setFollowing(true);
    notice(`Following ${creatorName}`);
  }

  if (
    !packsReady ||
    !modelResolved ||
    (pageLoading && themes.length === 0)
  ) {
    return (
      <section
        ref={pageRef}
        data-page-scroll
        className="cpv2-page no-sticky-cta"
      >
        <CreatorPageSkeleton onBack={onBack} />
      </section>
    );
  }

  return (
    <section
      ref={pageRef}
      data-page-scroll
      className="cpv2-page no-sticky-cta"
    >
      <div className="cpv2-shell">
        <CreatorHeader
          name={creatorName}
          username={username}
          avatarUrl={avatarUrl}
          coverUrl={coverUrl}
          locationLabel={locationLabel}
          instagramUrl={board?.creator.instagramUrl}
          tiktokUrl={board?.creator.tiktokUrl}
          xUrl={board?.creator.xUrl}
          onlyfansUrl={board?.creator.onlyfansUrl}
          socialsPending={authed && board === null}
          onBack={onBack}
          following={following}
          onToggleFollow={handleToggleFollow}
          expandedChildren={
            <CreatorProgressPanel
              themes={themes}
              board={board}
              showPersonalProgress={authed}
              loading={collection.loading || (authed && board === null)}
              onThemeClick={(themeId) =>
                navigate(Paths.creatorTheme(creatorId, themeId))
              }
            />
          }
        />

        <ReadyToReveal
          creatorId={modelId ?? creatorId}
          inventoryRevision={inventoryRevision}
          onOpenPack={openContinuePack}
          onScratch={openContinueScratch}
        />

        <div className="cpv2-profile-coverflow">
          {themeMotionItems.length > 0 ? (
            <div className="home-featured-coverflow-frame">
              <MobileCoverFlow
                items={themeMotionItems}
                selectedId={null}
                glow="oklch(0.798 0.104 207.84)"
                buying={false}
                addedToPocket={false}
                flat
                stageBackdropBase={PROFILE_COVERFLOW_BACKDROP}
                stageBackdropLabel={creatorName}
                slideCta="view"
                onSelect={() => {}}
                onDeselect={() => {}}
                onFocusChange={() => {}}
                onBuy={() => {}}
                onView={(item) => {
                  const themeId = themeIdByCardId.get(item.id);
                  if (!themeId) return;
                  navigate(Paths.creatorTheme(creatorId, themeId));
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="cpv2-profile-buy-pack">
          <CtaButton
            {...BUY_PACK_CTA}
            fillParent
            label="Buy Pack"
            auroraBaseColor="#42001b"
            auroraColorStops={["#aa3c6b", "#ea2e89", "#42001b", "#933e4c"]}
            glowColors={["#aa085f", "#e00083", "#eb6a00"]}
            glowOuterBloom="off"
            labelColor="#ffe0e8"
            onClick={() => navigate(Paths.creatorPacks(creatorId))}
          />
        </div>
      </div>

      {toast ? <div className="cpv2-toast">{toast}</div> : null}
    </section>
  );
}

function CreatorPageSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="cpv2-shell cpv2-page-skeleton" aria-busy="true">
      <div className="cpv2-skeleton-profile">
        <button
          type="button"
          className="cpv2-skeleton-back"
          aria-label="Back"
          onClick={onBack}
        />
        <span className="cpv2-skeleton-avatar" aria-hidden="true" />
        <span className="cpv2-skeleton-meta" aria-hidden="true">
          <span className="cpv2-skeleton-bar is-name" />
          <span className="cpv2-skeleton-bar is-handle" />
          <span className="cpv2-skeleton-bar is-location" />
        </span>
      </div>
      <div className="cpv2-influencer" aria-hidden="true">
        <span className="cpv2-skeleton-block cpv2-skeleton-coverflow" />
        <span className="cpv2-skeleton-bar cpv2-skeleton-title" />
      </div>
    </div>
  );
}
