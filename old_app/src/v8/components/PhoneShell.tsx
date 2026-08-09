import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  AuthShell,
  type AuthShellMode,
} from "./auth/AuthShell";
import { STEP_LABEL, type Step } from "../flow/types";

const APP_STEPS = new Set<Step>(["app"]);

/** Dedicated recovery / legacy auth pages */
const AUTH2_STEPS = new Set<Step>([
  "sign-in",
  "create-account",
  "forgot-password",
  "reset-password",
  "verify-email",
  "create-username",
  "complete-profile",
]);

/** Required onboarding — full-height shell, no app chrome */
const ONBOARD_STEPS = new Set<Step>([
  "recommend-intro",
  "personalize-swipe",
  "personalize-complete",
]);

function auth2Mode(step: Step): AuthShellMode {
  if (step === "sign-in") return "login";
  if (step === "create-account") return "signup";
  if (step === "forgot-password" || step === "reset-password") return "recover";
  return "onboarding";
}

/**
 * v8 shell router:
 * — Auth Experience for login / signup / recover
 * — Required onboarding fullscreen
 * — App shell for the product (guest + authenticated)
 */
export function SiteShell({
  step,
  children,
  onAuthHeaderAction,
}: {
  step: Step;
  children: ReactNode;
  onAuthHeaderAction?: () => void;
}) {
  if (AUTH2_STEPS.has(step)) {
    return (
      <AuthShell mode={auth2Mode(step)} onHeaderAction={onAuthHeaderAction}>
        <Stage step={step}>{children}</Stage>
      </AuthShell>
    );
  }

  if (ONBOARD_STEPS.has(step)) {
    return (
      <div className="auth7-onboard-shell" aria-label="Personalization">
        <header className="auth7-onboard-header">
          <span className="auth2-logo">Sugar</span>
          <span className="auth7-onboard-badge">{STEP_LABEL[step]}</span>
        </header>
        <div className="auth7-onboard-main">
          <Stage step={step}>{children}</Stage>
        </div>
      </div>
    );
  }

  if (!APP_STEPS.has(step)) {
    return (
      <div className="auth-prelude mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 py-6 sm:py-10 lg:max-w-none lg:px-0 lg:py-0">
        <div className="mb-3 flex justify-center lg:absolute lg:top-4 lg:right-6 lg:z-20 lg:mb-0">
          <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] text-white/40 backdrop-blur-md">
            {STEP_LABEL[step]} · v8
          </span>
        </div>
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-canvas-elevated shadow-float lg:min-h-dvh lg:rounded-none lg:border-0 lg:shadow-none"
          aria-label="Sugar Scratch authentication prelude"
        >
          <Stage step={step}>{children}</Stage>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="pointer-events-none sticky top-0 z-40 -mb-2 flex justify-end pt-2 sm:pt-3">
          <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] text-white/40 backdrop-blur-md">
            {STEP_LABEL[step]} · v8
          </span>
        </div>
        <div
          className="relative flex min-h-[calc(100dvh-24px)] min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none lg:min-h-[calc(100dvh-40px)]"
          aria-label="Sugar Scratch v8 website prototype"
        >
          <Stage step={step}>{children}</Stage>
        </div>
      </div>
    </div>
  );
}

function Stage({ step, children }: { step: Step; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        className="flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** @deprecated alias kept for screen imports during migration */
export function PhoneShell(props: {
  step: Step;
  children: ReactNode;
  onAuthHeaderAction?: () => void;
}) {
  return <SiteShell {...props} />;
}

export function LightScreen({ children }: { children: ReactNode }) {
  return (
    <section className="auth2-embed flex min-h-0 flex-1 flex-col bg-transparent text-ink">
      {children}
    </section>
  );
}
