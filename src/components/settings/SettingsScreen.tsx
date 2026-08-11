import {
  Bell,
  ChevronRight,
  Gift,
  PlayCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import { InboxButton } from "@/components/InboxButton";
import { MobileDiamondBalance } from "@/components/MobileDiamondBalance";
import { SubpageHeader } from "@/components/SubpageHeader";
import { SECONDARY_SURFACES } from "@/lib/navigation";

const ROWS: {
  label: string;
  hint: string;
  icon: LucideIcon;
  action?: "replay";
}[] = [
  {
    label: "Replay tutorials",
    hint: "Home · Scratch · My Bag",
    icon: PlayCircle,
    action: "replay",
  },
  {
    label: "Redeem referral code",
    hint: "Optional creator rewards",
    icon: Gift,
  },
  {
    label: "Notifications",
    hint: "Coming soon",
    icon: Bell,
  },
  {
    label: "Privacy & terms",
    hint: "Legal",
    icon: ShieldCheck,
  },
];

export function SettingsScreen({
  onBack,
  onReplayTutorials,
  diamonds,
  onOpenInbox,
  inboxUnreadCount = 0,
}: {
  onBack: () => void;
  onReplayTutorials: () => void;
  diamonds?: number | null;
  onOpenInbox?: () => void;
  inboxUnreadCount?: number;
}) {
  const meta = SECONDARY_SURFACES.settings;

  return (
    <AppPageShell variant="secondary" aria-label="Settings">
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

      <div className="mt-6 rounded-[32px] border border-white/[0.08] bg-[radial-gradient(circle_at_90%_0%,rgba(139,92,246,.28),transparent_42%),#151515] p-6 sm:p-8">
        <p className="text-[12px] font-semibold tracking-[0.14em] text-white/45 uppercase">
          Account
        </p>
        <h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em]">Settings</h2>
        <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/55">
          Account preferences and support.
        </p>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-[12px] font-semibold tracking-[0.12em] text-white/40 uppercase">
          Preferences & Support
        </h3>
        <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03]">
          {ROWS.map((row, index) => {
            const Icon = row.icon;
            return (
              <button
                key={row.label}
                type="button"
                onClick={
                  row.action === "replay" ? onReplayTutorials : undefined
                }
                className={[
                  "flex min-h-14 w-full items-center gap-3 px-4 text-left transition hover:bg-white/[0.05]",
                  index ? "border-t border-white/[0.06]" : "",
                ].join(" ")}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-white/55">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-white">
                    {row.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-white/40">
                    {row.hint}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-white/30" />
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-10 text-center text-[12px] font-medium text-white/35">
        App · v8
      </p>
    </AppPageShell>
  );
}
