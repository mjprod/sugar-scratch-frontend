/**
 * Help Centre copy and routes. Diamonds are consumables: there is no
 * Restore Purchases action, and this module must not link to a web checkout.
 */
import {
  APPLE_REFUND_URL,
  LEGAL_PRIVACY_EMAIL,
  LEGAL_SUPPORT_EMAIL,
} from "./legalDocs";

export { APPLE_REFUND_URL, LEGAL_PRIVACY_EMAIL, LEGAL_SUPPORT_EMAIL };

/** Shown on support requests. This build is the website. */
export const HELP_APP_VERSION = "web";

export const SUPPORT_TOPICS = [
  {
    id: "missing-diamonds",
    label: "Payment succeeded but my balance did not update",
  },
  { id: "refund", label: "Refund review" },
  { id: "report-content", label: "Report a card or creator" },
  { id: "account", label: "Account" },
  { id: "other", label: "Something else" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["id"];

export function isSupportTopic(value: string | null): value is SupportTopic {
  return SUPPORT_TOPICS.some((topic) => topic.id === value);
}

export function supportTopicLabel(topic: SupportTopic): string {
  return SUPPORT_TOPICS.find((item) => item.id === topic)?.label ?? topic;
}

export function helpContactPath(
  topic: SupportTopic,
  transactionId?: string,
): string {
  const params = new URLSearchParams({ contact: topic });
  const ref = transactionId?.trim();
  if (ref) params.set("ref", ref);
  return `/help?${params.toString()}`;
}

export const HELP_FAQS: { q: string; a: string }[] = [
  {
    q: "What are Diamonds and Coins?",
    a: "Diamonds are the paid currency. You spend them on card packs. Coins are earned from play, missions, and promotions, and cannot be bought. Neither has cash value.",
  },
  {
    q: "What is in a card pack?",
    a: "A pack contains randomized Motion Cards that reveal Photo Cards. Rarity tiers are Rare, Super Rare, and Ultra Rare. Read the pack odds before you pay.",
  },
  {
    q: "Why are pack results random?",
    a: "Packs are a random draw. Opening a pack shows the result immediately. Dissatisfaction with a result is not a failed purchase.",
  },
  {
    q: "What happens if I reinstall or switch devices?",
    a: "Your Diamond balance, Coins, and collection are stored on your account. Sign in on the new device to see them. They are not stored only on the phone.",
  },
  {
    q: "Who can use Sugar Scratch?",
    a: "You must be 18 or older to create an account, hold Diamonds, or buy anything.",
  },
  {
    q: "Can I cash out Diamonds or cards?",
    a: "No. Diamonds, Coins, and cards have no cash value, are not redeemable for money, and cannot be sold or traded outside Sugar Scratch.",
  },
  {
    q: "How do refunds work?",
    a: `Website charges (Stripe): email ${LEGAL_SUPPORT_EMAIL} within 14 days with your account ID and transaction reference. We can review a failed payment, a duplicate charge, or an error on our side. App Store charges: Apple bills you, so request a refund from Apple at ${APPLE_REFUND_URL}. Support cannot reverse an Apple charge.`,
  },
  {
    q: "How do I delete my account?",
    a: "Settings → Delete account, or the Delete account link in this Help Centre. Deletion removes the account and personal data. We keep tax and payment records where the law requires it. If you used Sign in with Apple, that sign-in is revoked when the account is deleted.",
  },
];

export const RECOVER_PURCHASE_COPY =
  "Recover unfinished purchase checks a payment that succeeded but never reached your Diamond balance. It credits that purchase once. It does not return Diamonds you already spent, and it does not start a new charge.";

export const REFUND_WEB_COPY = `Website purchases are billed by Stripe. Contact ${LEGAL_SUPPORT_EMAIL} within 14 days with your account ID and transaction reference if a payment failed, was charged twice, or did not credit your balance because of an error on our side.`;

export const REFUND_APPLE_COPY = `App Store purchases are billed by Apple. Request a refund at ${APPLE_REFUND_URL}. Sugar Scratch support cannot reverse an Apple charge.`;

export const DELETE_ACCOUNT_POINTS = [
  "We delete or anonymize your account and the personal data tied to it when you confirm.",
  "We keep tax and payment records where the law requires it, and support messages for as long as the Privacy Policy says.",
  "Unused Diamonds, Coins, and collected cards are forfeited.",
  "If you signed in with Apple, we revoke that Sign in with Apple credential as part of deletion.",
  "You are signed out as soon as deletion is accepted.",
] as const;

export const DELETE_ACCOUNT_CONFIRM = "DELETE";

/** In-help destinations. No store or checkout URLs. */
export const HELP_LINKS = [
  {
    id: "transactions",
    label: "Transaction history",
    href: "/profile/transactions",
  },
  {
    id: "recover",
    label: "Recover unfinished purchase",
    href: helpContactPath("missing-diamonds"),
  },
  { id: "odds", label: "Pack odds", href: "/legal/odds" },
  { id: "privacy", label: "Privacy Policy", href: "/help?doc=privacy" },
  { id: "terms", label: "Terms of Service", href: "/help?doc=terms" },
  {
    id: "delete",
    label: "Delete account",
    href: "/profile/delete-account",
  },
  {
    id: "report",
    label: "Report a card or creator",
    href: helpContactPath("report-content"),
  },
] as const;

export const PACK_ODDS_TIERS = [
  {
    tier: "Rare",
    detail: "The most common Motion Card tier in a standard pack.",
  },
  {
    tier: "Super Rare",
    detail: "Less common than Rare.",
  },
  {
    tier: "Ultra Rare",
    detail: "The least common tier in a standard pack.",
  },
] as const;

export const PACK_ODDS_LEDE =
  "A standard Card Pack awards randomized Motion Cards. Read this before you pay. From most common to least common: Rare, Super Rare, Ultra Rare. Results have no cash value and are not redeemable for money.";

export type SupportDraft = {
  topic: SupportTopic;
  email: string;
  message: string;
  accountId: string;
  transactionRef: string;
  reportTarget: string;
  appVersion: string;
};

export function supportMailto(draft: SupportDraft): string {
  const lines = [
    `Topic: ${supportTopicLabel(draft.topic)}`,
    `Account ID: ${draft.accountId.trim() || "—"}`,
    `Transaction: ${draft.transactionRef.trim() || "—"}`,
    `App version: ${draft.appVersion}`,
  ];
  if (draft.topic === "report-content" && draft.reportTarget.trim()) {
    lines.push(`Reporting: ${draft.reportTarget.trim()}`);
  }
  lines.push("", draft.message.trim());
  const params = new URLSearchParams({
    subject: `Sugar Scratch support: ${supportTopicLabel(draft.topic)}`,
    body: lines.join("\n"),
  });
  return `mailto:${LEGAL_SUPPORT_EMAIL}?${params.toString()}`;
}
