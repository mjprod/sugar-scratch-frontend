import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Paths } from "@/routes/Paths";
import { CreatorHeader } from "@/components/creator/CreatorHeader";
import { CreatorInfluencerBody } from "@/components/creator/CreatorInfluencerBody";
import { FeaturedCardOverlay } from "@/components/creator/FeaturedCardOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";
import {
  normalizeMediaUrl,
  type BackendModel,
} from "@/shared/backend/collection";
import { modelDisplayName } from "@/shared/backend/modelProfile";
import { formatSocialHandle } from "@/shared/catalog/characters";
import { useCreatorCollection } from "@/features/collection/useCreatorCollection";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import {
  matchLiveThemeId,
  type ThemeCardData,
} from "@/services/collection";
import {
  followCreator,
  followedCreatorFromModel,
  isFollowing,
  unfollowCreator,
} from "@/services/following";
import {
  loadPackCatalog,
  packUnitCost,
  type PurchaseFlowPack,
} from "@/services/purchase";
import "./creator-collection.css";
import "./creator-influencer.css";

/** Collapse once ~7% of the viewport height has been scrolled from the top. */
const COLLAPSE_VIEWPORT_RATIO = 0.07;
/**
 * Only reopen near the absolute top. A mid-range expand threshold fights the
 * sticky header height change and can open/close in a loop.
 */
const EXPAND_SCROLL_PX = 12;

function collapseFromScrollTop(
  scroller: HTMLElement,
  currentlyCollapsed: boolean,
) {
  const scrollTop = Math.max(0, scroller.scrollTop);
  if (currentlyCollapsed) {
    return scrollTop <= EXPAND_SCROLL_PX ? 0 : 1;
  }
  const viewport = Math.max(1, scroller.clientHeight);
  return scrollTop >= viewport * COLLAPSE_VIEWPORT_RATIO ? 1 : 0;
}

/**
 * Creator Page — InnerInfluencer Figma layout (profile, packs, progress, themes).
 */
