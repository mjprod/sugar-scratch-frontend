import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, Instagram } from "lucide-react";

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

function socialHref(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** One identity stack for closed + open — sizes morph via CSS variables. */
function ProfileIdentity({
  name,
  username,
  location,
  avatarSrc,
}: {
  name: string;
  username: string;
  location: string;
  avatarSrc: string;
}) {
  return (
    <div className="cpv2-profile-identity">
      <div className="cpv2-profile-identity__avatar">
        <img src={avatarSrc} alt="" decoding="async" />
      </div>
      <div className="cpv2-profile-identity__text">
        <p className="cpv2-profile-identity__name">{name}</p>
        {username ? (
          <p className="cpv2-profile-identity__handle">{username}</p>
        ) : null}
        {location ? (
          <p className="cpv2-profile-identity__location">{location}</p>
        ) : null}
      </div>
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
  instagramUrl,
  tiktokUrl,
  xUrl,
  onlyfansUrl,
  socialsPending = false,
  expandedChildren,
}: {
  name: string;
  username: string;
  avatarUrl: string;
  coverUrl: string;
  locationLabel?: string;
  onBack: () => void;
  following?: boolean;
  onToggleFollow?: () => void;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  xUrl?: string | null;
  onlyfansUrl?: string | null;
  /** True while creator board (socials) is still loading. */
  socialsPending?: boolean;
  /** Rendered inside the open profile card (e.g. progress bars). */
  expandedChildren?: ReactNode;
}) {
  const location = locationLabel?.trim() || "";
  const [expanded, setExpanded] = useState(false);
  /** Enable chevron keyframes only after first toggle (avoids mount flash). */
  const [chevronAnimReady, setChevronAnimReady] = useState(false);
  /** Bumped on each open so progress-fill CSS animations replay. */
  const [progressPlayId, setProgressPlayId] = useState(0);
  const avatarSrc = avatarUrl || "/img/placeholder.webp";

  function setExpandedOpen(next: boolean) {
    setChevronAnimReady(true);
    if (next && !expanded) setProgressPlayId((id) => id + 1);
    setExpanded(next);
  }

  return (
    <div
      className="cpv2-profile-shell"
      data-open={expanded ? "true" : "false"}
      data-chevron-anim={chevronAnimReady ? "true" : "false"}
    >
      <ProfileIdentity
        name={name}
        username={username}
        location={location}
        avatarSrc={avatarSrc}
      />

      {/* One expand control for closed + open — chevron rotates in place. */}
      <button
        type="button"
        className="cpv2-profile-expand"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse profile" : "Expand profile"}
        onClick={() => setExpandedOpen(!expanded)}
      >
        <span className="cpv2-profile-expand-chevron" aria-hidden="true">
          <ChevronDown className="size-5" strokeWidth={2.2} />
        </span>
      </button>

      <div className="cpv2-profile-bar-slot">
        <div className="cpv2-profile-bar-slot-inner">
          <div className="cpv2-profile-bar is-inline">
            <ProfileCardBackground coverUrl={coverUrl} />
            <div className="cpv2-profile-bar-inner">
              <button
                type="button"
                aria-label="Back"
                onClick={onBack}
                className="cpv2-profile-bar-back"
                tabIndex={expanded ? -1 : 0}
              >
                <ChevronLeft className="size-5" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="cpv2-profile-panel">
        <div className="cpv2-profile-panel-inner">
          <header
            className={[
              "cpv2-profile-card is-open",
              expandedChildren ? "has-progress" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <ProfileCardBackground coverUrl={coverUrl} />

            <div className="cpv2-profile-card-toolbar">
              <button
                type="button"
                aria-label="Back"
                onClick={onBack}
                className={`cpv2-profile-card-back ${GLASS_PILL}`}
                tabIndex={expanded ? 0 : -1}
              >
                <ChevronLeft className="size-5" strokeWidth={2.2} />
              </button>

              <div className="cpv2-profile-card-actions">
                {onToggleFollow ? (
                  <button
                    type="button"
                    className={[
                      "cpv2-profile-card-follow",
                      following ? "is-following" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={following}
                    tabIndex={expanded ? 0 : -1}
                    onClick={onToggleFollow}
                  >
                    {following ? "Following" : "Follow"}
                  </button>
                ) : null}
                {/* Reserves toolbar space for the shared absolute expand control. */}
                <span className="cpv2-profile-expand-slot" aria-hidden="true" />
              </div>
            </div>

            <div className="cpv2-profile-card-body">
              <div className="cpv2-profile-card-row">
                {/* Reserves the morphing identity footprint so socials stay right. */}
                <div
                  className="cpv2-profile-identity-spacer"
                  aria-hidden="true"
                />
                <ul
                  className="cpv2-profile-card-socials"
                  aria-label="Social links"
                >
                  {socialsPending ? (
                    <>
                      <li aria-hidden="true">
                        <span className="cpv2-profile-card-social is-skeleton" />
                      </li>
                      <li aria-hidden="true">
                        <span className="cpv2-profile-card-social is-skeleton" />
                      </li>
                      <li aria-hidden="true">
                        <span className="cpv2-profile-card-social is-skeleton" />
                      </li>
                    </>
                  ) : (
                    <>
                      {instagramUrl ? (
                        <li>
                          <a
                            className="cpv2-profile-card-social"
                            href={socialHref(instagramUrl)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Instagram"
                            tabIndex={expanded ? 0 : -1}
                          >
                            <Instagram className="size-3.5" strokeWidth={1.8} />
                          </a>
                        </li>
                      ) : null}
                      {tiktokUrl ? (
                        <li>
                          <a
                            className="cpv2-profile-card-social"
                            href={socialHref(tiktokUrl)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="TikTok"
                            tabIndex={expanded ? 0 : -1}
                          >
                            <TikTokIcon className="size-3.5" />
                          </a>
                        </li>
                      ) : null}
                      {xUrl ? (
                        <li>
                          <a
                            className="cpv2-profile-card-social"
                            href={socialHref(xUrl)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="X"
                            tabIndex={expanded ? 0 : -1}
                          >
                            <XIcon className="size-3.5" />
                          </a>
                        </li>
                      ) : null}
                      {onlyfansUrl ? (
                        <li>
                          <a
                            className="cpv2-profile-card-social"
                            href={socialHref(onlyfansUrl)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="OnlyFans"
                            tabIndex={expanded ? 0 : -1}
                          >
                            OF
                          </a>
                        </li>
                      ) : null}
                    </>
                  )}
                </ul>
              </div>
            </div>

            {expandedChildren ? (
              <div
                key={progressPlayId}
                className="cpv2-profile-card-progress"
              >
                {expandedChildren}
              </div>
            ) : null}
          </header>
        </div>
      </div>
    </div>
  );
}
