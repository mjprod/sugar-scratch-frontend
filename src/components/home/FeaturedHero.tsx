import { AnimatePresence, motion } from "framer-motion";
import { Heart, Play } from "lucide-react";
import { Button } from "../ui";
import { formatPrice, type CardPackSummary } from "@/services/homeFeed";
import { PackArt } from "./PackArt";

/**
 * Featured Hero — photography-first foil pack + editorial backdrop.
 */
export function FeaturedHero({
  pack,
  updating,
  onFavourite,
  onStartPlaying,
  onOpenDetail,
}: {
  pack: CardPackSummary | null;
  updating?: boolean;
  onFavourite: () => void;
  onStartPlaying: () => void;
  onOpenDetail: () => void;
}) {
  if (!pack) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/[0.05] px-6 py-16 text-center">
        <p className="text-[24px] font-bold">No featured pack</p>
        <p className="mt-2 text-[14px] text-white/45">Try another creator or theme.</p>
      </div>
    );
  }

  const unavailable = !pack.isAvailable;

  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={pack.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: updating ? 0.72 : 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#101010] shadow-float"
      >
        {/* Full-bleed photo atmosphere */}
        <img
          src={pack.coverImageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/75 to-[#090909]/35" />

        <div className="relative flex min-h-[420px] flex-col gap-6 p-5 sm:min-h-[480px] lg:min-h-[680px] lg:flex-row lg:items-end lg:gap-10 lg:p-10">
          <motion.button
            type="button"
            onClick={onOpenDetail}
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ duration: 0.15 }}
            className="mx-auto shrink-0 lg:mx-0"
            aria-label={`View ${pack.name}`}
          >
            <PackArt
              src={pack.coverImageUrl}
              alt={`${pack.name} artwork`}
              size="md"
              className="lg:!w-[var(--card-pack-width-lg)]"
            />
          </motion.button>

          <div className="relative flex min-w-0 flex-1 flex-col justify-end">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {pack.badge ? (
                <span className="rounded-full border border-[#D4AF37]/40 bg-black/40 px-3 py-1 text-[11px] font-semibold text-[#D4AF37]">
                  {pack.badge}
                </span>
              ) : null}
              {pack.popularityLabel ? (
                <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-xl">
                  {pack.popularityLabel}
                </span>
              ) : pack.purchaseCount ? (
                <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-xl">
                  {pack.purchaseCount.toLocaleString()} buys
                </span>
              ) : null}
              {unavailable ? (
                <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white/60">
                  Unavailable
                </span>
              ) : null}
              <button
                type="button"
                aria-label={pack.isFavourite ? "Remove favourite" : "Add favourite"}
                aria-pressed={pack.isFavourite}
                onClick={onFavourite}
                className={[
                  "ml-auto grid size-11 place-items-center rounded-full border backdrop-blur-xl transition-colors",
                  pack.isFavourite
                    ? "border-[#EC4899]/50 bg-[#EC4899]/20 text-[#EC4899]"
                    : "border-white/10 bg-white/[0.08] text-white/80",
                ].join(" ")}
              >
                <Heart
                  className="size-5"
                  strokeWidth={2}
                  fill={pack.isFavourite ? "currentColor" : "none"}
                />
              </button>
            </div>

            <p className="text-[14px] font-medium text-white/72">{pack.creatorName}</p>
            <h1 className="mt-1 text-[32px] leading-[1.1] font-bold tracking-[-0.02em] text-white sm:text-[40px] lg:text-[48px]">
              {pack.name}
            </h1>
            <p className="mt-2 text-[14px] text-white/45">
              {pack.themeName}
              <span className="mx-2 text-white/25">·</span>
              {formatPrice(pack.price)}
            </p>

            <div className="mt-6 flex max-w-md flex-col gap-2">
              <Button
                full
                variant="primary"
                className="h-14 lg:h-16"
                disabled={unavailable}
                onClick={onStartPlaying}
                aria-label={`Start playing ${pack.name}`}
              >
                <Play className="size-4 fill-current" />
                {unavailable
                  ? "Unavailable"
                  : `Start Playing · ${formatPrice(pack.price)}`}
              </Button>
              <button
                type="button"
                className="text-center text-[13px] font-medium text-white/45 underline-offset-2 hover:text-white/72 hover:underline"
                onClick={onOpenDetail}
              >
                View pack detail
              </button>
            </div>
          </div>
        </div>
      </motion.article>
    </AnimatePresence>
  );
}
