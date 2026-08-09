import { useMemo, useState } from "react";
import { LightScreen } from "../components/PhoneShell";
import {
  BackButton,
  Button,
  Chip,
  Field,
  HomeIndicator,
  ProgressBar,
} from "../components/ui";
import { suggestUsernames, TAKEN_USERNAMES } from "../flow/types";

export function CreateUsernameScreen({
  seedEmail,
  onContinue,
  onBack,
}: {
  seedEmail: string;
  onContinue: (data: { username: string }) => void;
  onBack: () => void;
}) {
  const suggestions = useMemo(
    () => suggestUsernames(seedEmail.split("@")[0] || "alexsmi"),
    [seedEmail],
  );
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTakenHints, setShowTakenHints] = useState(false);

  const trimmed = username.trim().toLowerCase();
  const tooShort = trimmed.length > 0 && trimmed.length < 4;
  const invalidChars = trimmed.length > 0 && !/^[a-z0-9_]+$/.test(trimmed);
  const taken = TAKEN_USERNAMES.has(trimmed);
  const available =
    trimmed.length >= 4 &&
    trimmed.length <= 20 &&
    /^[a-z0-9_]+$/.test(trimmed) &&
    !taken;

  async function confirm() {
    if (!available) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    onContinue({ username: trimmed });
  }

  return (
    <LightScreen>
      <div className="flex flex-1 flex-col px-6 pt-12">
        <BackButton onClick={onBack} />
        <div className="mt-5">
          <ProgressBar step={3} total={3} />
        </div>

        <h1 className="mt-10 font-display text-[34px] leading-[1.1] font-semibold tracking-[-0.02em]">
          Create your username
        </h1>
        <p className="mt-2 text-[15px] text-ink-secondary">
          Pick a unique public name. You can change this later.
        </p>

        <div className="mt-7 flex flex-1 flex-col gap-4">
          <Field
            label="Username*"
            value={username}
            onChange={(e) => {
              const next = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
              setUsername(next);
              setShowTakenHints(TAKEN_USERNAMES.has(next.trim().toLowerCase()));
            }}
            success={available}
            error={
              tooShort
                ? "Username must be at least 4 characters."
                : invalidChars
                  ? "Only letters, numbers, and underscores."
                  : taken
                    ? "Username already taken. Try a suggestion."
                    : undefined
            }
          />

          {(showTakenHints || taken || trimmed.length === 0) && (
            <div>
              <p className="mb-2 text-[12px] font-medium text-ink-tertiary">Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Chip
                    key={s}
                    selected={trimmed === s}
                    onClick={() => {
                      setUsername(s);
                      setShowTakenHints(false);
                    }}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1" />
          <Button
            full
            variant="primary"
            disabled={!available}
            loading={loading}
            onClick={confirm}
          >
            Continue
          </Button>
          <HomeIndicator />
        </div>
      </div>
    </LightScreen>
  );
}
