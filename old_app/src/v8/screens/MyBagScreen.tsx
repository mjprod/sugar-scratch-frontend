import { PackageOpen, Sparkles } from "lucide-react";
import { listUnopenedGroups } from "../flow/packInventory";
import { listReadyToScratch } from "../flow/readyToScratch";

export function MyBagScreen({
  onOpenPack,
  onScratchGroup,
  revision = 0,
}: {
  onOpenPack?: (packId: string) => void;
  onScratchGroup?: (packId: string) => void;
  revision?: number;
}) {
  void revision;
  const unopened = listUnopenedGroups();
  const ready = listReadyToScratch();

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-[calc(52px+env(safe-area-inset-top))] pb-28 lg:px-2 lg:pt-8 lg:pb-12">
      <h1 className="text-[32px] font-bold tracking-[-0.03em] lg:hidden">My Bag</h1>
      <p className="mt-2 text-[14px] text-white/50">
        Unopened Packs and Unscratched Cards stay separate.
      </p>

      {unopened.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-[13px] font-semibold tracking-[0.14em] text-white/45 uppercase">
            Unopened Packs
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unopened.map((pack) => (
              <div
                key={pack.id}
                className="flex min-h-24 items-center rounded-[22px] border border-white/10 bg-white/5 p-4"
              >
                <span className="grid size-12 place-items-center overflow-hidden rounded-2xl bg-[#8B5CF6]/15">
                  <img src={pack.coverUrl} alt="" className="size-full object-cover" />
                </span>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{pack.creator}</p>
                  <p className="mt-1 text-[12px] text-white/50">
                    {pack.name} · {pack.count}{" "}
                    {pack.count === 1 ? "Pack Ready to Open" : "Packs Ready to Open"}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-[12px] font-semibold text-[#C4B5FD]"
                    onClick={() => onOpenPack?.(pack.id)}
                  >
                    Open Pack
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {ready.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-[13px] font-semibold tracking-[0.14em] text-white/45 uppercase">
            Unscratched Cards
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ready.map((group) => (
              <div
                key={group.id}
                className="flex min-h-24 items-center rounded-[22px] border border-white/10 bg-white/5 p-4"
              >
                <span className="grid size-12 place-items-center overflow-hidden rounded-2xl bg-[#8B5CF6]/15 text-[#A78BFA]">
                  {group.coverUrl ? (
                    <img src={group.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Sparkles className="size-5" />
                  )}
                </span>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{group.creatorName}</p>
                  <p className="mt-1 text-[12px] text-white/50">
                    {group.collectionName} · {group.count}{" "}
                    {group.count === 1 ? "Card Ready" : "Cards Ready"}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-[12px] font-semibold text-[#C4B5FD]"
                    onClick={() => onScratchGroup?.(group.id)}
                  >
                    Scratch Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {unopened.length === 0 && ready.length === 0 ? (
        <div className="mt-8 rounded-[28px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
          <PackageOpen className="mx-auto size-9 text-white/25" />
          <h2 className="mt-4 text-[18px] font-semibold">Your bag is empty</h2>
          <p className="mt-2 text-[13px] text-white/45">
            Purchase packs from Home or Explore.
          </p>
        </div>
      ) : null}
    </section>
  );
}
