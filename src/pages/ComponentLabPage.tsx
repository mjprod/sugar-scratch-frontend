import { useState } from "react";
import {
  LockStatusBanner,
  type LockStatus,
} from "@/components/lock-status/LockStatusBanner";

type LabPiece = {
  id: string;
  title: string;
  figma: string;
  note: string;
};

const PIECES: LabPiece[] = [
  {
    id: "lock-status",
    title: "Lock status banner",
    figma: "243:8741",
    note: "Unlocked / Locked / min-unlocked (same pill, no label).",
  },
];

/**
 * Isolated workshop at `/component-lab`.
 * No app chrome — we build pieces here one at a time.
 */
export function ComponentLabPage() {
  const [lockStatus, setLockStatus] = useState<LockStatus>("unlocked");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 px-6 py-5 backdrop-blur-md">
        <p className="text-[11px] font-medium tracking-[0.18em] text-ink-tertiary uppercase">
          Workshop
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
          Component lab
        </h1>
        <p className="mt-1 max-w-xl text-[13px] text-ink-secondary">
          Sandbox for assembling Figma pieces one by one. Production routes stay
          untouched.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">
                {PIECES[0].title}
              </h2>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                Figma {PIECES[0].figma} · {PIECES[0].note}
              </p>
            </div>
            <div className="flex rounded-full bg-surface-muted p-0.5">
              {(
                [
                  ["unlocked", "Unlocked"],
                  ["locked", "Locked"],
                  ["min-unlocked", "Min unlocked"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLockStatus(value)}
                  className={[
                    "rounded-full px-3 py-1 text-[12px] font-medium transition",
                    lockStatus === value
                      ? "bg-white text-black"
                      : "text-ink-secondary hover:text-ink",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid place-items-center rounded-xl bg-[oklch(0.12_0_0)] px-6 py-16">
            <LockStatusBanner status={lockStatus} />
          </div>
        </section>
      </main>
    </div>
  );
}
