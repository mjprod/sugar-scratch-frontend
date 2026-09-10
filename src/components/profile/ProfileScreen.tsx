import {
  Inbox,
  ChevronRight,
  FileText,
  Globe2,
  HelpCircle,
  Lock,
  LogOut,
  Pencil,
  Receipt,
  Settings,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { InboxUtilityBadge } from "@/components/InboxButton";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { SiteSocialLinks } from "@/components/site/SiteSocialLinks";
import { useMotion } from "@/features/collection/hooks/useMotion";

type ProfileView = "main" | "legal-terms" | "legal-privacy";

export function UserDashboardScreen({
  name,
  username,
  avatar,
  onLogout,
  onOpenChangePassword,
  onOpenEditProfile,
  onOpenFollowing,
  onOpenGameSettings,
  onOpenInbox,
  onOpenTransactionHistory,
  onOpenGameHistory,
  inboxUnreadCount = 0,
}: {
  name: string;
  username: string;
  avatar?: string | null;
  onLogout: () => void;
  onOpenChangePassword: () => void;
  onOpenEditProfile: () => void;
  onOpenFollowing?: () => void;
  onOpenGameSettings?: () => void;
  onOpenInbox?: () => void;
  onOpenTransactionHistory?: () => void;
  onOpenGameHistory?: () => void;
  inboxUnreadCount?: number;
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

  const handle = (username || name || "collector")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();

  function open(label: string) {
    if (label === "Change Password") {
      onOpenChangePassword();
      return;
    }
    if (label === "Following") {
      onOpenFollowing?.();
      return;
    }
    if (label === "Inbox") {
      onOpenInbox?.();
      return;
    }
    if (label === "Game Settings") {
      onOpenGameSettings?.();
      return;
    }
    if (label === "Transaction History") {
      onOpenTransactionHistory?.();
      return;
    }
    if (label === "Game History") {
      onOpenGameHistory?.();
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
    const legalKind = view === "legal-terms" ? "terms" : "privacy";
    return (
      <AppPageShell
        aria-label={
          legalKind === "terms" ? "Terms of Service" : "Privacy Policy"
        }
        className="app-page-shell--profile"
      >
        <div className="settings-legal-panel">
          <LegalDocPanel
            variant="page"
            kind={legalKind}
            titleId={legalTitleId}
            backLabel="Back to Settings"
            onBack={() => setView("main")}
          />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell aria-label="Profile" className="app-page-shell--profile">
      <h1 className="profile-settings-title">Settings</h1>

      <div className="profile-hero profile-card">
        <div className="profile-hero-row">
          <button
            type="button"
            className="profile-identity"
            onClick={onOpenEditProfile}
            aria-label="Edit profile"
          >
            <div className="profile-identity-avatar" aria-hidden="true">
              {avatar || "✨"}
            </div>
            <div className="profile-identity-copy">
              <p
                className="profile-display-name"
                title={name || "Collector"}
              >
                {name || "Collector"}
              </p>
              <p className="profile-username">@{handle || "collector"}</p>
              <span className="profile-edit-link">
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit Profile
              </span>
            </div>
          </button>

          <div className="profile-hero-divider" aria-hidden="true" />

          <div className="profile-hero-actions">
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
                "profile-action-btn profile-action-btn--tilt",
                tiltActive ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Smartphone className="size-5 shrink-0" aria-hidden="true" />
              <span className="profile-action-label">
                {tiltActive ? "Tilt on" : "Tilt off"}
              </span>
            </button>
            <span className="profile-action-sep" aria-hidden="true" />
            <button
              type="button"
              aria-label={loggingOut ? "Logging out" : "Log out"}
              onClick={handleLogout}
              disabled={loggingOut}
              aria-busy={loggingOut}
              className="profile-action-btn profile-action-btn--logout"
            >
              <LogOut className="size-5 shrink-0" aria-hidden="true" />
              <span className="profile-action-label">
                {loggingOut ? "Logging out" : "Log out"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="profile-menu-grid">
        <div className="profile-menu-stack">
          <MenuGroup
            title="History"
            items={[
              { label: "Transaction History", icon: Receipt },
              { label: "Game History", icon: Sparkles },
            ]}
            onOpen={open}
          />
          <MenuGroup
            title="Profile & Account"
            items={[
              { label: "Inbox", icon: Inbox, badgeCount: inboxUnreadCount },
              { label: "Following", icon: Users },
              { label: "Change Password", icon: Lock },
            ]}
            onOpen={open}
          />
        </div>
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
  items: { label: string; icon: LucideIcon; badgeCount?: number }[];
  onOpen: (label: string) => void;
}) {
  return (
    <div className="profile-menu-group">
      <h2 className="profile-menu-group-title">{title}</h2>
      <div className="profile-menu-group-card">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onOpen(item.label)}
              className={[
                "profile-menu-row",
                index ? "is-divided" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="profile-menu-icon">
                <Icon className="size-4 text-white/45" />
                {item.badgeCount != null ? (
                  <InboxUtilityBadge count={item.badgeCount} showZero />
                ) : null}
              </span>
              <span className="flex-1 text-[14px]">{item.label}</span>
              <ChevronRight className="size-4 text-white/30" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
