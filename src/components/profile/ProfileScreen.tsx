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
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useState, type ComponentType } from "react";
import CountUp from "@/pages/lp-build/CountUp.jsx";
import { AppPageShell } from "@/components/AppPageShell";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { InboxUtilityBadge } from "@/components/InboxButton";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
	import { HdVideoWarning } from "@/components/profile/HdVideoWarning";
	import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { HomeSiteFooter } from "@/components/home/HomeSiteFooter";
import { ConvertDustIcon } from "@/components/WalletBalancesPopover";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
	import { useMotion } from "@/features/collection/hooks/useMotion";
	import {
	  getHdVideoEnabled,
	  setHdVideoEnabled,
	} from "@/services/videoQualityPrefs";
import { useConvertPress } from "@/hooks/useConvertPress";
import { usePageScrollActive } from "@/hooks/usePageScrollActive";
import { formatBalance } from "@/lib/formatBalance";
import {
  bestAffordableCoinExchange,
  formatExchangeDiamondAmount,
  minimumCoinExchange,
  type CoinExchangeOption,
} from "@/services/store";

type ProfileView = "main" | "legal-terms" | "legal-privacy";

const SETTINGS_ROW_KEY = "settings-menu-row";

function rememberSettingsRow(label: string) {
  try {
    sessionStorage.setItem(SETTINGS_ROW_KEY, label);
  } catch {
    /* private mode */
  }
}

function peekSettingsRow(): string | null {
  try {
    return sessionStorage.getItem(SETTINGS_ROW_KEY);
  } catch {
    return null;
  }
}

