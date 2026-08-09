import { LightScreen } from "../components/PhoneShell";
import { BackButton, HomeIndicator } from "../components/ui";

const ROWS = [
  { label: "Replay tutorials", hint: "Home · Scratch · My Bag" },
  { label: "Redeem referral code", hint: "Optional creator rewards" },
  { label: "Notifications", hint: "Coming soon" },
  { label: "Privacy & terms", hint: "Legal" },
] as const;

export function SettingsScreen({
  onBack,
  onReplayTutorials,
}: {
  onBack: () => void;
  onReplayTutorials: () => void;
}) {
  return (
    <LightScreen>
      <div className="flex flex-1 flex-col px-6 pt-12">
        <BackButton onClick={onBack} />
        <h1 className="mt-8 font-display text-[34px] font-semibold tracking-[-0.02em]">
          Settings
        </h1>
        <p className="mt-2 text-[15px] text-ink-secondary">
          Account preferences and support.
        </p>

        <ul className="mt-8 flex flex-col gap-2">
          {ROWS.map((row) => (
            <li key={row.label}>
              <button
                type="button"
                onClick={row.label === "Replay tutorials" ? onReplayTutorials : undefined}
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface-raised px-4 py-3.5 text-left"
              >
                <span>
                  <span className="block text-[15px] font-medium">{row.label}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-tertiary">{row.hint}</span>
                </span>
                <span className="text-ink-tertiary">›</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex-1" />
        <HomeIndicator />
      </div>
    </LightScreen>
  );
}
