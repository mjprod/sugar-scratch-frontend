import { useState } from "react";
import { LightScreen } from "../components/PhoneShell";
import { BackButton, Button, HomeIndicator, SelectRow } from "../components/ui";
import { GENDER_OPTIONS, type GenderInterest } from "../flow/types";

export function PreferenceGenderScreen({
  username,
  onContinue,
  onBack,
  onSkip,
}: {
  username: string;
  onContinue: (gender: GenderInterest) => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<GenderInterest | null>(null);

  return (
    <LightScreen>
      <div className="flex flex-1 flex-col px-6 pt-12">
        <div className="flex items-center justify-between">
          <BackButton onClick={onBack} />
          <button
            type="button"
            onClick={onSkip}
            className="text-[14px] font-semibold text-ink-tertiary"
          >
            Skip
          </button>
        </div>

        <p className="mt-8 text-[14px] text-ink-secondary">
          Hey {username || "there"}
        </p>
        <h1 className="mt-1 font-display text-[34px] leading-[1.1] font-semibold tracking-[-0.02em]">
          Who do you want to collect?
        </h1>
        <p className="mt-3 text-[15px] text-ink-secondary">
          Pick a preferred creator category so we can personalise recommendations.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {GENDER_OPTIONS.map((opt) => (
            <SelectRow
              key={opt.id}
              selected={selected === opt.id}
              onClick={() => setSelected(opt.id)}
            >
              {opt.label}
            </SelectRow>
          ))}
        </div>

        <div className="flex-1" />
        <Button
          full
          variant="primary"
          disabled={!selected}
          onClick={() => selected && onContinue(selected)}
        >
          Continue
        </Button>
        <HomeIndicator />
      </div>
    </LightScreen>
  );
}
