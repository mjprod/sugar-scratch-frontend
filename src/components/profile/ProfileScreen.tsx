import {
  Bell,
  ChevronRight,
  CreditCard,
  Globe2,
  HelpCircle,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { DiamondLottie } from "@/components/ui/DiamondLottie";

export function UserDashboardScreen({
  name,
  avatar,
  coins,
  diamonds,
  onSettings,
  onLogout,
}: {
  name: string;
  avatar?: string | null;
  coins: number;
  diamonds: number;
  onSettings: () => void;
  onLogout: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  function open(label: string) {
    setNotice(`${label} opened in prototype`);
    window.setTimeout(() => setNotice(""), 1800);
  }

  function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      onLogout();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <AppPageShell aria-label="Profile" className="app-page-shell--profile">
      <div className="rounded-[32px] border border-white/[0.08] bg-[radial-gradient(circle_at_90%_0%,rgba(139,92,246,.3),transparent_42%),#151515] p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="grid size-20 place-items-center rounded-full border border-white/15 bg-gradient-to-br from-[#A855F7] to-[#312E81] text-[30px] shadow-glow">
            {avatar || "✨"}
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#D4AF37] uppercase">
              Gold Member
            </span>
            <h1 className="mt-2 truncate text-[30px] font-bold tracking-[-0.03em]">
              {name || "Collector"}
            </h1>
            <p className="text-[13px] text-white/45">
              @{(name || "collector").toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            aria-label="Open Settings"
            onClick={onSettings}
            className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/65"
          >
            <Settings className="size-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Trophy className="size-4" />} label="Collection" value="128 / 240" />
        <Stat icon={<Sparkles className="size-4" />} label="Packs opened" value="46" />
        <Stat icon={<DiamondLottie size={16} aria-hidden />} label="Diamonds" value={diamonds.toString()} />
        <Stat icon={<Sparkles className="size-4" />} label="Sugar Coins" value={coins.toString()} />
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <MenuGroup
          title="Profile & Account"
          items={[
            { label: "Purchase History", icon: CreditCard },
            { label: "Saved Packs", icon: Sparkles },
            { label: "Notifications", icon: Bell },
          ]}
          onOpen={open}
        />
        <MenuGroup
          title="Preferences & Support"
          items={[
            { label: "Language", icon: Globe2 },
            { label: "Help Centre", icon: HelpCircle },
            { label: "Privacy & Legal", icon: ShieldCheck },
          ]}
          onOpen={open}
        />
      </div>

      <div className="mt-10 flex flex-col gap-4">
        <button
          type="button"
          className="settings-logout-btn"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-busy={loggingOut}
        >
          <LogOut className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          {loggingOut ? "Logging Out..." : "Log Out"}
        </button>
        <p className="settings-app-version">App · v8</p>
      </div>

      {notice ? (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-[13px] backdrop-blur-md">
          {notice}
        </div>
      ) : null}
    </AppPageShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-[#A78BFA]">
        {icon}
        <p className="text-[11px] text-white/45">{label}</p>
      </div>
      <p className="mt-3 text-[19px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MenuGroup({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: { label: string; icon: typeof Settings }[];
  onOpen: (label: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-[12px] font-semibold tracking-[0.12em] text-white/40 uppercase">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03]">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onOpen(item.label)}
              className={[
                "flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-white/[0.05]",
                index ? "border-t border-white/[0.06]" : "",
              ].join(" ")}
            >
              <Icon className="size-4 text-white/45" />
              <span className="flex-1 text-[14px]">{item.label}</span>
              <ChevronRight className="size-4 text-white/30" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
