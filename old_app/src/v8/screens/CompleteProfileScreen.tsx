import { useState } from "react";
import { LightScreen } from "../components/PhoneShell";
import { BackButton, Button, Field, HomeIndicator } from "../components/ui";
import { AVATAR_OPTIONS } from "../flow/types";

export function CompleteProfileScreen({
  username,
  onContinue,
  onBack,
}: {
  username: string;
  onContinue: (data: { displayName: string; avatar: string }) => void;
  onBack: () => void;
}) {
  const [displayName, setDisplayName] = useState(username);
  const [avatar, setAvatar] = useState<string>(AVATAR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);

  const ok = displayName.trim().length >= 2;

  async function finish() {
    if (!ok) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    onContinue({ displayName: displayName.trim(), avatar });
  }

  return (
    <LightScreen>
      <div className="flex flex-1 flex-col px-6 pt-12">
        <BackButton onClick={onBack} />
        <h1 className="mt-10 font-display text-[34px] leading-[1.1] font-semibold tracking-[-0.02em]">
          Complete your profile
        </h1>
        <p className="mt-2 text-[15px] text-ink-secondary">
          One last step — then you’re in.
        </p>

        <div className="mt-8 flex flex-1 flex-col gap-6">
          <div>
            <p className="mb-3 text-[13px] font-medium text-ink-secondary">Pick an avatar</p>
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={[
                    "grid size-14 place-items-center rounded-2xl text-[24px] transition-all",
                    avatar === a
                      ? "bg-gradient-to-br from-berry to-brand shadow-[0_8px_20px_rgba(244,63,94,0.35)] ring-2 ring-brand/40"
                      : "border border-line bg-surface-raised",
                  ].join(" ")}
                  aria-pressed={avatar === a}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <Field
            label="Display name*"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
            success={ok}
          />

          <div className="flex-1" />
          <Button full variant="primary" disabled={!ok} loading={loading} onClick={finish}>
            Continue
          </Button>
          <HomeIndicator />
        </div>
      </div>
    </LightScreen>
  );
}
