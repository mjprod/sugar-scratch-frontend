import { useEffect, useState } from "react";
import { LightScreen } from "../components/PhoneShell";
import { BackButton, Button, Field, HomeIndicator, ProgressBar } from "../components/ui";

const VALID_CODE = "1234";

export function VerifyEmailScreen({
  email,
  onContinue,
  onBack,
}: {
  email: string;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const codeOk = code.trim() === VALID_CODE;

  useEffect(() => {
    if (countdown <= 0) return;
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  async function continueNext() {
    if (!codeOk) {
      setError("Enter the verification code sent to your email.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    onContinue();
  }

  return (
    <LightScreen>
      <div className="flex flex-1 flex-col px-6 pt-12">
        <BackButton onClick={onBack} />
        <div className="mt-5">
          <ProgressBar step={2} total={3} />
        </div>

        <h1 className="mt-10 font-display text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
          Verify your email
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
          We’ve sent a verification code to{" "}
          <span className="font-medium text-ink">{email || "your email"}</span>
        </p>
        <p className="mt-2 text-[14px] text-ink-tertiary">
          Please enter your verification code in the field below
        </p>

        <div className="mt-8 flex flex-1 flex-col">
          <Field
            label="Enter code here*"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 4));
              setError("");
            }}
            inputMode="numeric"
            success={codeOk}
            error={error || undefined}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (countdown > 0) return;
                setCountdown(45);
                setError("");
                setCode("");
              }}
              disabled={countdown > 0}
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-brand disabled:text-ink-tertiary"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend"}
            </button>
          </div>
          <p className="mt-4 text-[12px] text-ink-tertiary">Demo code: 1234</p>
          <div className="flex-1" />
          <Button
            full
            variant="primary"
            disabled={!codeOk}
            loading={loading}
            onClick={continueNext}
            className="mx-auto max-w-[280px]"
          >
            Continue
          </Button>
          <HomeIndicator />
        </div>
      </div>
    </LightScreen>
  );
}