function clearSettingsRow() {
  try {
    sessionStorage.removeItem(SETTINGS_ROW_KEY);
  } catch {
    /* private mode */
  }
}

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
  onOpenHelp,
  onOpenDeleteAccount,
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
  onOpenHelp?: () => void;
  onOpenDeleteAccount?: () => void;
  inboxUnreadCount?: number;
}) {
  const [notice, setNotice] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [converting, setConverting] = useState(false);
  const [roll, setRoll] = useState<{
    fromCoins: number;
    toCoins: number;
    fromDiamonds: number;
    toDiamonds: number;
  } | null>(null);
  /** Arms coin↔diamond icon swap so the first mount does not play the settle. */
  const [iconSwapReady, setIconSwapReady] = useState(false);
  const [view, setView] = useState<ProfileView>("main");
  const affordable = useMemo(
    () => bestAffordableCoinExchange(coins),
    [coins],
  );
  const previewOption = affordable ?? minimumCoinExchange();
  const previewDenied = !affordable;
  const canPreview = Boolean(onConvertDust && !converting && !roll);
  const canConvert = Boolean(onConvertDust && affordable && !converting && !roll);
  const runConvert = () => {
    if (!onConvertDust || !affordable) return;
    const option = affordable;
    const fromCoins = coins;
    const fromDiamonds = diamonds;
    setConverting(true);
    void Promise.resolve(onConvertDust(option)).then((ok) => {
      if (!ok) {
        setConverting(false);
        return;
      }
      setRoll({
        fromCoins,
        toCoins: fromCoins - option.coins,
        fromDiamonds,
        toDiamonds: fromDiamonds + option.diamonds,
      });
    });
  };
  const {
    preview: previewExchange,
    confirmPreview,
    convertButtonProps,
  } = useConvertPress(canPreview, runConvert, canConvert);
  const previewAmount = formatExchangeDiamondAmount(
    previewOption.diamonds,
    previewDenied ? "denied" : "gain",
  );
  const showPreview = previewExchange && !converting && !roll;
  useEffect(() => {
    if (showPreview) setIconSwapReady(true);
  }, [showPreview]);
  const convertAria = previewDenied
    ? `Not enough Coins to convert — need ${previewOption.coins} for ${formatExchangeDiamondAmount(previewOption.diamonds, "denied")} Diamonds`
    : showPreview
      ? `Confirm convert ${previewOption.coins} Coins for ${formatExchangeDiamondAmount(previewOption.diamonds)} Diamonds`
      : `Convert ${previewOption.coins} Coins for ${formatExchangeDiamondAmount(previewOption.diamonds)} Diamonds`;
  const legalTitleId = useId();
  const {
    enabled: motionEnabled,
    permission: motionPermission,
    supported: motionSupported,
    toggleEnabled: toggleMotionEnabled,
  } = useMotion();
	  const tiltActive = motionEnabled && motionPermission === "granted";
  const pageScrolling = usePageScrollActive();
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

  useEffect(() => {
    if (view !== "main") return;
    // Peek (don't consume) until the row is on screen — StrictMode re-runs
    // this effect and would drop the label before the surviving mount paints.
    let frames = 0;
    let raf = 0;
    const tryScroll = () => {
      const label = peekSettingsRow();
      if (!label) return;
      const row = document.querySelector<HTMLElement>(
        `[data-settings-row="${CSS.escape(label)}"]`,
      );
      if (!row) {
        if (frames++ < 24) raf = window.requestAnimationFrame(tryScroll);
        return;
      }
      clearSettingsRow();
      const scroller = row.closest<HTMLElement>("[data-page-scroll]");
      if (scroller) {
        const rowBox = row.getBoundingClientRect();
        const scrollerBox = scroller.getBoundingClientRect();
        scroller.scrollTop +=
          rowBox.top -
          scrollerBox.top -
          scroller.clientHeight / 2 +
          rowBox.height / 2;
      } else {
        row.scrollIntoView({ block: "center", behavior: "auto" });
      }
    };
    raf = window.requestAnimationFrame(tryScroll);
    return () => window.cancelAnimationFrame(raf);
  }, [view]);

  function open(label: string) {
    rememberSettingsRow(label);
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
    if (label === "Help Centre") {
      onOpenHelp?.();
      return;
    }
    if (label === "Delete account") {
      onOpenDeleteAccount?.();
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
              role="switch"
              aria-label={tiltLabel}
              title={tiltLabel}
              aria-checked={tiltActive}
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
	              role="switch"
	              aria-label={hdVideo ? "Disable HD videos" : "Enable HD videos"}
	              title={hdVideo ? "Disable HD videos" : "Enable HD videos"}
	              aria-checked={hdVideo}
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
                  <span
                    className={[
                      "profile-balance-value",
                      roll ? "is-rolling" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {roll ? (
                      <CountUp
                        from={roll.fromDiamonds}
                        to={roll.toDiamonds}
                        mode="roll"
                        easing="easeOut"
                        format="standard"
                        separator=","
                        trigger="load"
                        duration={0.5}
                        onEnd={() => {
                          setRoll(null);
                          setConverting(false);
                        }}
                      />
                    ) : (
                      formatBalance(diamonds)
                    )}
                  </span>
                  <span className="profile-balance-label">Diamond Balance</span>
                </span>
              </div>
              <div
                className={[
                  "profile-menu-row profile-balance-row is-divided",
                  showPreview ? "is-exchange-preview" : "",
                  showPreview && previewDenied ? "is-exchange-denied" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span
                  className={[
                    "profile-menu-icon",
                    "exchange-icon-stage",
                    iconSwapReady ? "is-swap-ready" : "",
                    showPreview ? "is-preview" : "is-idle",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                >
                  <span className="exchange-icon-face exchange-icon-face--coin">
                    <CoinLottie
                      className="top-nav-resource-icon top-nav-resource-icon--coin shrink-0"
                      size={16}
                      animated={false}
                      aria-hidden
                    />
                  </span>
                  <span className="exchange-icon-face exchange-icon-face--diamond">
                    <DiamondLottie
                      className="top-nav-resource-icon top-nav-resource-icon--diamond shrink-0"
                      size={14}
                      animated={showPreview}
                      loop
                      autoplay={showPreview}
                      aria-hidden
                    />
                  </span>
                </span>
                <span className="profile-balance-copy">
                  {roll ? (
                    <span
                      className="profile-balance-value is-rolling"
                      aria-live="polite"
                    >
                      <CountUp
                        from={roll.fromCoins}
                        to={roll.toCoins}
                        mode="roll"
                        easing="easeOut"
                        format="standard"
                        separator=","
                        trigger="load"
                        duration={0.5}
                      />
                    </span>
                  ) : showPreview && !previewDenied ? (
                    <button
                      type="button"
                      className={[
                        "profile-balance-value",
                        "profile-balance-value--confirm",
                        "is-exchange-preview",
                      ].join(" ")}
                      data-convert-confirm
                      aria-label={convertAria}
                      aria-live="polite"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        confirmPreview();
                      }}
                    >
                      {previewAmount}
                    </button>
                  ) : (
                    <span
                      className={[
                        "profile-balance-value",
                        showPreview ? "is-exchange-preview" : "",
                        showPreview && previewDenied ? "is-exchange-denied" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-live="polite"
                    >
                      {showPreview ? previewAmount : formatBalance(coins)}
                    </span>
                  )}
                  {showPreview && !previewDenied ? (
                    <button
                      type="button"
                      className="profile-balance-label profile-balance-label--confirm"
                      data-convert-confirm
                      aria-label={convertAria}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        confirmPreview();
                      }}
                    >
                      Convert?
                    </button>
                  ) : (
                    <span className="profile-balance-label">
                      {showPreview && previewDenied ? "Need more" : "Coin Balance"}
                    </span>
                  )}
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
                    aria-label={convertAria}
                    disabled={!canPreview}
                    {...convertButtonProps}
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
                    forceWebgl
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
                    strokeColor="rgba(141, 0, 170, 0.42)"
                    auroraBaseColor="#1b0042"
                    auroraColorStops={["#8a3cb0", "#c42eea", "#1b0042", "#6b3e93"]}
                    glowColors={["#8d00aa", "#d503ff", "#b44bff"]}
                    glowColor="292 80 28"
                    particleColor="#e08aff"
                    labelColor="#f0e0ff"
                    auroraFrozen={pageScrolling}
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
              { label: "Game History", icon: GameHistoryIcon },
            ]}
            onOpen={open}
          />
          <MenuGroup
            title="Profile & Account"
            items={[
              { label: "Inbox", icon: Inbox, badgeCount: inboxUnreadCount },
              { label: "Following", icon: Users },
              { label: "Change Password", icon: Lock },
              { label: "Delete account", icon: Trash2 },
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
            { label: "Help Centre", icon: HelpCircle },
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

      <HomeSiteFooter />

      {notice ? (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-caption backdrop-blur-md">
          {notice}
        </div>
      ) : null}
    </AppPageShell>
  );
}

function GameHistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89l.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7s-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.95 8.95 0 0 0 13 21a9 9 0 0 0 0-18m-1 5v5l4.28 2.54l.72-1.21l-3.5-2.08V8z"
      />
    </svg>
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
    icon: LucideIcon | ComponentType<{ className?: string }>;
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
              data-settings-row={item.label}
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
