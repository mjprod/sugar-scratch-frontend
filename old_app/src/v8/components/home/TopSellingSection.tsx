import { Button } from "../ui";
import { formatPrice, type CardPackSummary } from "../../flow/homeFeed";
import { PackArt } from "./PackArt";

export function TopSellingSection({
  packs,
  creatorName,
  themeName,
  hasMore,
  loadingMore,
  onPlay,
  onOpenDetail,
  onShowMore,
}: {
  packs: CardPackSummary[];
  creatorName: string;
  themeName: string | null;
  hasMore: boolean;
  loadingMore?: boolean;
  onPlay: (pack: CardPackSummary) => void;
  onOpenDetail: (pack: CardPackSummary) => void;
  onShowMore: () => void;
}) {
  return (
    <div>
      <h2 className="text-[24px] font-bold tracking-[-0.02em] lg:text-[28px]">
        Top Sugar Scratch Game
      </h2>
      <p className="mt-1 text-[13px] text-white/45">
        {themeName
          ? `Top-selling ${themeName} packs from ${creatorName}`
          : `Sorted by purchase count · ${creatorName}`}
      </p>

      {packs.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 px-4 py-10 text-center">
          <p className="text-[15px] font-medium">No packs for this filter</p>
          <p className="mt-1 text-[13px] text-white/45">
            Try another theme — creators and filters stay available.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
          {packs.map((pack, i) => (
            <li key={pack.id}>
              <div className="flex items-center gap-3 rounded-[20px] border border-white/[0.08] bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.07]">
                <span className="w-6 text-center text-[14px] font-bold tabular-nums text-white/45">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDetail(pack)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <PackArt
                    src={pack.thumbnailUrl}
                    alt=""
                    size="thumb"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {pack.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-white/50">
                      {pack.creatorName} · {pack.themeName} ·{" "}
                      {pack.purchaseCount.toLocaleString()} buys
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#D4AF37]">
                    {formatPrice(pack.price)}
                  </span>
                </button>
                <Button
                  variant="primary"
                  className="h-10 shrink-0 rounded-full px-4 text-[13px]"
                  disabled={!pack.isAvailable}
                  onClick={() => onPlay(pack)}
                >
                  {pack.isAvailable ? "Play" : "—"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="ghost"
            className="border-white/15 text-white/70"
            loading={loadingMore}
            onClick={onShowMore}
          >
            Show More
          </Button>
        </div>
      ) : null}
    </div>
  );
}
