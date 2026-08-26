import { ChevronLeft } from "lucide-react";

export function CreatorHeader({
  name,
  username,
  coverUrl,
  description,
  tags,
  onBack,
  following = false,
  onToggleFollow,
}: {
  name: string;
  username: string;
  coverUrl: string;
  description: string;
  tags: string[];
  onBack: () => void;
  following?: boolean;
  onToggleFollow?: () => void;
}) {
  return (
    <header className="cpv2-header">
      <div className="cpv2-header-hero">
        <button
          type="button"
          aria-label="Back to Home"
          onClick={onBack}
          className="cpv2-back"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="cpv2-header-portrait" aria-hidden="true">
          <img src={coverUrl} alt="" />
        </div>

        <div className="cpv2-header-main">
          <div className="cpv2-header-identity">
            <div className="cpv2-name-row">
              <h1 className="cpv2-title">{name}</h1>
              {onToggleFollow ? (
                <button
                  type="button"
                  className={[
                    "cpv2-follow",
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
            {username ? <p className="cpv2-username">{username}</p> : null}
          </div>

          {tags.length > 0 ? (
            <ul className="cpv2-header-tags" aria-label="Themes">
              {tags.map((tag) => (
                <li key={tag} className="cpv2-header-tag">
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}

          {description ? (
            <p className="cpv2-header-desc">{description}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
