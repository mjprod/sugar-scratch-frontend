import { motion } from "framer-motion";
import { useEffect } from "react";
import { LogoMark } from "../components/ui";

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1800);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(139,92,246,0.28), transparent 45%), linear-gradient(180deg, #151515, #090909)",
        }}
        aria-hidden
      />
      <motion.div
        className="relative z-10"
        initial={{ scale: 0.86, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <LogoMark size="lg" />
        </motion.div>
      </motion.div>
      <motion.div
        className="relative z-10 mt-6 size-9 rounded-full border-[2.5px] border-white/15 border-t-[#A855F7]"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        aria-hidden
      />
      <p className="relative z-10 mt-5 text-[28px] font-bold tracking-[-0.02em] text-white">
        Sugar
      </p>
      <p className="relative z-10 mt-1 text-[13px] tracking-[0.2em] text-white/45 uppercase">
        Scratch
      </p>
    </section>
  );
}
