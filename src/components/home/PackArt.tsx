import { useEffect, useState } from "react";
import { PackFaceVideo } from "@/components/media/PackFaceVideo";
import { isVideoSrc } from "@/services/models";
import "@/shared/ui/PageContentEnter.css";

/** Pack artwork with foil overlay + image fallback */
export function PackArt({
  src,
  alt,
  size = "md",
  fit = "cover",
  className = "",
  poster,
}: {
  src: string;
  alt: string;
  size?: "lg" | "md" | "thumb";
  fit?: "cover" | "contain";
  className?: string;
  poster?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const sizeClass =
    size === "lg" ? "card-pack-lg" : size === "thumb" ? "card-pack-thumb" : "card-pack-md";
  const mediaClass =
    fit === "contain"
      ? "absolute inset-0 size-full object-contain"
      : "absolute inset-0 size-full object-cover";
  const fadeClass = ["media-fade-in", ready ? "is-ready" : ""]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setFailed(false);
    setReady(false);
  }, [src]);

  return (
    <div
      className={[
        sizeClass,
        "relative overflow-hidden rounded-[24px] border border-white/15 bg-[oklch(0.218_0_0)] shadow-[0_20px_60px_oklch(0_0_0_/_0.45)]",
        size === "thumb" ? "rounded-xl" : "",
        className,
      ].join(" ")}
    >
      {!failed ? (
        isVideoSrc(src) ? (
          <PackFaceVideo
            src={src}
            poster={poster}
            className={[mediaClass, fadeClass].join(" ")}
            onError={() => setFailed(true)}
            onReady={() => setReady(true)}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            onLoad={() => setReady(true)}
            className={[mediaClass, fadeClass].join(" ")}
          />
        )
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.606_0.219_292.72)]/40 to-[oklch(0.196_0_0)]" />
      )}
      {/* Foil / glass sheen */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(145deg, oklch(1 0 0 / 0.22) 0%, transparent 42%), linear-gradient(to top, oklch(0 0 0 / 0.55) 0%, transparent 45%)",
        }}
        aria-hidden
      />
    </div>
  );
}

export function CreatorAvatar({
  src,
  name,
  selected,
  size = 56,
}: {
  src: string;
  name: string;
  selected?: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFailed(false);
    setReady(false);
  }, [src]);

  return (
    <span
      className={[
        "relative block overflow-hidden rounded-full",
        selected
          ? "ring-2 ring-[oklch(0.606_0.219_292.72)]/70 shadow-[0_0_24px_oklch(0.606_0.219_292.72_/_0.45)]"
          : "border border-white/[0.08]",
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      {!failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          onLoad={() => setReady(true)}
          className={[
            "size-full object-cover media-fade-in",
            ready ? "is-ready" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ) : (
        <span className="grid size-full place-items-center bg-[oklch(0.606_0.219_292.72)]/30 text-caption font-bold text-white">
          {name.slice(0, 1)}
        </span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
