import { Heart } from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  listFeedFavourites,
  removeFeedFavourite,
  type FeedFavourite,
} from "@/services/feedFavourites";
import { readHomeFeedCache, writeHomeFeedCache } from "@/services/creatorFeed";
import { useMemo, useState } from "react";

export function FavouritesScreen({
  onBack,
  onOpenCreator,
}: {
  onBack: () => void;
  onOpenCreator?: (creatorId: string) => void;
}) {
  const [items, setItems] = useState(() => listFeedFavourites());

  const empty = items.length === 0;
  const heading = useMemo(
    () => (items.length === 1 ? "1 favourite" : `${items.length} favourites`),
    [items.length],
  );

  function unlike(item: FeedFavourite) {
    removeFeedFavourite(item);
    const cache = readHomeFeedCache();
    if (cache) {
      writeHomeFeedCache({
        ...cache,
        items: cache.items.map((entry) =>
          (entry.creatorId || entry.id) === item.id
            ? { ...entry, liked: false }
            : entry,
        ),
      });
    }
    setItems(listFeedFavourites());
  }

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Favourites"
      className="favourites-page"
    >
      <SubpageHeader
        title="Favourite"
        onBack={onBack}
        backLabel="Back to profile"
      />
      {empty ? (
        <p className="mt-10 text-center text-[14px] text-white/50">
          Like a video on Explore to save it here.
        </p>
      ) : (
        <>
          <p className="mt-4 text-[12px] font-semibold tracking-[0.12em] text-white/40 uppercase">
            {heading}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.03]"
              >
                <button
                  type="button"
                  className="relative aspect-[3/4] w-full"
                  onClick={() =>
                    item.creatorId ? onOpenCreator?.(item.creatorId) : undefined
                  }
                  aria-label={`${item.creatorName} pack`}
                >
                  {item.videoUrl ? (
                    <video
                      src={item.videoUrl}
                      poster={item.posterUrl || undefined}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                  ) : (
                    <img
                      src={item.posterUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                </button>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {item.creatorName}
                    </p>
                    <p className="truncate text-[11px] text-white/45">
                      {item.packName}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full text-[oklch(0.656_0.212_354.31)]"
                    aria-label="Remove from favourites"
                    onClick={() => unlike(item)}
                  >
                    <Heart className="size-4" fill="currentColor" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </AppPageShell>
  );
}
