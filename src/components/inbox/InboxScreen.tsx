import {
  Bell,
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
import { useAuth } from "@/contexts/useAuth";
import {
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
import { PageContentEnter } from "@/shared/ui/PageContentEnter";

const INBOX_DONE_ART = "/images/inbox/imageInboxDone";

function InboxDoneArt() {
  return (
    <picture>
      <source
        type="image/jxl"
        srcSet={`${INBOX_DONE_ART}@1x.jxl 1x, ${INBOX_DONE_ART}@2x.jxl 2x`}
      />
      <source
        type="image/webp"
        srcSet={`${INBOX_DONE_ART}@1x.webp 1x, ${INBOX_DONE_ART}@2x.webp 2x`}
      />
      <img
        className="inbox-empty-art"
        src={`${INBOX_DONE_ART}@1x.png`}
        srcSet={`${INBOX_DONE_ART}@1x.png 1x, ${INBOX_DONE_ART}@2x.png 2x`}
        alt=""
        width={355}
        height={330}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}

/** Inbox — secondary surface; desktop keeps liquid top nav, mobile uses compact header. */
export function InboxScreen({
  onBack,
  onMessageAction,
}: {
  onBack: () => void;
  onMessageAction: (message: InboxMessage) => void;
}) {
  const { guest, setInboxUnread, invalidateRemoteSession } = useAuth();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(!guest);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  useEffect(() => {
    if (guest) {
      setLoading(false);
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchInboxMessages().then((result) => {
      if (cancelled) return;
      setMessages(result.messages);
      setLoadError(
        result.status === "error" || result.status === "unauthorized"
          ? result.message
          : "",
      );
      setInboxUnread(countUnread(result.messages));
      setLoading(false);
      if (result.status === "unauthorized") {
        invalidateRemoteSession();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [guest, invalidateRemoteSession, setInboxUnread]);

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
          <span className="inbox-header-filter">{filterControl}</span>
        }
      />

      {loading ? (
        <InboxSkeleton />
      ) : loadError ? (
        <EmptyState
          icon={TriangleAlert}
          title="Couldn't load inbox"
          titleId="inbox-error-title"
          copy={loadError}
        />
      ) : emptyAll || emptyFiltered ? (
        <PageContentEnter className="inbox-empty-wrap">
          <div className="inbox-section-head">
            <span className="inbox-section-label">New</span>
          </div>
          <EmptyState
            art={<InboxDoneArt />}
            title="You're all caught up"
            titleId="inbox-empty-title"
            copy={
              emptyFiltered
                ? "No unread messages right now."
                : "New packs, rewards and activity will appear here."
            }
          />
        </PageContentEnter>
      ) : (
        <PageContentEnter stagger>
          <MessageListSection
            label="New"
            showDot={newer.some((m) => !m.isRead)}
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
        </PageContentEnter>
      )}
    </AppPageShell>
  );
}

function InboxSkeleton() {
  return (
    <div className="inbox-section" aria-busy="true" aria-label="Loading inbox">
      <div className="inbox-section-head">
        <span className="inbox-section-label">New</span>
      </div>
      <ul className="inbox-list">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="inbox-item-row">
            <div className="inbox-item inbox-item--skeleton" aria-hidden="true">
              <span className="inbox-item-dot is-hidden" />
              <span className="inbox-thumb inbox-skeleton-thumb" />
              <span className="inbox-item-body">
                <span className="inbox-skeleton-line is-title" />
                <span className="inbox-skeleton-line is-sub" />
              </span>
              <span className="inbox-skeleton-line is-time" />
              <span className="inbox-skeleton-chevron" />
            </div>
          </li>
        ))}
      </ul>
    </div>
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
