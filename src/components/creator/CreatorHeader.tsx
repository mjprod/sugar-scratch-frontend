import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Instagram } from "lucide-react";

const GLASS_PILL =
  "glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.6 1.2c.5 1.5 1.6 2.6 3.1 3v2.1c-1.1.1-2.1-.2-3.1-.8v3.9c0 2.4-1.9 4.4-4.4 4.4S1.8 11.8 1.8 9.4 3.8 5 6.2 5c.3 0 .6 0 .9.1v2.2a2.2 2.2 0 0 0-2.6 2.1c0 1.2 1 2.2 2.2 2.2s2.2-1 2.2-2.2V1.2h1.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.2 2.4h2.5l2.4 3.4 2.8-3.4h2.3L9.6 7.2l3.8 5.4h-2.5L8.4 9l-3 3.6H3.1l3.9-4.6L3.2 2.4Zm2 1.2 5.7 8.1h1.1L6.3 3.6H5.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ProfileCardBackground({ coverUrl }: { coverUrl: string }) {
  return (
    <div className="cpv2-profile-card-bg" aria-hidden="true">
      <img src={coverUrl} alt="" />
      <span className="cpv2-profile-card-veil" />
      <span className="cpv2-profile-card-glow" />
    </div>
  );
}

export function CreatorHeader({
  name,
  username,
  avatarUrl,
  coverUrl,
  locationLabel,
  onBack,
  following = false,
  onToggleFollow,
}: {
  name: string;
  username: string;
  avatarUrl: string;
  coverUrl: string;
  locationLabel?: string;
  onBack: () => void;
  following?: boolean;
  onToggleFollow?: () => void;
}) {
  const location = locationLabel?.trim() || "";
  const cardRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const compactBackRef = useRef<HTMLButtonElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    const pin = pinRef.current;
    if (!card || !pin) return;

    const scroller = card.closest("[data-page-scroll]");
    const root = scroller instanceof HTMLElement ? scroller : null;
    let collapsedNow = false;
    const fadeRange = 48;

    const paint = (progress: number) => {
      const compact = Math.min(1, Math.max(0, progress));
      pin.style.opacity = String(compact);
      card.style.opacity = String(1 - compact);
    };

    const measureProgress = () => {
      const scrollTop = root ? Math.max(0, root.scrollTop) : 0;
      return scrollTop / fadeRange;
    };

    const applyCollapsed = (next: boolean) => {
      if (collapsedNow === next) return;
      collapsedNow = next;
      setCollapsed(next);
      card.classList.toggle("is-collapsed", next);
      card.classList.toggle("is-open", !next);
      card.toggleAttribute("inert", next);
      pin.classList.toggle("is-collapsed", next);
      pin.setAttribute("aria-hidden", next ? "false" : "true");
      const compactBack = compactBackRef.current;
      if (compactBack) compactBack.tabIndex = next ? 0 : -1;
    };

    const sync = () => {
      const progress = measureProgress();
      paint(progress);
      applyCollapsed(progress >= 1);
    };

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    paint(0);
    window.requestAnimationFrame(sync);
    root?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      root?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const avatarSrc = avatarUrl || "/img/placeholder.png";

  const compactBar = (
    <div
      ref={pinRef}
      className={["cpv2-profile-pin", collapsed ? "is-collapsed" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!collapsed}
    >
      <div className="cpv2-profile-bar">
        <ProfileCardBackground coverUrl={coverUrl} />
        <div className="cpv2-profile-bar-inner">
          <button
            ref={compactBackRef}
            type="button"
            aria-label="Back"
            tabIndex={collapsed ? 0 : -1}
            onClick={onBack}
            className="cpv2-profile-bar-back"
          >
            <ChevronLeft className="size-4" strokeWidth={2.2} />
          </button>
          <div className="cpv2-profile-bar-avatar">
            <img src={avatarSrc} alt="" decoding="async" />
          </div>
          <div className="cpv2-profile-bar-meta">
            <p className="cpv2-profile-bar-name">{name}</p>
            {username ? (
              <p className="cpv2-profile-bar-handle">{username}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {typeof document !== "undefined"
        ? createPortal(compactBar, document.body)
        : compactBar}

      <header
        ref={cardRef}
        className={[
          "cpv2-profile-card",
          collapsed ? "is-collapsed" : "is-open",
        ].join(" ")}
      >
        <ProfileCardBackground coverUrl={coverUrl} />

        <div className="cpv2-profile-card-toolbar">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className={`cpv2-profile-card-back ${GLASS_PILL}`}
          >
            <ChevronLeft className="size-5" strokeWidth={2.2} />
          </button>

          <div className="cpv2-profile-card-actions">
            {onToggleFollow ? (
              <button
                type="button"
                className={[
                  "cpv2-profile-card-follow",
                  GLASS_PILL,
                  following ? "is-following" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={following}
                onClick={onToggleFollow}
              >
                {following ? "Following" : "Follow"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="cpv2-profile-card-body">
          <div className="cpv2-profile-card-row">
            <div className="cpv2-profile-card-main">
              <div className="cpv2-profile-card-avatar">
                {/* Always the stable creator avatar — never theme/cover swaps. */}
                <img src={avatarSrc} alt="" decoding="async" />
              </div>
              <div className="cpv2-profile-card-identity">
                <h1 className="cpv2-profile-card-name">{name}</h1>
                {username ? (
                  <p className="cpv2-profile-card-handle">{username}</p>
                ) : null}
                {location ? (
                  <p className="cpv2-profile-card-location">{location}</p>
                ) : null}
              </div>
            </div>
            <ul className="cpv2-profile-card-socials" aria-label="Social links">
              <li>
                <span className="cpv2-profile-card-social" aria-hidden="true">
                  <Instagram className="size-3.5" strokeWidth={1.8} />
                </span>
              </li>
              <li>
                <span className="cpv2-profile-card-social" aria-hidden="true">
                  <TikTokIcon className="size-3.5" />
                </span>
              </li>
              <li>
                <span className="cpv2-profile-card-social" aria-hidden="true">
                  <XIcon className="size-3.5" />
                </span>
              </li>
            </ul>
          </div>
        </div>
      </header>
    </>
  );
}
