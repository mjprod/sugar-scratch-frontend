/**
 * Inbox grouping self-check.
 * Run: npx tsx old_app/src/v8/flow/inbox.self-check.ts
 */
import {
  hasUnread,
  INBOX_FIXTURES,
  INBOX_NEW_WINDOW_MS,
  relativeTime,
  splitInboxSections,
  type InboxMessage,
} from "./inbox.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const now = Date.now();
const sample: InboxMessage[] = [
  {
    id: "n1",
    type: "account_system",
    title: "New unread",
    subtitle: "x",
    timestamp: new Date(now - 60_000).toISOString(),
    isRead: false,
  },
  {
    id: "n2",
    type: "account_system",
    title: "New read",
    subtitle: "x",
    timestamp: new Date(now - 2 * 60_000).toISOString(),
    isRead: true,
  },
  {
    id: "e1",
    type: "account_system",
    title: "Earlier unread",
    subtitle: "x",
    timestamp: new Date(now - INBOX_NEW_WINDOW_MS - 60_000).toISOString(),
    isRead: false,
  },
];

{
  const { newer, earlier } = splitInboxSections(sample, false, now);
  assert(newer.length === 2, "new window has 2");
  assert(earlier.length === 1, "earlier has 1");
  assert(newer[0]!.id === "n1", "newest first");
}

{
  const { newer, earlier } = splitInboxSections(sample, true, now);
  assert(newer.length === 1 && newer[0]!.id === "n1", "unread filter new");
  assert(earlier.length === 1 && earlier[0]!.id === "e1", "unread filter earlier");
}

assert(hasUnread(INBOX_FIXTURES), "fixtures include unread");
assert(
  relativeTime(new Date(now - 2 * 60_000).toISOString(), now) === "2m ago",
  "2m ago",
);
assert(INBOX_FIXTURES.some((m) => m.type === "payment_failure"), "payment fixture");
assert(INBOX_FIXTURES.some((m) => m.type === "creator_drop"), "drop fixture");
assert(
  INBOX_FIXTURES.filter((m) => m.type === "account_system").length >= 4,
  "account_system variants",
);

console.log("v8 inbox self-check passed");
