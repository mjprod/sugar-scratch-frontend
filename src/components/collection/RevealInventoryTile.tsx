/** Shared inventory tile for Ready to Reveal (packs + cards). */
import { useEffect, useState } from "react";
import { PACK_PHOTOS } from "@/lib/photos";

export function RevealInventoryTile({
  coverUrl,
  title,
  creator,
  quantityLabel,
  typeLabel,
  actionLabel,
  ariaLabel,
  onClick,
}: {
  coverUrl: string;
  title: string;
  creator: string;
  quantityLabel?: string;
  typeLabel?: string;
  actionLabel: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  const [src, setSrc] = useState(coverUrl || PACK_PHOTOS.ep1);

  useEffect(() => {
    setSrc(coverUrl || PACK_PHOTOS.ep1);
  }, [coverUrl]);

  return (
    <article className="ready-reveal-tile">
      <button
        type="button"
        className="ready-reveal-tile-art-btn"
        onClick={onClick}
        aria-label={ariaLabel}
      >
        <img
          src={src}
          alt=""
          className="ready-reveal-tile-art-img"
          onError={() => {
            if (src !== PACK_PHOTOS.ep1) setSrc(PACK_PHOTOS.ep1);
          }}
        />
      </button>
      <div className="ready-reveal-tile-body">
        <button
          type="button"
          className="ready-reveal-tile-meta"
          onClick={onClick}
          tabIndex={-1}
        >
          <span className="ready-reveal-tile-creator">{creator}</span>
          <span className="ready-reveal-tile-name">{title}</span>
          {quantityLabel ? (
            <span className="ready-reveal-tile-qty">{quantityLabel}</span>
          ) : null}
          {typeLabel ? (
            <span className="ready-reveal-tile-type">{typeLabel}</span>
          ) : null}
        </button>
        <button
          type="button"
          className="ready-reveal-tile-action"
          onClick={onClick}
        >
          {actionLabel}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </article>
  );
}
