import {
  Bell,
  CheckCheck,
  ChevronRight,
  Crown,
  Filter,
  Gift,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { EmptyState } from "@/components/EmptyState";
import { SubpageHeader } from "@/components/SubpageHeader";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useAuth } from "@/contexts/AuthContext";
import {
  INBOX_FIXTURES,
  countUnread,
  fetchInboxMessages,
  markInboxRead,
  relativeTime,
  splitInboxSections,
  type AccountSystemIcon,
  type InboxMessage,
  type InboxMessageCTA,
} from "@/services/inbox";
import { SECONDARY_SURFACES } from "@/lib/navigation";

/** Inbox — secondary surface; desktop keeps Global TopNav, mobile uses compact header. */
export function InboxScreen({
  onBack,
  onMessageAction,
}: {
  onBack: () => void;
  onMessageAction: (message: InboxMessage) => void;
}) {
  const { guest, setInboxUnread } = useAuth();
  const [messages, setMessages] = useState(() => [...INBOX_FIXTURES]);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  useEffect(() => {
    if (guest) return;
    let cancelled = false;
    void fetchInboxMessages().then((list) => {
      if (cancelled) return;
      setMessages(list);
      setInboxUnread(countUnread(list));
    });
    return () => {
      cancelled = true;
    };
  }, [guest, setInboxUnread]);

  const { newer, earlier } = useMemo(
    () => splitInboxSections(messages, filterUnreadOnly),
    [messages, filterUnreadOnly],
  );
  const emptyFiltered =
    filterUnreadOnly && newer.length === 0 && earlier.length === 0;
  const emptyAll = !filterUnreadOnly && newer.length === 0 && earlier.length === 0;

  function markRead(id: string) {
    void markInboxRead(id);
    setMessages((list) => {
      const next = list.map((m) =>
        m.id === id ? { ...m, isRead: true } : m,
      );
      if (!guest) setInboxUnread(countUnread(next));
      return next;
    });
  }

  function handleRow(message: InboxMessage) {
    markRead(message.id);
    onMessageAction(message);
  }

  const meta = SECONDARY_SURFACES.inbox;
  const filterControl = (
    <UnreadFilter
      active={filterUnreadOnly}
      onToggle={() => setFilterUnreadOnly((v) => !v)}
    />
  );

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Inbox"
      className="inbox-page"
    >
      <SubpageHeader
        title={meta.title}
        onBack={onBack}
        backLabel={meta.backLabel}
        trailing={
          <span className="inbox-header-filter lg:hidden">{filterControl}</span>
        }
      />

      {emptyAll || emptyFiltered ? (
        <div className="inbox-empty-wrap">
          <div className="inbox-section-head">
            <span className="inbox-section-label">New</span>
            <span className="hidden lg:inline-flex">{filterControl}</span>
          </div>
          <EmptyState
            icon={emptyFiltered ? CheckCheck : Bell}
            title="You're all caught up"
            titleId="inbox-empty-title"
            copy={
              emptyFiltered
                ? "No unread messages right now."
                : "New packs, rewards and activity will appear here."
            }
          />
        </div>
      ) : (
        <>
          <MessageListSection
            label="New"
            showDot={newer.some((m) => !m.isRead)}
            trailing={
              <span className="hidden lg:inline-flex">{filterControl}</span>
            }
          >
            {newer.length > 0
              ? newer.map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    onPress={handleRow}
                  />
                ))
              : null}
          </MessageListSection>

          {earlier.length > 0 ? (
            <MessageListSection
              label="Earlier"
              showDot={earlier.some((m) => !m.isRead)}
            >
              {earlier.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  onPress={handleRow}
                />
              ))}
            </MessageListSection>
          ) : null}
        </>
      )}
    </AppPageShell>
  );
}

function UnreadFilter({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={["inbox-filter", active ? "is-active" : ""].join(" ")}
      aria-pressed={active}
      aria-label="Unread only"
      onClick={onToggle}
    >
      <Filter className="size-3.5" strokeWidth={2} aria-hidden />
      <span className="inbox-filter-label">Unread only</span>
    </button>
  );
}

function MessageListSection({
  label,
  showDot,
  trailing,
  children,
}: {
  label: string;
  showDot?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="inbox-section"
      aria-labelledby={`inbox-section-${label}`}
    >
      <div className="inbox-section-head">
        <h2 id={`inbox-section-${label}`} className="inbox-section-label">
          {label}
          {showDot ? (
            <span className="inbox-unread-dot" aria-label="Contains unread" />
          ) : null}
        </h2>
        {trailing}
      </div>
      {children ? <ul className="inbox-list">{children}</ul> : null}
    </section>
  );
}

function MessageItem({
  message,
  onPress,
}: {
  message: InboxMessage;
  onPress: (message: InboxMessage) => void;
}) {
  return (
    <li className="inbox-item-row">
      <button
        type="button"
        className="inbox-item"
        onClick={() => onPress(message)}
      >
        <span
          className={[
            "inbox-item-dot",
            message.isRead ? "is-hidden" : "",
          ].join(" ")}
          aria-hidden={message.isRead}
        />
        <MessageThumb thumbnail={message.thumbnail} />
        <span className="inbox-item-body">
          <span className="inbox-item-title">{message.title}</span>
          <span className="inbox-item-subtitle">{message.subtitle}</span>
        </span>
        <span className="inbox-item-time">
          {relativeTime(message.timestamp)}
        </span>
        <ChevronRight
          className="inbox-item-chevron"
          aria-hidden="true"
          strokeWidth={1.8}
        />
      </button>
    </li>
  );
}

function MessageThumb({
  thumbnail,
}: {
  thumbnail?: InboxMessage["thumbnail"];
}) {
  if (!thumbnail) {
    return <span className="inbox-thumb inbox-thumb--icon is-bell" />;
  }
  if (thumbnail.kind === "avatar" && thumbnail.src) {
    return (
      <img
        src={thumbnail.src}
        alt=""
        className="inbox-thumb inbox-thumb--avatar"
      />
    );
  }
  if (thumbnail.kind === "pack_art" && thumbnail.src) {
    return (
      <img
        src={thumbnail.src}
        alt=""
        className="inbox-thumb inbox-thumb--pack"
      />
    );
  }
  const icon = thumbnail.icon ?? "bell";
  return (
    <span className={`inbox-thumb inbox-thumb--icon is-${icon}`}>
      <ThumbIcon icon={icon} />
    </span>
  );
}

function ThumbIcon({ icon }: { icon: AccountSystemIcon }) {
  switch (icon) {
    case "gift":
      return <Gift className="size-5" strokeWidth={1.8} />;
    case "diamond":
      return <DiamondLottie size={20} aria-hidden />;
    case "vip_crown":
      return <Crown className="size-5" strokeWidth={1.8} />;
    case "warning":
      return <TriangleAlert className="size-5" strokeWidth={1.8} />;
    default:
      return <Bell className="size-5" strokeWidth={1.8} />;
  }
}

export type { InboxMessage, InboxMessageCTA };
