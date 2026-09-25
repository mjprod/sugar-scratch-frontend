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

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function CreatorHeader({
  name,
  username,
  avatarUrl,
  coverUrl,
  locationLabel,
  collapseProgress = 0,
  onBack,
  following = false,
  onToggleFollow,
}: {
  name: string;
  username: string;
  avatarUrl: string;
  coverUrl: string;
  locationLabel?: string;
  /** 0 = fully open, 1 = fully collapsed. */
  collapseProgress?: number;
  onBack: () => void;
  following?: boolean;
  onToggleFollow?: () => void;
}) {
  const location = locationLabel?.trim() || "";
  const collapsed = clamp01(collapseProgress) >= 0.5;
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    // Binary target only — CSS @property animates 0 ↔ 1.
    node.style.setProperty("--cpv2-profile-collapse", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <header
      ref={cardRef}
      className={[
        "cpv2-profile-card",
        collapsed ? "is-collapsed" : "is-open",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-expanded={!collapsed}
      style={{
        ["--cpv2-profile-collapse" as string]: collapsed ? "1" : "0",
      }}
    >
      <div className="cpv2-profile-card-bg" aria-hidden="true">
        <img src={coverUrl} alt="" />
        <span className="cpv2-profile-card-veil" />
        <span className="cpv2-profile-card-glow" />
      </div>

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
          <img
            src={avatarUrl || "/img/placeholder.png"}
            alt=""
            decoding="async"
          />
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
  );
}
