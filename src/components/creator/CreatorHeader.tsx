import { ChevronLeft } from "lucide-react";

export function CreatorHeader({
  name,
  coverUrl,
  onBack,
  following = false,
  onToggleFollow,
}: {
  name: string;
  coverUrl: string;
  onBack: () => void;
  following?: boolean;
  onToggleFollow?: () => void;
}) {
  return (
    <header className="cpv2-header">
      <div className="cpv2-header-hero">
        <img src={coverUrl} alt="" className="size-full object-cover object-top" />
        <div className="cpv2-header-shade" />
        <button
          type="button"
          aria-label="Back to Home"
          onClick={onBack}
          className="cpv2-back"
        >
          <ChevronLeft className="size-5" />
        </button>
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
        <div className="cpv2-header-copy">
          <h1 className="cpv2-title">{name}</h1>
          <p className="cpv2-subtitle">All Collections</p>
        </div>
      </div>
    </header>
  );
}
