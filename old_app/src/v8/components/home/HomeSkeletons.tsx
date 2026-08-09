export function HeroSkeleton() {
  return (
    <div className="min-h-[320px] animate-pulse rounded-[28px] border border-white/10 bg-white/5 sm:min-h-[360px] lg:min-h-[420px]">
      <div className="flex h-full flex-col justify-end p-6">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="mt-3 h-8 w-3/4 rounded bg-white/10" />
        <div className="mt-3 h-3 w-40 rounded bg-white/10" />
        <div className="mt-5 h-12 w-full max-w-sm rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export function CreatorSkeleton() {
  return (
    <div className="flex gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex w-[76px] flex-col items-center gap-2">
          <div className="size-14 animate-pulse rounded-full bg-white/10" />
          <div className="h-2.5 w-12 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function ThemeSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-white/10" />
      ))}
    </div>
  );
}

export function TopListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="flex h-[76px] animate-pulse items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 px-3"
        >
          <div className="size-14 rounded-xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="h-2.5 w-1/3 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
