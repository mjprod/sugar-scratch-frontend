import {
  Bell,
  CheckCheck,
  ChevronRight,
  Crown,
  Filter,
  Gem,
  Gift,
  TriangleAlert,
} from "lucide-react";
import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EmptyState } from "@/components/EmptyState";
import { MobileDiamondBalance } from "@/components/MobileDiamondBalance";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  INBOX_FIXTURES,
  relativeTime,
  splitInboxSections,
  type AccountSystemIcon,
  type InboxMessage,
  type InboxMessageCTA,
} from "@/services/inbox";
import { SECONDARY_SURFACES } from "@/lib/navigation";

/** Inbox list — secondary surface; Back via SubpageHeader. */
export function InboxScreen({
  onBack,
  onMessageAction,
  diamonds,
}: {
  onBack: () => void;
  onMessageAction: (message: InboxMessage, source: "row" | "cta") => void;
  diamonds?: number | null;
}) {
  const [messages, setMessages] = useState(() => [...INBOX_FIXTURES]);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const { newer, earlier } = useMemo(
    () => splitInboxSections(messages, filterUnreadOnly),
    [messages, filterUnreadOnly],
  );
  const emptyFiltered =
    filterUnreadOnly && newer.length === 0 && earlier.length === 0;

  function markRead(id: string) {
    setMessages((list) =>
      list.map((m) => (m.id === id ? { ...m, isRead: true } : m)),
    );
  }

  function handleRow(message: InboxMessage) {
    markRead(message.id);
    onMessageAction(message, "row");
  }

  function handleCta(message: InboxMessage) {
    markRead(message.id);
    onMessageAction(message, "cta");
  }

  const meta = SECONDARY_SURFACES.inbox;

  return (
    <section
      data-page-scroll
      className="inbox-page flex min-h-0 flex-1 flex-col overflow-y-auto"
      aria-label="Inbox"
    >
      <div className="inbox-page-content">
        <SubpageHeader
          title={meta.title}
          onBack={onBack}
          backLabel={meta.backLabel}
          trailing={
            diamonds !== undefined ? (
              <MobileDiamondBalance balance={diamonds} standalone />
            ) : undefined
          }
        />
        <p className="inbox-subtitle inbox-subtitle--page">
          Updates, packs, and important activity
        </p>

        {emptyFiltered ? (
          <div className="inbox-empty-wrap">
            <div className="inbox-section-head">
              <span className="inbox-section-label">New</span>
              <UnreadFilter
                active={filterUnreadOnly}
                onToggle={() => setFilterUnreadOnly((v) => !v)}
              />
            </div>
            <EmptyState
              icon={CheckCheck}
              title="You're all caught up"
              titleId="inbox-empty-title"
              copy="No unread messages right now."
            />
          </div>
        ) : (
          <>
            {newer.length > 0 ? (
              <MessageListSection
                label="New"
                showDot={newer.some((m) => !m.isRead)}
                trailing={
                  <UnreadFilter
                    active={filterUnreadOnly}
                    onToggle={() => setFilterUnreadOnly((v) => !v)}
                  />
                }
              >
                {newer.map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    onPress={handleRow}
                    onCta={handleCta}
                  />
                ))}
              </MessageListSection>
            ) : null}

            {earlier.length > 0 ? (
              <MessageListSection
                label="Earlier"
                showDot={earlier.some((m) => !m.isRead)}
                trailing={
                  newer.length === 0 ? (
                    <UnreadFilter
                      active={filterUnreadOnly}
                      onToggle={() => setFilterUnreadOnly((v) => !v)}
                    />
                  ) : null
                }
              >
                {earlier.map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    onPress={handleRow}
                    onCta={handleCta}
                  />
                ))}
              </MessageListSection>
            ) : null}
          </>
        )}
      </div>
    </section>
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
      onClick={onToggle}
    >
      <Filter className="size-3.5" strokeWidth={2} aria-hidden />
      Unread only
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
      <ul className="inbox-list">{children}</ul>
    </section>
  );
}

function MessageItem({
  message,
  onPress,
  onCta,
}: {
  message: InboxMessage;
  onPress: (message: InboxMessage) => void;
  onCta: (message: InboxMessage) => void;
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
        <span className="inbox-item-meta">
          <span className="inbox-item-time">
            {relativeTime(message.timestamp)}
          </span>
        </span>
        <ChevronRight
          className="inbox-item-chevron"
          aria-hidden="true"
          strokeWidth={1.8}
        />
      </button>
      {message.cta ? (
        <button
          type="button"
          className="inbox-item-cta"
          onClick={() => onCta(message)}
        >
          {message.cta.label}
        </button>
      ) : null}
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
      return <Gem className="size-5" strokeWidth={1.8} />;
    case "vip_crown":
      return <Crown className="size-5" strokeWidth={1.8} />;
    case "warning":
      return <TriangleAlert className="size-5" strokeWidth={1.8} />;
    default:
      return <Bell className="size-5" strokeWidth={1.8} />;
  }
}

export type { InboxMessage, InboxMessageCTA };