export function CreatorScreen({
  creatorId,
  onBack,
  onBuyPack,
}: {
  creatorId: string;
  onBack: () => void;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const [resolvedModel, setResolvedModel] = useState<BackendModel | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      resolveModelIdForCreator(creatorId),
      loadPackCatalog(),
    ]).then(([{ model }]) => {
      if (!cancelled) setResolvedModel(model);
    });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const preferredModelId = resolvedModel?.id ?? null;

  return (
    <CatalogProvider preferredModelId={preferredModelId}>
      <CreatorScreenInner
        creatorId={creatorId}
        model={resolvedModel}
        onBack={onBack}
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

function CreatorScreenInner({
  creatorId,
  model,
  onBack,
  onBuyPack,
}: {
  creatorId: string;
  model: BackendModel | null;
  onBack: () => void;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const modelId = model?.id ?? null;
  const collection = useCreatorCollection(modelId);
  useMarkPageReady(
    !collection.loading ||
      collection.themes.length > 0 ||
      collection.cards.length > 0,
  );
  const navigate = useNavigate();
  const { authed, requireAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapseProgress, setCollapseProgress] = useState(0);
  const collapseProgressRef = useRef(0);
  const collapseLockUntilRef = useRef(0);
  const pageRef = useRef<HTMLElement | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState(
    () => searchParams.get("theme") || "",
  );
  const [featuredCardId, setFeaturedCardId] = useState<string | null>(
    () => searchParams.get("card"),
  );
  const [toast, setToast] = useState<string | null>(null);
  const followId = (model?.id ?? creatorId).trim();
  const [following, setFollowing] = useState(() => isFollowing(followId));

  useEffect(() => {
    setFollowing(isFollowing(followId));
  }, [followId, authed]);

  const syncCollapseProgress = useCallback(() => {
    const page = pageRef.current;
    if (!page) return;
    // Ignore scroll jitter while the open/closed animation is running.
    if (performance.now() < collapseLockUntilRef.current) return;

    const prev = collapseProgressRef.current;
    const next = collapseFromScrollTop(page, prev >= 1);
    if (next === prev) return;

    collapseProgressRef.current = next;
    collapseLockUntilRef.current = performance.now() + 360;
    setCollapseProgress(next);
  }, []);

  useEffect(() => {
    collapseProgressRef.current = collapseProgress;
  }, [collapseProgress]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncCollapseProgress();
      });
    };

    schedule();
    page.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      page.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [syncCollapseProgress]);

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

  const usingLiveThemes = themes.length > 0;
  const creatorName =
    (model ? modelDisplayName(model) : "") ||
    titleCaseSlug(creatorId) ||
    creatorId;
  const username =
    formatSocialHandle(model?.label) ||
    formatSocialHandle(creatorId) ||
    "";
  const purchaseCreatorId = creatorId || model?.id || "";

  const locationLabel = useMemo(() => {
    const city = model?.influencerCity?.trim() || "";
    const country = model?.influencerCountry?.trim() || "";
    if (city && country) return `${city}, ${country}`;
    return city || country || "";
  }, [model?.influencerCity, model?.influencerCountry]);

  useEffect(() => {
    if (!usingLiveThemes) return;

    const urlTheme = searchParams.get("theme");
    const urlCard = searchParams.get("card");
    const wantedId = urlTheme || selectedThemeId;

    const themeFromCard = urlCard
      ? themes.find((entry) =>
          (collection.cardsByThemeId[entry.id] ?? []).some(
            (card) => card.id === urlCard,
          ),
        )
      : undefined;

    const nextThemeId =
      themeFromCard?.id ??
      matchLiveThemeId(wantedId, themes) ??
      themes[0]!.id;

    const nextCardId =
      urlCard &&
      (collection.cardsByThemeId[nextThemeId] ?? []).some(
        (card) => card.id === urlCard,
      )
        ? urlCard
        : null;

    if (nextThemeId !== selectedThemeId) {
      setSelectedThemeId(nextThemeId);
    }
    if (nextCardId !== featuredCardId) {
      setFeaturedCardId(nextCardId);
    }
    if (urlTheme !== nextThemeId || (urlCard ?? null) !== nextCardId) {
      const next = new URLSearchParams(searchParams);
      if (nextCardId) next.set("card", nextCardId);
      else next.delete("card");
      next.set("theme", nextThemeId);
      setSearchParams(next, { replace: true });
    }
  }, [
    themes,
    usingLiveThemes,
    selectedThemeId,
    featuredCardId,
    searchParams,
    setSearchParams,
    collection.cardsByThemeId,
  ]);

  // Profile avatar must stay the same creator face used on My Collection —
  // pin to the stable /models/{slug}/avatar path so it never flashes to a
  // theme cover or a late-arriving alternate URL.
  const avatarUrl = useMemo(() => {
    const slug = (creatorId || model?.id || "").trim().toLowerCase();
    if (slug && /^[a-z0-9_-]+$/i.test(slug)) {
      return `/models/${slug}/avatar.jpeg`;
    }
    return model?.avatar ? normalizeMediaUrl(model.avatar) : "";
  }, [creatorId, model?.id, model?.avatar]);
  // Prefer uploaded landscape cover for the top hero; never swap in theme art.
  const coverUrl =
    (model?.coverUrl ? normalizeMediaUrl(model.coverUrl) : "") ||
    avatarUrl ||
    "/img/placeholder.png";

  function notice(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function syncCardParam(cardId: string | null, themeId?: string) {
    const next = new URLSearchParams(searchParams);
    if (cardId) next.set("card", cardId);
    else next.delete("card");
    if (themeId) next.set("theme", themeId);
    setSearchParams(next, { replace: true });
  }

  function handlePlayGame(playModelId: string, cardId: string, _cardName: string) {
    const card = cardId.trim();
    const playModel = playModelId.trim();
    if (!card || !playModel) return;
    syncCardParam(card, selectedThemeId);
    navigate(
      Paths.gamePlay(playModel, card, {
        creatorId,
        themeId: selectedThemeId,
      }),
    );
  }

  function handleToggleFollow() {
    if (!authed) {
      requireAuth({
        type: "follow",
        creatorId: followId || creatorId,
        displayName: creatorName,
        avatarUrl: avatarUrl || "/img/placeholder.png",
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
        avatarUrl: avatarUrl || "/img/placeholder.png",
        followedAt: Date.now(),
        hasUnseenActivity: false,
      } as const);

    followCreator(entry);
    setFollowing(true);
    notice(`Following ${creatorName}`);
  }

  function buyThemePack(themeId?: string) {
    const packTheme =
      (themeId
        ? themes.find((entry) => entry.id === themeId)
        : undefined) ??
      themes.find((entry) => entry.id === selectedThemeId) ??
      themes[0];
    const packId = packTheme
      ? `${purchaseCreatorId}-${packTheme.id}-buy`
      : `${purchaseCreatorId}-pack`;
    const cost = packUnitCost(packId);
    onBuyPack({
      packId,
      packName: packTheme?.name ?? `${creatorName} Pack`,
      themeName: packTheme?.name,
      price: `${cost} ◆`,
      creator: creatorName,
      entry: "purchase",
    });
  }

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
          collapseProgress={collapseProgress}
          onBack={onBack}
          following={following}
          onToggleFollow={handleToggleFollow}
        />

        <CreatorInfluencerBody
          creatorName={creatorName}
          creatorId={purchaseCreatorId}
          avatarUrl={avatarUrl}
          themes={themes}
          cardsByThemeId={collection.cardsByThemeId}
          showPersonalProgress={authed}
          loading={collection.loading}
          onBuyPack={buyThemePack}
          onAddPackToPocket={addCoverflowPackToPocket}
          onOpenCard={(cardId, themeId) => {
            // Open the motion card detail route. Do not also write ?card= on the
            // creator URL — setSearchParams races navigate and can leave the
            // user stuck on the creator page / featured overlay.
            setSelectedThemeId(themeId);
            navigate(Paths.motionCard(creatorId, cardId));
          }}
          onLockedHint={() => notice("Buy packs to unlock Motion Cards")}
          onPlayGame={handlePlayGame}
        />
      </div>

      {toast ? <div className="cpv2-toast">{toast}</div> : null}

      {featuredCardId && collection.modelId ? (
        <FeaturedCardOverlay
          modelId={collection.modelId}
          cardId={featuredCardId}
          onClose={() => {
            setFeaturedCardId(null);
            syncCardParam(null, selectedThemeId);
          }}
          onPlayGame={handlePlayGame}
          onViewCard={(name) => notice(`View ${name}`)}
        />
      ) : null}
    </section>
  );
}
