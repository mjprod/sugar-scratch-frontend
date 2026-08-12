import {
  Bell,
  ChevronRight,
  FileText,
  Lock,
  PlayCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { InboxButton } from "@/components/InboxButton";
import { MobileDiamondBalance } from "@/components/MobileDiamondBalance";
import { SubpageHeader } from "@/components/SubpageHeader";
import { SECONDARY_SURFACES } from "@/lib/navigation";

type SettingsView = "main" | "legal-terms" | "legal-privacy";

type SettingsRow = {
  label: string;
  icon: LucideIcon;
  iconTone: "security" | "pref" | "notify" | "legal";
  action: "password" | "replay" | "notifications" | "privacy" | "terms";
  interactive: boolean;
};

/**
 * Settings — compact grouped utility surface (Sugar v8).
 */
export function SettingsScreen({
  onBack,
  onReplayTutorials,
  onOpenChangePassword,
  diamonds,
  onOpenInbox,
  inboxUnreadCount = 0,
}: {
  onBack: () => void;
  onReplayTutorials: () => void;
  onOpenChangePassword: () => void;
  diamonds?: number | null;
  onOpenInbox?: () => void;
  inboxUnreadCount?: number;
}) {
  const meta = SECONDARY_SURFACES.settings;
  const legalTitleId = useId();
  const [view, setView] = useState<SettingsView>("main");

  const accountRows: SettingsRow[] = [
    {
      label: "Change Password",
      icon: Lock,
      iconTone: "security",
      action: "password",
      interactive: true,
    },
  ];

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

  const legalRows: SettingsRow[] = [
    {
      label: "Privacy Policy",
      icon: ShieldCheck,
      iconTone: "legal",
      action: "privacy",
      interactive: true,
    },
    {
      label: "Terms and Conditions",
      icon: FileText,
      iconTone: "legal",
      action: "terms",
      interactive: true,
    },
  ];

  function handleRow(row: SettingsRow) {
    if (!row.interactive) return;
    if (row.action === "replay") {
      onReplayTutorials();
      return;
    }
    if (row.action === "password") {
      onOpenChangePassword();
      return;
    }
    if (row.action === "privacy") {
      setView("legal-privacy");
      return;
    }
    if (row.action === "terms") {
      setView("legal-terms");
    }
  }

  if (view === "legal-terms" || view === "legal-privacy") {
    return (
      <AppPageShell
        variant="secondary"
        aria-label="Settings"
        className="settings-page"
      >
        <div className="settings-legal-panel">
          <LegalDocPanel
            kind={view === "legal-terms" ? "terms" : "privacy"}
            titleId={legalTitleId}
            onBack={() => setView("main")}
          />
        </div>
      </AppPageShell>
    );
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
        trailing={
          <div className="flex items-center gap-2">
            {diamonds !== undefined ? (
              <MobileDiamondBalance balance={diamonds} standalone />
            ) : null}
            {onOpenInbox ? (
              <InboxButton
                unreadCount={inboxUnreadCount}
                onOpen={onOpenInbox}
              />
            ) : null}
          </div>
        }
      />

      <div className="settings-stack">
        <SettingsGroup
          id="settings-account"
          label="Account"
          rows={accountRows}
          onSelect={handleRow}
        />
        <SettingsGroup
          id="settings-preferences"
          label="Preferences"
          rows={preferenceRows}
          onSelect={handleRow}
        />
        <SettingsGroup
          id="settings-legal"
          label="Legal"
          rows={legalRows}
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
  const className = [
    "settings-row",
    row.interactive ? "" : "is-static",
  ]
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
