import { useNavigate } from "react-router-dom";
import { LogoMark } from "@/components/ui";
import { Paths } from "@/routes/Paths";
import { motion } from "framer-motion";
import { useEffect } from "react";

const BOOT_KEY = "sugar.v8.bootShown";

export function LoadingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => navigate(Paths.home, { replace: true }), 1800);
    return () => window.clearTimeout(t);
  }, [navigate]);

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
        <p className="mt-6 text-[15px] text-white/55">Loading Sugar Scratch…</p>
      </motion.div>
    </section>
  );
}
