import { useEffect, useRef } from "react";
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
  const pinRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const compactBackRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const pin = pinRef.current;
    const bar = barRef.current;
    const card = cardRef.current;
    if (!pin || !bar || !card) return;

    const scroller = card.closest("[data-page-scroll]");
    let collapsedNow = pin.classList.contains("is-collapsed");
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const fadeOpacity = (node: HTMLElement, to: number) => {
      // iOS skips CSS opacity transitions on sticky descendants; WAAPI does not.
      node.getAnimations().forEach((animation) => animation.cancel());
      const from = Number.parseFloat(getComputedStyle(node).opacity) || 0;
      node.animate([{ opacity: from }, { opacity: to }], {
        duration: reduceMotion ? 0 : 360,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      });
    };

    const fadeBar = (collapsed: boolean) => {
      fadeOpacity(bar, collapsed ? 1 : 0);
      fadeOpacity(card, collapsed ? 0 : 1);
    };

    const setCollapsed = (collapsed: boolean) => {
      if (collapsedNow === collapsed) return;
      collapsedNow = collapsed;
      pin.classList.toggle("is-collapsed", collapsed);
      pin.setAttribute("aria-hidden", collapsed ? "false" : "true");
      card.classList.toggle("is-collapsed", collapsed);
      card.classList.toggle("is-open", !collapsed);
      card.toggleAttribute("inert", collapsed);
      const compactBack = compactBackRef.current;
      if (compactBack) compactBack.tabIndex = collapsed ? 0 : -1;
      fadeBar(collapsed);
    };

    let primed = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const collapsed = !entry.isIntersecting;
        // First IO tick is layout. Keep the bar at opacity 0 so the next
        // collapse can fade in instead of appearing already painted.
        if (!primed) {
          primed = true;
          if (collapsed) requestAnimationFrame(() => setCollapsed(true));
          return;
        }
        setCollapsed(collapsed);
      },
      {
        root: scroller instanceof HTMLElement ? scroller : null,
        // Collapse once the open card has scrolled under the HUD, without
        // rewriting layout height (that stuttered on iOS momentum scroll).
        rootMargin: "-72px 0px 0px 0px",
        threshold: 0,
      },
    );

    observer.observe(card);
    return () => {
      observer.disconnect();
      bar.getAnimations().forEach((animation) => animation.cancel());
      card.getAnimations().forEach((animation) => animation.cancel());
    };
  }, []);

  const avatarSrc = avatarUrl || "/img/placeholder.png";

  return (
    <>
      <div
        ref={pinRef}
        className="cpv2-profile-pin"
        aria-hidden="true"
      >
        <div ref={barRef} className="cpv2-profile-bar">
          <ProfileCardBackground coverUrl={coverUrl} />
          <div className="cpv2-profile-bar-inner">
            <button
              ref={compactBackRef}
              type="button"
              aria-label="Back"
              tabIndex={-1}
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

      <header ref={cardRef} className="cpv2-profile-card is-open">
        <ProfileCardBackground coverUrl={coverUrl} />

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

        <div className="cpv2-profile-card-body">
          <div className="cpv2-profile-card-avatar">
            {/* Always the stable creator avatar — never theme/cover swaps. */}
            <img src={avatarSrc} alt="" decoding="async" />
          </div>
          <div className="cpv2-profile-card-meta">
            <div className="cpv2-profile-card-identity">
              <h1 className="cpv2-profile-card-name">{name}</h1>
              {username ? (
                <p className="cpv2-profile-card-handle">{username}</p>
              ) : null}
            </div>
            {location ? (
              <p className="cpv2-profile-card-location">{location}</p>
            ) : null}
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
