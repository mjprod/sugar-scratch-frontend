import {
  Inbox,
  ChevronRight,
	  FileText,
	  Film,
	  Globe2,
  HelpCircle,
  Lock,
  LogOut,
  Pencil,
  Receipt,
  Settings,
  SlidersHorizontal,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { InboxUtilityBadge } from "@/components/InboxButton";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
	import { HdVideoWarning } from "@/components/profile/HdVideoWarning";
	import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { SiteLegalLinks } from "@/components/site/SiteLegalLinks";
import { SiteSocialLinks } from "@/components/site/SiteSocialLinks";
import { ConvertDustIcon } from "@/components/WalletBalancesPopover";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
	import { useMotion } from "@/features/collection/hooks/useMotion";
	import {
	  getHdVideoEnabled,
	  setHdVideoEnabled,
	} from "@/services/videoQualityPrefs";
import { formatBalance } from "@/lib/formatBalance";
import {
  bestAffordableCoinExchange,
  formatExchangeDiamondAmount,
  type CoinExchangeOption,
} from "@/services/store";

type ProfileView = "main" | "legal-terms" | "legal-privacy";

export function UserDashboardScreen({
  name,
  username,
  avatar,
  coins = 0,
  diamonds = 0,
  onLogout,
  onOpenChangePassword,
  onOpenEditProfile,
  onOpenFollowing,
  onOpenGameSettings,
  onOpenContentPreferences,
  onOpenInbox,
  onBuyMoreDiamonds,
  onConvertDust,
  onOpenTransactionHistory,
  onOpenGameHistory,
  inboxUnreadCount = 0,
}: {
  name: string;
  username: string;
  avatar?: string | null;
  coins?: number;
  diamonds?: number;
  onLogout: () => void;
  onOpenChangePassword: () => void;
  onOpenEditProfile: () => void;
  onOpenFollowing?: () => void;
  onOpenGameSettings?: () => void;
  onOpenContentPreferences?: () => void;
  onOpenInbox?: () => void;
  onBuyMoreDiamonds?: () => void;
  onConvertDust?: (
    option: CoinExchangeOption,
  ) => boolean | Promise<boolean>;
  onOpenTransactionHistory?: () => void;
  onOpenGameHistory?: () => void;
  inboxUnreadCount?: number;
}) {
  const [notice, setNotice] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [converting, setConverting] = useState(false);
  const [previewExchange, setPreviewExchange] = useState(false);
  const [view, setView] = useState<ProfileView>("main");
  const affordable = useMemo(
    () => bestAffordableCoinExchange(coins),
    [coins],
  );
  const canConvert = Boolean(onConvertDust && affordable && !converting);
  const previewAmount = affordable
    ? formatExchangeDiamondAmount(affordable.diamonds)
    : null;
  const showPreview = previewExchange && Boolean(previewAmount) && !converting;
  const legalTitleId = useId();
  const {
    enabled: motionEnabled,
    permission: motionPermission,
    supported: motionSupported,
    toggleEnabled: toggleMotionEnabled,
  } = useMotion();
	  const tiltActive = motionEnabled && motionPermission === "granted";
	  const [hdVideo, setHdVideo] = useState(() => getHdVideoEnabled());
	  const [hdWarning, setHdWarning] = useState(false);
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
    .toLowerCase()
    .replace(/\s+/g, "");

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
    if (label === "Content Preferences") {
      onOpenContentPreferences?.();
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
              <ProfileAvatar value={avatar} />
            </div>
            <div className="profile-identity-copy">
              <p
                className="profile-display-name"
                title={name || "Collector"}
              >
                {name || "Collector"}
              </p>
              <p className="profile-username">{`@${handle || "collector"}`}</p>
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
		                {tiltActive ? "Tilt ON" : "Tilt OFF"}
		              </span>
	            </button>
	            <button
	              type="button"
	              aria-label={hdVideo ? "Disable HD videos" : "Enable HD videos"}
	              title={hdVideo ? "Disable HD videos" : "Enable HD videos"}
	              aria-pressed={hdVideo}
	              onClick={() => {
	                const next = !hdVideo;
	                setHdVideoEnabled(next);
	                setHdVideo(next);
	                if (next) setHdWarning(true);
	              }}
	              className={[
	                "profile-action-btn profile-action-btn--hd",
	                hdVideo ? "is-active" : "",
	              ]
	                .filter(Boolean)
	                .join(" ")}
	            >
	              <Film className="size-5 shrink-0" aria-hidden="true" />
		              <span className="profile-action-label">
		                {hdVideo ? "HD ON" : "HD OFF"}
		              </span>
		            </button>
          </div>
        </div>
	      </div>
	
	      {hdWarning ? (
	        <HdVideoWarning onDismiss={() => setHdWarning(false)} />
	      ) : null}
	
	      <div className="profile-menu-grid">
        <div className="profile-menu-stack">
          <div className="profile-menu-group">
            <h2 className="profile-menu-group-title">Your Balance</h2>
            <div className="profile-menu-group-card">
              <div className="profile-menu-row profile-balance-row">
                <span className="profile-menu-icon">
                  <DiamondLottie
                    className="top-nav-resource-icon top-nav-resource-icon--diamond shrink-0"
                    size={14}
                    aria-hidden
                  />
                </span>
                <span className="profile-balance-copy">
                  <span className="profile-balance-value">
                    {formatBalance(diamonds)}
                  </span>
                  <span className="profile-balance-label">Diamond Balance</span>
                </span>
              </div>
              <div
                className={[
                  "profile-menu-row profile-balance-row is-divided",
                  showPreview ? "is-exchange-preview" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="profile-menu-icon">
                  {showPreview ? (
                    <DiamondLottie
                      className="top-nav-resource-icon top-nav-resource-icon--diamond shrink-0"
                      size={14}
                      animated
                      loop
                      autoplay
                      aria-hidden
                    />
                  ) : (
                    <CoinLottie
                      className="top-nav-resource-icon top-nav-resource-icon--coin shrink-0"
                      size={16}
                      loop={false}
                      autoplay={false}
                      aria-hidden
                    />
                  )}
                </span>
                <span className="profile-balance-copy">
                  <span
                    className={[
                      "profile-balance-value",
                      showPreview ? "is-exchange-preview" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-live="polite"
                  >
                    {showPreview && previewAmount
                      ? previewAmount
                      : formatBalance(coins)}
                  </span>
                  <span className="profile-balance-label">
                    {showPreview ? "Convert?" : "Coin Balance"}
                  </span>
                </span>
                {onConvertDust ? (
                  <button
                    type="button"
                    className={[
                      "wallet-balances-popover__convert",
                      "profile-balance-convert",
                      canConvert ? "" : "is-disabled",
                      converting ? "is-busy" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={
                      affordable
                        ? `Convert ${affordable.coins} Coins for +${formatExchangeDiamondAmount(affordable.diamonds)} Diamonds`
                        : "Not enough Coins to convert"
                    }
                    disabled={!canConvert}
                    onPointerEnter={() => {
                      if (affordable) setPreviewExchange(true);
                    }}
                    onPointerLeave={() => setPreviewExchange(false)}
                    onPointerDown={() => {
                      if (affordable) setPreviewExchange(true);
                    }}
                    onPointerUp={() => setPreviewExchange(false)}
                    onPointerCancel={() => setPreviewExchange(false)}
                    onClick={() => {
                      if (!onConvertDust || !affordable || converting) return;
                      setPreviewExchange(false);
                      setConverting(true);
                      void Promise.resolve(onConvertDust(affordable)).finally(
                        () => setConverting(false),
                      );
                    }}
                  >
                    <ConvertDustIcon className="wallet-balances-popover__convert-icon" />
                  </button>
                ) : null}
              </div>
              {onBuyMoreDiamonds ? (
                <div className="profile-balance-cta">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("squircleCTA")}
                    fillParent
                    type="button"
                    leadingIcon={
                      <DiamondLottie
                        className="top-nav-resource-icon top-nav-resource-icon--diamond shrink-0"
                        size={14}
                        animated
                        loop
                        autoplay
                        aria-hidden
                      />
                    }
                    label="Get Diamonds"
                    costAmount={null}
                    strokeWidth={1}
                    onClick={onBuyMoreDiamonds}
                  />
                </div>
              ) : null}
            </div>
          </div>
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
            { label: "Language", icon: Globe2, soon: true },
            { label: "Game Settings", icon: Settings },
            { label: "Content Preferences", icon: SlidersHorizontal },
            { label: "Help Centre", icon: HelpCircle, soon: true },
            { label: "Privacy Policy", icon: ShieldCheck },
            { label: "Terms of Service", icon: FileText },
          ]}
          onOpen={open}
        />
      </div>

      <button
        type="button"
        className="profile-logout-link"
        aria-label={loggingOut ? "Logging out" : "Log out"}
        onClick={handleLogout}
        disabled={loggingOut}
        aria-busy={loggingOut}
      >
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        {loggingOut ? "Logging out" : "Log out"}
      </button>

      <footer className="profile-site-footer" aria-label="Site">
        <p className="home-site-footer-tagline">
          <span className="is-pink">Real Creators.</span> Real Moments.
        </p>
        <SiteLegalLinks
          onPrivacy={() => setView("legal-privacy")}
          onTerms={() => setView("legal-terms")}
        />
        <SiteSocialLinks />
        <p className="home-site-footer-copy">© 2026 Sugar Scratch</p>
      </footer>

      {notice ? (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-caption backdrop-blur-md">
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
  items: {
    label: string;
    icon: LucideIcon;
    badgeCount?: number;
    soon?: boolean;
  }[];
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
              disabled={item.soon}
              onClick={() => {
                if (item.soon) return;
                onOpen(item.label);
              }}
              className={[
                "profile-menu-row",
                index ? "is-divided" : "",
                item.soon ? "is-soon" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="profile-menu-icon">
                <Icon className="size-4 text-white/45" />
                {item.badgeCount != null ? (
                  <InboxUtilityBadge count={item.badgeCount} />
                ) : null}
              </span>
              <span className="flex-1 text-title">{item.label}</span>
              {item.soon ? (
                <span className="profile-menu-soon">Soon</span>
              ) : (
                <ChevronRight className="size-4 text-white/30" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
