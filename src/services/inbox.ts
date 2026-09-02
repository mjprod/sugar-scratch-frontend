/**
 * Inbox notification hub — types, grouping, and mock fixtures.
 * New vs Earlier is chronological (24h window), not read-state.
 */
import { CREATOR_PHOTOS, HOLO_PACKS } from "../lib/photos";
import { apiGet, apiMutate } from "../lib/api";
import { isDemoMode } from "../lib/demo";

export type InboxMessageType =
  | "creator_drop"
  | "limited_expiring"
  | "account_system"
  | "payment_failure";

export type AccountSystemIcon =
  | "bell"
  | "gift"
  | "diamond"
  | "vip_crown"
  | "warning";

export type InboxMessageCTA = {
  label: string;
  action: "open_pack" | "view_reward" | "view_pack" | "navigate";
  targetId?: string;
};

export type InboxMessage = {
  id: string;
  type: InboxMessageType;
  title: string;
  subtitle: string;
  timestamp: string;
  isRead: boolean;
  thumbnail?: {
    kind: "avatar" | "pack_art" | "icon";
    src?: string;
    icon?: AccountSystemIcon;
  };
  cta?: InboxMessageCTA;
  /** Optional route hints for row tap. */
  creatorId?: string;
};

/** ponytail: 24h New window until PM/backend ships section field. */
export const INBOX_NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export function relativeTime(iso: string, now = Date.now()): string {
  const delta = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function splitInboxSections(
  messages: InboxMessage[],
  filterUnreadOnly: boolean,
  now = Date.now(),
): { newer: InboxMessage[]; earlier: InboxMessage[] } {
  const filtered = filterUnreadOnly
    ? messages.filter((m) => !m.isRead)
    : messages;
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const newer: InboxMessage[] = [];
  const earlier: InboxMessage[] = [];
  for (const message of sorted) {
    const age = now - new Date(message.timestamp).getTime();
    if (age <= INBOX_NEW_WINDOW_MS) newer.push(message);
    else earlier.push(message);
  }
  return { newer, earlier };
}

export function hasUnread(messages: InboxMessage[]) {
  return messages.some((m) => !m.isRead);
}

export function countUnread(messages: InboxMessage[]) {
  return messages.reduce((n, m) => n + (m.isRead ? 0 : 1), 0);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number) {
  return hoursAgo(days * 24);
}

/** Visual fixture covering all 4 types + account_system icon sub-cases. */
export const INBOX_FIXTURES: InboxMessage[] = [
  {
    id: "msg-drop-1",
    type: "creator_drop",
    title: "Ashley dropped a new theme",
    subtitle: "Neon Rain is live — open her collection",
    timestamp: hoursAgo(0.4),
    isRead: false,
    thumbnail: {
      kind: "avatar",
      src: CREATOR_PHOTOS.emma.avatar,
    },
    creatorId: "ashley",
  },
  {
    id: "msg-limited-1",
    type: "limited_expiring",
    title: "Limited Pack ends soon",
    subtitle: "Cyber Nights expires in 6 hours",
    timestamp: hoursAgo(2),
    isRead: false,
    thumbnail: {
      kind: "pack_art",
      src: HOLO_PACKS.cyberHolo,
    },
    cta: {
      label: "View Pack",
      action: "view_pack",
      targetId: "cyber",
    },
  },
  {
    id: "msg-pack-ready",
    type: "account_system",
    title: "Your Pack is ready",
    subtitle: "Kimono Glow is waiting in Collection",
    timestamp: hoursAgo(5),
    isRead: false,
    thumbnail: {
      kind: "icon",
      icon: "gift",
    },
    cta: {
      label: "Open Pack",
      action: "open_pack",
      targetId: "kimono",
    },
  },
  {
    id: "msg-purchase",
    type: "account_system",
    title: "Purchase complete",
    subtitle: "You received 120 Diamonds",
    timestamp: hoursAgo(8),
    isRead: true,
    thumbnail: {
      kind: "icon",
      icon: "diamond",
    },
  },
  {
    id: "msg-vip",
    type: "account_system",
    title: "VIP reward unlocked",
    subtitle: "Claim your weekly Sugar Coins bonus",
    timestamp: daysAgo(2),
    isRead: false,
    thumbnail: {
      kind: "icon",
      icon: "vip_crown",
    },
    cta: {
      label: "View Reward",
      action: "view_reward",
      targetId: "vip-weekly",
    },
  },
  {
    id: "msg-system",
    type: "account_system",
    title: "Account notice",
    subtitle: "Verify your email to unlock purchases",
    timestamp: daysAgo(3),
    isRead: true,
    thumbnail: {
      kind: "icon",
      icon: "bell",
    },
  },
  {
    id: "msg-reward-collection",
    type: "account_system",
    title: "Collection reward ready",
    subtitle: "You completed Golden Hour — claim gift",
    timestamp: daysAgo(4),
    isRead: true,
    thumbnail: {
      kind: "icon",
      icon: "gift",
    },
    cta: {
      label: "View Reward",
      action: "view_reward",
      targetId: "theme-golden",
    },
  },
  {
    id: "msg-pay-fail",
    type: "payment_failure",
    title: "Payment failed",
    subtitle: "We couldn't process your Diamond purchase",
    timestamp: daysAgo(5),
    isRead: false,
    thumbnail: {
      kind: "icon",
      icon: "warning",
    },
    cta: {
      label: "Retry Payment",
      action: "navigate",
      targetId: "store",
    },
  },
  {
    id: "msg-drop-earlier",
    type: "creator_drop",
    title: "Yuna launched Midnight",
    subtitle: "New motion cards just dropped",
    timestamp: daysAgo(6),
    isRead: true,
    thumbnail: {
      kind: "avatar",
      src: CREATOR_PHOTOS.nancy.avatar,
    },
    creatorId: "yuna",
  },
];

export type InboxLoadResult =
  | { status: "ok"; messages: InboxMessage[] }
  | { status: "error"; messages: InboxMessage[]; message: string }
  | { status: "unauthorized"; messages: InboxMessage[]; message: string };

export async function fetchInboxMessages(): Promise<InboxLoadResult> {
  if (isDemoMode()) {
    return { status: "ok", messages: [...INBOX_FIXTURES] };
  }
  const data = await apiGet<{ messages: InboxMessage[] }>("/api/inbox");
  if (data.ok) {
    return { status: "ok", messages: data.data.messages ?? [] };
  }
  if (data.reason === "unauthorized") {
    return {
      status: "unauthorized",
      messages: [],
      message: "Your session expired. Log in to continue.",
    };
  }
  return {
    status: "error",
    messages: [],
    message: "Unable to load inbox.",
  };
}

export async function markInboxRead(id: string) {
  try {
    await apiMutate(`/api/inbox/${id}/read`, { method: "POST" });
  } catch {
    /* ignore */
  }
}

export async function markInboxReadAll() {
  try {
    await apiMutate("/api/inbox/read-all", { method: "POST" });
  } catch {
    /* ignore */
  }
}
