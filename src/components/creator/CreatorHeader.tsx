import { useEffect, useState } from "react";
import { ChevronLeft, Heart } from "lucide-react";

const FAV_KEY = "sugar.creator.favourites";

function readFavourites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeFavourites(ids: Set<string>) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / private mode
  }
}

export function CreatorHeader({
  creatorId,
  name,
  username,
  coverUrl,
  description,
  tags,
  onBack,
  following = false,
  onToggleFollow,
}: {
  creatorId: string;
  name: string;
  username: string;
  coverUrl: string;
  description: string;
  tags: string[];
  onBack: () => void;
  following?: boolean;
  onToggleFollow?: () => void;
}) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    setFavorited(readFavourites().has(creatorId));
  }, [creatorId]);

  function toggleFavorite() {
    const next = readFavourites();
    if (next.has(creatorId)) next.delete(creatorId);
    else next.add(creatorId);
    writeFavourites(next);
    setFavorited(next.has(creatorId));
  }

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

        <div className="cpv2-header-actions">
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

          <button
            type="button"
            className={[
              "cpv2-favorite",
              favorited ? "is-favorited" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={favorited}
            aria-label={favorited ? "Remove favorite" : "Add favorite"}
            onClick={toggleFavorite}
          >
            <Heart
              className="cpv2-favorite-icon"
              fill={favorited ? "currentColor" : "none"}
              aria-hidden
            />
            <span>{favorited ? "Favorited" : "Favorite"}</span>
          </button>
        </div>

        <div className="cpv2-header-portrait" aria-hidden="true">
          <img src={coverUrl} alt="" />
        </div>

        <div className="cpv2-header-main">
          <div className="cpv2-header-identity">
            <h1 className="cpv2-title">{name}</h1>
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
