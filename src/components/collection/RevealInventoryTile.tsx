/** Shared compact inventory tile for Ready to Reveal (cards + packs). */
import { useEffect, useState } from "react";
import { PACK_PHOTOS } from "@/lib/photos";

export function RevealInventoryTile({
  coverUrl,
  title,
  creator,
  quantityLabel,
  ariaLabel,
  onClick,
}: {
  coverUrl: string;
  title: string;
  creator: string;
  quantityLabel: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  const [src, setSrc] = useState(coverUrl || PACK_PHOTOS.ep1);

  useEffect(() => {
    setSrc(coverUrl || PACK_PHOTOS.ep1);
  }, [coverUrl]);

  return (
    <button
      type="button"
      className="ready-reveal-tile"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="ready-reveal-tile-art">
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => {
            if (src !== PACK_PHOTOS.ep1) setSrc(PACK_PHOTOS.ep1);
          }}
        />
      </span>
      <span className="ready-reveal-tile-meta">
        <span className="ready-reveal-tile-name">{title}</span>
        <span className="ready-reveal-tile-creator">{creator}</span>
        <span className="ready-reveal-tile-qty">{quantityLabel}</span>
      </span>
    </button>
  );
}
