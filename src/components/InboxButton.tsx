import { Bell } from "lucide-react";

/**
 * Global Inbox utility — one control for TopNav / mobile utility / subpage trailing.
 */
export function InboxButton({
  unreadCount = 0,
  onOpen,
  className = "",
}: {
  unreadCount?: number;
  onOpen: () => void;
  className?: string;
}) {
  const hasUnread = unreadCount > 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  const ariaLabel = hasUnread
    ? `Inbox, ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`
    : "Inbox";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ariaLabel}
      className={[
        "inbox-utility-btn relative grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Bell className="size-5" strokeWidth={1.75} aria-hidden="true" />
      {hasUnread ? (
        <span className="inbox-utility-badge" aria-hidden="true">
          {badgeLabel}
        </span>
      ) : null}
    </button>
  );
}
