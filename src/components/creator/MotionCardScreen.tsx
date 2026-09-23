import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useAuth } from "@/contexts/AuthContext";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";
import { useCreatorCollection } from "@/features/collection/useCreatorCollection";
import {
  buildPhotoSlotFills,
  PHOTO_SLOTS,
  photoScratchIdForSlot,
} from "@/features/collection/lib/photoSlots";
import type { CardConfig } from "@/features/collection/lib/cards";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import { Paths } from "@/routes/Paths";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import "./creator-influencer.css";
import "./motion-card-page.css";

const EMPTY_PHOTOS = Array.from({ length: PHOTO_SLOTS }, () => "");

function themeLabel(card: CardConfig | null | undefined): string {
  const theme = card?.groupTheme?.trim() || card?.groupId?.trim() || "Photo";
  return theme.replace(/\s+Cards?$/i, "").trim() || "Photo";
}

function motionOrdinal(
  cards: CardConfig[],
  cardId: string,
): { index: number; total: number } {
  const motion = cards
    .filter((c) => !c.id.includes("-placeholder-"))
    .slice(0, 3);
  const total = Math.max(1, motion.length || 3);
  const index = Math.max(
    0,
    motion.findIndex((c) => c.id === cardId),
  );
  return { index: index >= 0 ? index : 0, total };
}

function formatOrdinal(n: number): string {
  return String(n).padStart(2, "0");
}

