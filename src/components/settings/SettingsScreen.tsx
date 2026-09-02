import {
  Bell,
  ChevronRight,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import { SubpageHeader } from "@/components/SubpageHeader";
import { SECONDARY_SURFACES } from "@/lib/navigation";

type SettingsRow = {
  label: string;
  icon: LucideIcon;
  iconTone: "pref" | "notify";
  action: "replay" | "notifications";
  interactive: boolean;
};

/**
 * Settings — compact grouped utility surface (Sugar v8).
 */
export function SettingsScreen({
  onBack,
  onReplayTutorials,
}: {
  onBack: () => void;
  onReplayTutorials: () => void;
}) {
  const meta = SECONDARY_SURFACES.settings;

  const preferenceRows: SettingsRow[] = [
    {
      label: "Replay tutorials",
      icon: PlayCircle,
      iconTone: "pref",
      action: "replay",
      interactive: true,
    },
    {
      label: "Notifications",
      icon: Bell,
      iconTone: "notify",
      action: "notifications",
      interactive: false,
    },
  ];

  function handleRow(row: SettingsRow) {
    if (!row.interactive) return;
    if (row.action === "replay") {
      onReplayTutorials();
    }
  }

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Settings"
      className="settings-page"
    >
      <SubpageHeader
        title={meta.title}
        onBack={onBack}
        backLabel={meta.backLabel}
      />

      <div className="settings-stack">
        <SettingsGroup
          id="settings-preferences"
          label="Preferences"
          rows={preferenceRows}
          onSelect={handleRow}
        />
        <p className="settings-app-version">Sugar · v8</p>
      </div>
    </AppPageShell>
  );
}

function SettingsGroup({
  id,
  label,
  rows,
  onSelect,
}: {
  id: string;
  label: string;
  rows: SettingsRow[];
  onSelect: (row: SettingsRow) => void;
}) {
  return (
    <section className="settings-section" aria-labelledby={id}>
      <h2 id={id} className="settings-section-label">
        {label}
      </h2>
      <div className="settings-group-card">
        {rows.map((row) => (
          <SettingsRowButton key={row.label} row={row} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function SettingsRowButton({
  row,
  onSelect,
}: {
  row: SettingsRow;
  onSelect: (row: SettingsRow) => void;
}) {
  const Icon = row.icon;
  const className = ["settings-row", row.interactive ? "" : "is-static"]
    .filter(Boolean)
    .join(" ");

  if (!row.interactive) {
    return (
      <div className={className} aria-disabled="true">
        <span className={`settings-row-icon is-${row.iconTone}`} aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <span className="settings-row-title">{row.label}</span>
      </div>
    );
  }

  return (
    <button type="button" className={className} onClick={() => onSelect(row)}>
      <span className={`settings-row-icon is-${row.iconTone}`} aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <span className="settings-row-title">{row.label}</span>
      <ChevronRight className="settings-row-chevron" aria-hidden="true" />
    </button>
  );
}
