import type { ReactNode } from "react";
import { PackFaceVideo } from "@/components/media/PackFaceVideo";
import "./FoilPackFace.css";

/** Incoming foil pack plate — designed MP4, no holographic chrome. */
export function FoilPackFace({
  src,
  collection,
  packLabel,
  compact = false,
  sealed = false,
  overlayHud = false,
  children,
  poster,
}: {
  src: string;
  collection?: string;
  packLabel?: string;
  compact?: boolean;
  sealed?: boolean;
  /** Incoming coverflow: labels sit on the pack face. */
  overlayHud?: boolean;
  children?: ReactNode;
  poster?: string;
}) {
  const hud =
    collection || packLabel ? (
      <div className={overlayHud ? "foil-pack__hud foil-pack__hud--overlay" : "foil-pack__hud"}>
        {collection ? <p className="foil-pack__collection">{collection}</p> : null}
        {packLabel ? <p className="foil-pack__number">{packLabel}</p> : null}
      </div>
    ) : null;

  return (
    <div
      className={[
        "foil-pack",
        compact ? "foil-pack--compact" : "",
        overlayHud ? "foil-pack--coverflow" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="foil-pack__frame">
        <PackFaceVideo src={src} poster={poster} className="foil-pack__video" />
        {sealed ? <span className="foil-pack__sealed">Sealed</span> : null}
        {overlayHud ? hud : null}
        {children}
      </div>
      {overlayHud ? null : hud}
    </div>
  );
}
