import {
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Globe2,
  HelpCircle,
  Lock,
  LogOut,
  Settings,
  Smartphone,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { SiteSocialLinks } from "@/components/site/SiteSocialLinks";
import { useMotion } from "@/features/collection/hooks/useMotion";

type ProfileView = "main" | "legal-terms" | "legal-privacy";

export function UserDashboardScreen({
  name,
  avatar,
  onLogout,
  onOpenChangePassword,
  onOpenFollowing,
  onOpenGameSettings,
}: {
  name: string;
  avatar?: string | null;
  onLogout: () => void;
  onOpenChangePassword: () => void;
  onOpenFollowing?: () => void;
  onOpenGameSettings?: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<ProfileView>("main");
  const legalTitleId = useId();
  const {
    enabled: motionEnabled,
    permission: motionPermission,
    supported: motionSupported,
    toggleEnabled: toggleMotionEnabled,
  } = useMotion();
  const tiltActive = motionEnabled && motionPermission === "granted";
  const tiltLabel = !motionSupported
    ? "Motion not supported"
    : motionPermission === "denied"
      ? "Motion permission denied"
      : tiltActive
        ? "Disable phone tilt"
        : "Enable phone tilt";

  function open(label: string) {
    if (label === "Change Password") {
      onOpenChangePassword();
      return;
    }
    if (label === "Following") {
      onOpenFollowing?.();
      return;
    }
    if (label === "Game Settings") {
      onOpenGameSettings?.();
      return;
    }
    if (label === "Privacy Policy") {
      setView("legal-privacy");
      return;
    }
    if (label === "Terms of Service") {
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
            <h1
              className="profile-display-name truncate text-[30px] font-bold tracking-[-0.03em]"
              title={name || "Collector"}
            >
              {name || "Collector"}
            </h1>
            <p className="text-[13px] text-white/45">
              @{(name || "collector").toLowerCase()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label={tiltLabel}
              title={tiltLabel}
              aria-pressed={tiltActive}
              disabled={!motionSupported}
              onClick={() => {
                void toggleMotionEnabled();
              }}
              className={[
                "profile-logout-btn grid size-11 place-items-center rounded-full border bg-white/[0.05] disabled:opacity-50",
                tiltActive
                  ? "border-[oklch(0.798_0.104_207.84_/_0.55)] text-[oklch(0.963_0.028_216.4)]"
                  : "border-white/10 text-white/65",
              ].join(" ")}
            >
              <Smartphone className="size-5 shrink-0" />
              <span className="profile-logout-label">
                {tiltActive ? "Tilt on" : "Tilt off"}
              </span>
            </button>
            <button
              type="button"
              aria-label={loggingOut ? "Logging out" : "Log out"}
              onClick={handleLogout}
              disabled={loggingOut}
              aria-busy={loggingOut}
              className="profile-logout-btn grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 disabled:opacity-50"
            >
              <LogOut className="size-5 shrink-0 text-[oklch(0.711_0.166_22.22)]" />
              <span className="profile-logout-label">
                {loggingOut ? "Logging out" : "Log out"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <MenuGroup
          title="Profile & Account"
          items={[
            { label: "Purchase History", icon: CreditCard },
            { label: "Following", icon: Users },
            { label: "Notifications", icon: Bell },
            { label: "Change Password", icon: Lock },
          ]}
          onOpen={open}
        />
        <MenuGroup
          title="Preferences & Support"
          items={[
            { label: "Language", icon: Globe2 },
            { label: "Game Settings", icon: Settings },
            { label: "Help Centre", icon: HelpCircle },
            { label: "Privacy Policy", icon: ShieldCheck },
            { label: "Terms of Service", icon: FileText },
          ]}
          onOpen={open}
        />
      </div>

      <footer className="profile-site-footer" aria-label="Site">
        <SiteSocialLinks />
        <p className="home-site-footer-copy">© 2026 Sugar Scratch</p>
      </footer>

      {notice ? (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-[13px] backdrop-blur-md">
          {notice}
        </div>
      ) : null}
    </AppPageShell>
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