export function MotionCardScreen({
  creatorId,
  cardId,
}: {
  creatorId: string;
  cardId: string;
}) {
  const [modelId, setModelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveModelIdForCreator(creatorId).then(({ model }) => {
      if (!cancelled) setModelId(model?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  return (
    <CatalogProvider preferredModelId={modelId}>
      <MotionCardScreenInner
        creatorId={creatorId}
        cardId={cardId}
        modelId={modelId}
      />
    </CatalogProvider>
  );
}

function MotionCardScreenInner({
  creatorId,
  cardId,
  modelId,
}: {
  creatorId: string;
  cardId: string;
  modelId: string | null;
}) {
  const navigate = useNavigate();
  const { authed } = useAuth();
  const collection = useCreatorCollection(modelId);
  // Paint immediately — no site preloader between influencer ↔ motion detail.
  useMarkPageReady(true);
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  const legalTitleId = useId();

  const card = useMemo(() => {
    return collection.cards.find((entry) => entry.id === cardId) ?? null;
  }, [cardId, collection.cards]);

  const themeCards = useMemo(() => {
    if (!card) return [] as CardConfig[];
    const themeKey = card.groupId || card.groupTheme;
    if (themeKey && collection.cardsByThemeId[themeKey]) {
      return collection.cardsByThemeId[themeKey];
    }
    return collection.cards.filter(
      (entry) =>
        (card.groupId && entry.groupId === card.groupId) ||
        (card.groupTheme && entry.groupTheme === card.groupTheme),
    );
  }, [card, collection.cards, collection.cardsByThemeId]);

  const { index: motionIndex, total: motionTotal } = motionOrdinal(
    themeCards.length ? themeCards : card ? [card] : [],
    cardId,
  );

  const themeName = themeLabel(card);
  const photoTitle = `${themeName} Photo Card`;
  const motionTitle = `${themeName} Motion Card`;

  const poster =
    card?.posterUrl ||
    (card?.mediaType === "image" ? card.mediaUrl : "") ||
    card?.photoUrls?.find(Boolean) ||
    "/img/placeholder.png";

  const videoUrl =
    card?.mediaType === "video" && card.mediaUrl ? card.mediaUrl : "";

  const filled = Math.max(
    0,
    Math.min(PHOTO_SLOTS, Math.round(card?.photoFilledCount ?? 0)),
  );
  const showPersonal = Boolean(authed);
  const slots = useMemo(
    () =>
      buildPhotoSlotFills(
        card?.id ?? cardId,
        showPersonal ? filled : filled > 0 ? filled : null,
        card?.photoUrls ?? EMPTY_PHOTOS,
      ),
    [card?.id, card?.photoUrls, cardId, filled, showPersonal],
  );

  const collectedCount = slots.filter((s) => s.collected).length;
  const hasNewDot = collectedCount > 0 && collectedCount < PHOTO_SLOTS;

  const playModelId = card?.modelId?.trim() || modelId || "";

  function goBack() {
    navigate(Paths.creator(creatorId));
  }

  function playMotion() {
    if (!playModelId || !cardId) return;
    navigate(
      Paths.gamePlay(playModelId, cardId, {
        creatorId,
        themeId: card?.groupId || undefined,
      }),
    );
  }

  function openPhoto(slotIndex: number, collected: boolean) {
    if (!collected) return;
    const photoId = photoScratchIdForSlot(cardId, slotIndex);
    navigate(
      Paths.photoScratchPlay(photoId, {
        modelId: playModelId || undefined,
        creatorId,
      }),
    );
  }

  return (
    <section data-page-scroll className="mcp-page cpv2-page no-sticky-cta">
      <div className="mcp-shell">
        <header className="mcp-top">
          <button
            type="button"
            className="mcp-back"
            aria-label="Back to creator"
            onClick={goBack}
          >
            <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
          </button>
          <h1 className="mcp-title">Keep Playing…</h1>
        </header>

        <section className="mcp-hero" aria-label={motionTitle}>
          <div className="mcp-hero-glow" aria-hidden="true" />
          {/* Same unlocked motion tile + offset play CTA as creator influencer page */}
          <div className="cpv2-motion-tile is-unlocked mcp-hero-tile">
            <button
              type="button"
              className="cpv2-motion-tile-hit"
              aria-label={`${card?.name ?? motionTitle} — unlocked`}
              onClick={playMotion}
            >
              {videoUrl ? (
                <video
                  className="cpv2-motion-tile-img"
                  src={videoUrl}
                  poster={poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              ) : poster ? (
                <img src={poster} alt="" className="cpv2-motion-tile-img" />
              ) : (
                <span className="cpv2-motion-tile-img is-empty" />
              )}
              <span className="cpv2-motion-tile-shade" aria-hidden="true" />
              <span className="cpv2-motion-tile-check" aria-hidden="true">
                <svg
                  width="14"
                  height="15"
                  viewBox="0 0 14 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4.75293 0.375425C5.65417 0.00186077 6.64676 -0.0956503 7.60352 0.0951518C8.5601 0.286011 9.43906 0.756126 10.1279 1.44671C10.3782 1.69792 10.377 2.1044 10.126 2.35492C9.87487 2.6052 9.46837 2.60562 9.21777 2.35492C8.70853 1.8444 8.05873 1.49595 7.35156 1.35492C6.64467 1.21399 5.912 1.28606 5.24609 1.56195C4.58002 1.83804 4.01035 2.30582 3.61035 2.9057C3.33032 3.32573 3.14397 3.7979 3.05664 4.29046H10.9238C11.5485 4.29058 12.1471 4.53923 12.5889 4.98089C13.0307 5.42271 13.2793 6.02208 13.2793 6.64691V12.643C13.2793 13.2678 13.0307 13.8672 12.5889 14.309C12.1471 14.7507 11.5485 14.9993 10.9238 14.9994H2.35645C1.73162 14.9994 1.13226 14.7508 0.69043 14.309C0.24859 13.8672 0 13.2678 0 12.643V6.64691C0 6.02208 0.24859 5.42271 0.69043 4.98089C0.985477 4.68587 1.35094 4.47865 1.74707 4.3725C1.83493 3.59577 2.10446 2.84761 2.54102 2.19281C3.08208 1.38135 3.85199 0.74899 4.75293 0.375425ZM2.35645 5.57562C2.07242 5.57562 1.79947 5.68827 1.59863 5.8891C1.3978 6.08992 1.28516 6.3629 1.28516 6.64691V12.643C1.28516 12.927 1.3978 13.2 1.59863 13.4008C1.79946 13.6016 2.07245 13.7143 2.35645 13.7143H10.9238C11.2076 13.7142 11.4799 13.6015 11.6807 13.4008C11.8815 13.2 11.9941 12.927 11.9941 12.643V6.64691C11.9941 6.3629 11.8815 6.08993 11.6807 5.8891C11.4799 5.68841 11.2077 5.57574 10.9238 5.57562H2.35645ZM6.63965 8.14593C7.03728 8.14593 7.41902 8.30423 7.7002 8.58539C7.98108 8.8665 8.13867 9.24756 8.13867 9.64496C8.13866 10.0424 7.98109 10.4234 7.7002 10.7045C7.41902 10.9857 7.03728 11.144 6.63965 11.144C6.24204 11.144 5.86123 10.9857 5.58008 10.7045C5.29892 10.4234 5.14064 10.0426 5.14062 9.64496C5.14062 9.24735 5.29892 8.86654 5.58008 8.58539C5.86124 8.30424 6.24203 8.14595 6.63965 8.14593ZM6.63965 9.43109C6.58286 9.4311 6.52844 9.45344 6.48828 9.49359C6.44814 9.53375 6.42578 9.58818 6.42578 9.64496C6.42579 9.70174 6.44813 9.75617 6.48828 9.79632C6.52844 9.83648 6.58286 9.85881 6.63965 9.85882C6.69643 9.85882 6.75085 9.83646 6.79102 9.79632C6.83117 9.75617 6.8535 9.70174 6.85352 9.64496C6.85352 9.58815 6.83118 9.53376 6.79102 9.49359C6.75085 9.45343 6.69645 9.43109 6.63965 9.43109Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            </button>
            <div className="cpv2-motion-tile-play-cta">
              <CtaButton
                {...ctaButtonPropsFromTemplate("squircleCTA")}
                fillParent
                label=""
                leadingIcon={
                  <Play
                    size={14}
                    strokeWidth={2.4}
                    fill="currentColor"
                    aria-hidden
                  />
                }
                costAmount={null}
                fontSize={12}
                cornerRadius={999}
                aria-label={`Play ${card?.name ?? motionTitle}`}
                onClick={(event) => {
                  event.stopPropagation();
                  playMotion();
                }}
              />
            </div>
          </div>

          <div className="mcp-hero-info">
            <div className="mcp-hero-copy">
              <p className="mcp-hero-name">
                {motionTitle}
                <br />
                Nº {formatOrdinal(motionIndex + 1)}/{formatOrdinal(motionTotal)}
              </p>
              <span className="mcp-free-pill">Free Play Enabled*</span>
              <p className="mcp-free-note">*No Rewards in free play</p>
            </div>
            <p className="mcp-premium-token">
              <span className="mcp-premium-token-icon" aria-hidden="true">
                <svg
                  width="9"
                  height="12"
                  viewBox="0 0 9 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4.5 0L8.9 4.2L4.5 12L0.1 4.2L4.5 0Z"
                    fill="#d9c694"
                  />
                </svg>
              </span>
              Premium Motion Token Unlocked
            </p>
          </div>
        </section>

        <section className="mcp-photos" aria-label={photoTitle}>
          <header className="mcp-photos-head">
            <div className="mcp-photos-title-row">
              <span className="mcp-photos-icon" aria-hidden="true">
                <svg
                  width="15"
                  height="12"
                  viewBox="0 0 15 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1.2 0H13.8C14.46 0 15 0.54 15 1.2V10.8C15 11.46 14.46 12 13.8 12H1.2C0.54 12 0 11.46 0 10.8V1.2C0 0.54 0.54 0 1.2 0ZM1.5 9L4.2 6.3C4.48 6.02 4.92 6.02 5.2 6.3L7.2 8.3L9.1 6.7C9.35 6.49 9.72 6.52 9.94 6.76L12 9V10.2C12 10.53 11.73 10.8 11.4 10.8H2.1C1.77 10.8 1.5 10.53 1.5 10.2V9ZM5.4 3.3C5.4 2.7 4.9 2.25 4.35 2.25C3.8 2.25 3.3 2.7 3.3 3.3C3.3 3.9 3.8 4.35 4.35 4.35C4.9 4.35 5.4 3.9 5.4 3.3Z"
                    fill="white"
                    fillOpacity="0.85"
                  />
                </svg>
              </span>
              <h2 className="mcp-photos-title">{photoTitle}</h2>
            </div>
            <p className="mcp-photos-count">
              {collectedCount}/{PHOTO_SLOTS}
              {hasNewDot ? <span className="mcp-photos-dot" /> : null}
            </p>
          </header>

          <div className="mcp-photo-grid">
            {slots.map((slot, index) => {
              const unlocked = slot.collected && Boolean(slot.src);
              const src = slot.src || poster;
              return (
                <div
                  key={`${cardId}-photo-${index}`}
                  className={[
                    "mcp-photo-cell",
                    unlocked ? "is-unlocked" : "is-locked",
                  ].join(" ")}
                >
                  <img
                    src={src || "/img/placeholder.png"}
                    alt=""
                    className="mcp-photo-img"
                  />
                  {unlocked ? (
                    <>
                      <span className="mcp-photo-dot" aria-hidden="true" />
                      <div className="mcp-photo-play-cta">
                        <CtaButton
                          {...ctaButtonPropsFromTemplate("squircleCTA")}
                          fillParent
                          label=""
                          leadingIcon={
                            <Play
                              size={12}
                              strokeWidth={2.4}
                              fill="currentColor"
                              aria-hidden
                            />
                          }
                          costAmount={null}
                          fontSize={12}
                          cornerRadius={999}
                          aria-label={`${photoTitle} ${index + 1} — open`}
                          onClick={() => openPhoto(index, true)}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="mcp-photo-lock" aria-hidden="true">
                      <svg
                        width="15"
                        height="20"
                        viewBox="0 0 15 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1.875 20C1.359 20 0.918 19.814 0.551 19.441C0.184 19.068 0 18.62 0 18.095V8.571C0 8.048 0.184 7.599 0.551 7.227C0.919 6.854 1.36 6.667 1.875 6.667H2.813V4.762C2.813 3.444 3.27 2.322 4.184 1.393C5.098 0.465 6.204 0 7.5 0C8.796 0 9.902 0.464 10.817 1.393C11.732 2.323 12.189 3.446 12.188 4.762V6.667H13.125C13.641 6.667 14.082 6.853 14.45 7.227C14.817 7.6 15 8.048 15 8.571V18.095C15 18.619 14.817 19.068 14.45 19.441C14.083 19.814 13.641 20 13.125 20H1.875ZM1.875 18.095H13.125V8.571H1.875V18.095ZM4.688 6.667H10.313V4.762C10.313 3.968 10.039 3.294 9.492 2.738C8.945 2.183 8.281 1.905 7.5 1.905C6.719 1.905 6.055 2.183 5.508 2.738C4.961 3.294 4.688 3.968 4.688 4.762V6.667Z"
                          fill="white"
                          fillOpacity="0.55"
                        />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          className="cpv2-diamonds-cta"
          onClick={() => navigate(Paths.store)}
        >
          <span className="cpv2-diamonds-cta-title">
            Running low on Diamonds?
          </span>
          <span className="cpv2-diamonds-cta-btn">
            <DiamondLottie size={11} aria-hidden />
            Get Diamonds
          </span>
          <span className="cpv2-diamonds-orb is-a" aria-hidden="true">
            <DiamondLottie size={34} aria-hidden />
          </span>
          <span className="cpv2-diamonds-orb is-b" aria-hidden="true">
            <DiamondLottie size={24} aria-hidden />
          </span>
        </button>

        <footer className="cpv2-site-footer">
          <p className="cpv2-site-footer-tagline">
            <span className="is-pink">Real Creators.</span> Real Moments.
          </p>
          <nav className="cpv2-site-footer-links" aria-label="Legal">
            <button type="button" onClick={() => setLegal("privacy")}>
              Privacy Policy
            </button>
            <a href="mailto:support@sugarscratch.com">Support</a>
            <button type="button" onClick={() => setLegal("terms")}>
              Terms &amp; Conditions
            </button>
            <button type="button" onClick={() => setLegal("terms")}>
              Sign up as a influencer
            </button>
          </nav>
        </footer>
      </div>

      {legal
        ? createPortal(
            <div className="fixed inset-0 z-[80]">
              <AppPageShell
                aria-label={legal === "privacy" ? "Privacy" : "Terms"}
                className="legal-doc-shell"
              >
                <LegalDocPanel
                  kind={legal}
                  titleId={legalTitleId}
                  onBack={() => setLegal(null)}
                  variant="page"
                />
              </AppPageShell>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
