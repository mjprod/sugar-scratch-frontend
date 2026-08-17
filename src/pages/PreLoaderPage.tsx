import { CardFallLoader } from "@/components/CardFallLoader";

export function PreLoaderPage() {
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, oklch(0.639 0.256 9.90 / 0.28), transparent 45%), linear-gradient(180deg, oklch(0.196 0 0), oklch(0.14 0 0))",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center">
        <CardFallLoader label="Loading Sugar Scratch" />
        <p className="mt-8 text-[15px] text-white/55">Loading Sugar Scratch…</p>
      </div>
    </section>
  );
}
