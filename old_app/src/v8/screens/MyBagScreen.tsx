import { PackageOpen, Sparkles } from "lucide-react";

export function MyBagScreen({
  hasWelcomePack,
  purchasedPacks = 0,
}: {
  hasWelcomePack?: boolean;
  purchasedPacks?: number;
}) {
  const packs = [
    ...(hasWelcomePack
      ? [{ name: "Starter Scratch Pack", status: "Ready to scratch" }]
      : []),
    ...Array.from({ length: purchasedPacks }, (_, index) => ({
      name: `New Collectible Card ${index + 1}`,
      status: "Revealed · Added today",
    })),
  ];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-[88px] pb-28 lg:px-2 lg:pt-8 lg:pb-12">
      <h1 className="text-[32px] font-bold tracking-[-0.03em] lg:hidden">My Bag</h1>
      <p className="mt-2 text-[14px] text-white/50">
        Your collected packs are stored here.
      </p>
      {packs.length ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((p, index) => (
          <div
            key={`${p.name}-${index}`}
            className="flex min-h-24 items-center rounded-[22px] border border-white/10 bg-white/5 p-4"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-[#8B5CF6]/15 text-[#A78BFA]">
              {index === 0 && hasWelcomePack ? (
                <PackageOpen className="size-5" />
              ) : (
                <Sparkles className="size-5" />
              )}
            </span>
            <div className="ml-3">
              <p className="text-[15px] font-semibold">{p.name}</p>
              <p className="mt-1 text-[12px] text-white/50">{p.status}</p>
            </div>
          </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[28px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
          <PackageOpen className="mx-auto size-9 text-white/25" />
          <h2 className="mt-4 text-[18px] font-semibold">Your collection is empty</h2>
          <p className="mt-2 text-[13px] text-white/45">Purchase packs from Home or Explore.</p>
        </div>
      )}
    </section>
  );
}
