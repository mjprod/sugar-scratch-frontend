import { useState } from "react";

/** Pack artwork with foil overlay + image fallback */
export function PackArt({
  src,
  alt,
  size = "md",
  className = "",
}: {
  src: string;
  alt: string;
  size?: "lg" | "md" | "thumb";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass =
    size === "lg" ? "card-pack-lg" : size === "thumb" ? "card-pack-thumb" : "card-pack-md";

  return (
    <div
      className={[
        sizeClass,
        "relative overflow-hidden rounded-[24px] border border-white/15 bg-[#1a1a1a] shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
        size === "thumb" ? "rounded-xl" : "",
        className,
      ].join(" ")}
    >
      {!failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/40 to-[#151515]" />
      )}
      {/* Foil / glass sheen */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(145deg, rgba(255,255,255,0.22) 0%, transparent 42%), linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%)",
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

  return (
    <span
      className={[
        "relative block overflow-hidden rounded-full",
        selected
          ? "ring-2 ring-[#8B5CF6]/70 shadow-[0_0_24px_rgba(139,92,246,0.45)]"
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
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center bg-[#8B5CF6]/30 text-[13px] font-bold text-white">
          {name.slice(0, 1)}
        </span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
