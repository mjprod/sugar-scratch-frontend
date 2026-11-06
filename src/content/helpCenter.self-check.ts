/**
 * Help Centre stays App Review-safe for consumable Diamonds.
 * Run: npx tsx src/content/helpCenter.self-check.ts
 */
import {
  APPLE_REFUND_URL,
  DELETE_ACCOUNT_CONFIRM,
  DELETE_ACCOUNT_POINTS,
  HELP_FAQS,
  HELP_LINKS,
  LEGAL_SUPPORT_EMAIL,
  PACK_ODDS_TIERS,
  RECOVER_PURCHASE_COPY,
  REFUND_APPLE_COPY,
  REFUND_WEB_COPY,
  helpContactPath,
  isSupportTopic,
  supportMailto,
  supportTopicLabel,
} from "./helpCenter.ts";
import { PRIVACY_BLOCKS, TERMS_BLOCKS, type LegalBlock } from "./legalDocs.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function plain(blocks: LegalBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "ul") return block.items.join("\n");
      if ("text" in block) return block.text;
      return "";
    })
    .join("\n");
}

const helpBlob = JSON.stringify({
  HELP_FAQS,
  HELP_LINKS,
  RECOVER_PURCHASE_COPY,
  REFUND_WEB_COPY,
  REFUND_APPLE_COPY,
  DELETE_ACCOUNT_POINTS,
});

assert(!helpBlob.includes("Restore Purchases"), "no restore-purchases label");
assert(!helpBlob.includes("/get-diamonds"), "help does not link the diamond shop");
assert(!helpBlob.includes("stripe.com"), "help does not link a web checkout");
assert(!/diamonds?[^.]*\bexpire\b/i.test(helpBlob), "help does not expire diamonds");

const ids = HELP_LINKS.map((link) => link.id);
for (const id of [
  "transactions",
  "recover",
  "odds",
  "privacy",
  "terms",
  "delete",
  "report",
] as const) {
  assert(ids.includes(id), `help link ${id}`);
}

const recover = HELP_LINKS.find((link) => link.id === "recover");
assert(
  recover?.label === "Recover unfinished purchase",
  "recover label is not a restore button",
);
assert(
  recover?.href === helpContactPath("missing-diamonds"),
  "recover opens the missing-diamonds form",
);
assert(
  HELP_LINKS.find((link) => link.id === "odds")?.href === "/legal/odds",
  "odds link",
);

assert(isSupportTopic("missing-diamonds"), "missing diamonds topic");
assert(isSupportTopic("refund"), "refund topic");
assert(isSupportTopic("report-content"), "report topic");
assert(!isSupportTopic("restore"), "no restore topic");
assert(
  supportTopicLabel("missing-diamonds").length > 0,
  "missing diamonds label",
);

const mailto = supportMailto({
  topic: "refund",
  email: "a@b.co",
  message: "Charged twice",
  accountId: "user-1",
  transactionRef: "tx-9",
  reportTarget: "",
  appVersion: "web",
});
assert(mailto.startsWith(`mailto:${LEGAL_SUPPORT_EMAIL}?`), "support mailto");
assert(mailto.includes("tx-9"), "mailto keeps the transaction ref");
assert(!mailto.includes("/get-diamonds"), "mailto is not a checkout");

assert(PACK_ODDS_TIERS.length === 3, "three rarity tiers");
assert(
  PACK_ODDS_TIERS.map((tier) => tier.tier).join(",") ===
    "Rare,Super Rare,Ultra Rare",
  "rarity order",
);

assert(DELETE_ACCOUNT_CONFIRM === "DELETE", "delete confirmation word");
assert(
  DELETE_ACCOUNT_POINTS.some((line) => /tax/i.test(line)),
  "deletion names tax retention",
);
assert(
  DELETE_ACCOUNT_POINTS.some((line) => /Sign in with Apple/i.test(line)),
  "deletion revokes Sign in with Apple",
);

const terms = plain(TERMS_BLOCKS);
assert(!terms.includes("May expire"), "terms do not expire paid diamonds");
assert(terms.includes("Do not expire"), "terms say diamonds do not expire");
assert(terms.includes("Stripe"), "terms name Stripe refunds");
assert(terms.includes(APPLE_REFUND_URL), "terms send Apple refunds to Apple");
assert(
  terms.includes("does not send you to the website to buy Diamonds"),
  "terms do not steer iOS to the website",
);
assert(terms.includes("Delete account"), "terms point at in-app deletion");
assert(/tax and payment records/i.test(terms), "terms name retained records");

const privacy = plain(PRIVACY_BLOCKS);
assert(privacy.includes("Apple In-App Purchase"), "privacy names Apple billing");
assert(
  privacy.includes("Settings → Delete account"),
  "privacy points at in-app deletion",
);
assert(/tax and payment records/i.test(privacy), "privacy names retained records");

console.log("helpCenter.self-check ok");
