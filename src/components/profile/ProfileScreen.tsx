import {
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Globe2,
  HelpCircle,
  Lock,
  LogOut,
  ShieldCheck,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { DiamondLottie } from "@/components/ui/DiamondLottie";

type ProfileView = "main" | "legal-terms" | "legal-privacy";

export function UserDashboardScreen({
  name,
  avatar,
  coins,
  diamonds,
  onLogout,
  onOpenChangePassword,
}: {
  name: string;
  avatar?: string | null;
  coins: number;
  diamonds: number;
  onLogout: () => void;
  onOpenChangePassword: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<ProfileView>("main");
  const legalTitleId = useId();

  function open(label: string) {
    if (label === "Change Password") {
      onOpenChangePassword();
      return;
    }
    if (label === "Privacy Policy") {
      setView("legal-privacy");
      return;
    }
    if (label === "Terms and Conditions") {
      setView("legal-terms");
      return;
    }
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

  if (view === "legal-terms" || view === "legal-privacy") {
    return (
      <AppPageShell aria-label="Profile" className="app-page-shell--profile">
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
    <AppPageShell aria-label="Profile" className="app-page-shell--profile">
      <div className="rounded-[32px] border border-white/[0.08] bg-[radial-gradient(circle_at_90%_0%,oklch(0.606_0.219_292.72_/_0.3),transparent_42%),oklch(0.196_0_0)] p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="grid size-20 place-items-center rounded-full border border-white/15 bg-gradient-to-br from-[oklch(0.627_0.233_303.9)] to-[oklch(0.359_0.135_278.7)] text-[30px] shadow-glow">
            {avatar || "✨"}
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-full border border-[oklch(0.767_0.139_91.06)]/35 bg-[oklch(0.767_0.139_91.06)]/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[oklch(0.767_0.139_91.06)] uppercase">
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
            aria-label={loggingOut ? "Logging out" : "Log out"}
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 disabled:opacity-50"
          >
            <LogOut className="size-5 text-[oklch(0.711_0.166_22.22)]" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Trophy className="size-4" />} label="My Collection" value="128 / 240" />
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
            { label: "Change Password", icon: Lock },
          ]}
          onOpen={open}
        />
        <MenuGroup
          title="Preferences & Support"
          items={[
            { label: "Language", icon: Globe2 },
            { label: "Help Centre", icon: HelpCircle },
            { label: "Privacy Policy", icon: ShieldCheck },
            { label: "Terms and Conditions", icon: FileText },
          ]}
          onOpen={open}
        />
      </div>

      <div className="mt-10 flex flex-col gap-4">
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
      <div className="flex items-center gap-2 text-[oklch(0.709_0.159_293.54)]">
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
  items: { label: string; icon: LucideIcon }[];
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
