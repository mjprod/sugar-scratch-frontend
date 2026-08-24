/** End-user legal copy for Sugar Scratch.
 * Contact / entity constants — update when Legal finalizes the operating company. */
const LEGAL_EFFECTIVE_DATE = "August 25, 2026";
const LEGAL_COMPANY_NAME = "Sugar Scratch";
const LEGAL_SUPPORT_EMAIL = "support@sugarscratch.com";
const LEGAL_PRIVACY_EMAIL = "privacy@sugarscratch.com";

export type LegalBlock =
  | { type: "lede"; text: string }
  | { type: "meta"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "note"; text: string };

/** Matches create-account consent copy ("Terms of Service"). */
export const TERMS_TITLE = "Terms of Service";
export const PRIVACY_TITLE = "Privacy Policy";

export const TERMS_BLOCKS: LegalBlock[] = [
  {
    type: "meta",
    text: `Effective Date: ${LEGAL_EFFECTIVE_DATE} · Last Updated: ${LEGAL_EFFECTIVE_DATE}`,
  },
  {
    type: "lede",
    text: `These Terms of Service ("Terms") govern your access to and use of Sugar Scratch (the "Service", "we", "us", "our"), a web-based digital collectible card platform operated by ${LEGAL_COMPANY_NAME} ("Company"). By creating an account, purchasing Diamonds, or otherwise using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.`,
  },
  { type: "h2", text: "1. Eligibility" },
  {
    type: "p",
    text: "1.1 You must be at least 18 years old to create an account, hold a Diamond balance, or make purchases on Sugar Scratch. The Service involves randomized paid content (Card Packs) and is not intended for minors.",
  },
  {
    type: "p",
    text: "1.2 By using the Service, you represent that you meet this age requirement and have the legal capacity to enter into a binding agreement in your jurisdiction.",
  },
  {
    type: "p",
    text: "1.3 The Service is not directed at, and we do not knowingly collect personal information from, anyone under 18. If we learn an account belongs to a minor, we will suspend or terminate it.",
  },
  { type: "h2", text: "2. Account Registration" },
  {
    type: "p",
    text: "2.1 Home, Discover, and Store pages may be browsed without an account. Accessing My Collection, Profile, Inbox, or making any purchase requires a registered account.",
  },
  {
    type: "p",
    text: "2.2 You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.",
  },
  {
    type: "p",
    text: "2.3 You agree to provide accurate registration information and to keep it up to date. We may suspend or terminate accounts with false or misleading information.",
  },
  {
    type: "p",
    text: "2.4 One account per person. Creating multiple accounts to exploit promotions, missions, or Daily Rewards is prohibited and may result in forfeiture of Diamonds, Sugar Coin, and collected items.",
  },
  { type: "h2", text: "3. Virtual Currencies (Diamonds & Sugar Coin)" },
  {
    type: "p",
    text: "3.1 Diamonds are the primary paid virtual currency, purchasable with real money through our payment processor. Sugar Coin is a secondary soft currency earned through gameplay, missions, and promotions, and cannot be purchased directly.",
  },
  { type: "p", text: "3.2 Diamonds and Sugar Coin:" },
  {
    type: "ul",
    items: [
      "Have no real-world monetary value and are not redeemable for cash, except where required by applicable law.",
      "Are non-transferable between accounts and cannot be sold, traded, gifted, or exchanged outside the Service.",
      "Are licensed to you for use within the Service, not sold — you acquire a limited, revocable, non-exclusive right to use them.",
      "May expire or be forfeited if your account is terminated for violation of these Terms.",
    ],
  },
  {
    type: "p",
    text: "3.3 We may adjust the pricing, exchange rates, or availability of virtual currencies at any time. Changes will not retroactively reduce a balance you already hold.",
  },
  { type: "h2", text: "4. Purchases, Card Packs & Virtual Items" },
  {
    type: "p",
    text: "4.1 Diamonds may be spent on Card Packs and other in-Service offerings. Exclusive Packs are purchasable with Sugar Coin only and cannot be bought directly with Diamonds or real money.",
  },
  {
    type: "p",
    text: "4.2 Each Card Pack contains randomized digital content (Motion Cards revealing Photo Cards) as described in the Service at the time of purchase. Item rarity and drop rates are randomized (gacha-style). Card Packs are unlocked using Diamonds, which are purchased with real currency; the digital items obtained have no cash value and are not redeemable for real money (see Section 3.2).",
  },
  {
    type: "p",
    text: "4.3 Odds Disclosure. Where required by applicable law or platform policy, the probability of obtaining each rarity tier is published at /legal/odds or an equivalent in-Service disclosure page. Odds are reviewed periodically and may be updated; the version in effect at the time of your purchase applies to that purchase.",
  },
  {
    type: "p",
    text: "4.4 Photo Cards and other collectible items are virtual goods for use within the Service only. You do not own the underlying intellectual property in any Photo Card, creator image, or AI-generated variation — you receive a limited license to view, collect, and display it within the Service. See Section 8 (Intellectual Property).",
  },
  {
    type: "p",
    text: "4.5 Duplicates. Duplicate Photo Cards convert to Shards, redeemable for specific cards as described in the Service. Shard conversion rates may change with notice.",
  },
  {
    type: "p",
    text: "4.6 All purchases are processed by our third-party payment provider (currently Stripe). We do not store your full payment card details. Payment terms, currency, and applicable taxes are shown at checkout.",
  },
  { type: "h2", text: "5. Refund Policy" },
  {
    type: "p",
    text: "5.1 All Diamond purchases and Card Pack openings are final and non-refundable, except:",
  },
  {
    type: "ul",
    items: [
      "Where required by applicable consumer protection law in your jurisdiction;",
      "Where a payment failure, duplicate charge, or technical error on our part is verified by our support team;",
      "As otherwise expressly stated in this Section.",
    ],
  },
  {
    type: "p",
    text: "5.2 Because Card Pack contents are revealed immediately upon opening, we treat opened packs as delivered digital content and generally do not offer refunds for dissatisfaction with results.",
  },
  {
    type: "p",
    text: `5.3 To request a refund review, contact ${LEGAL_SUPPORT_EMAIL} within 14 days of the transaction, including your account ID and transaction reference.`,
  },
  {
    type: "p",
    text: "5.4 Nothing in this Section limits any non-waivable statutory right you may have under the law of your country of residence.",
  },
  { type: "h2", text: "6. Daily Rewards, Missions & Promotions" },
  {
    type: "p",
    text: "6.1 Daily Rewards, missions, redeem codes, and similar promotions are offered at our discretion and may be modified, paused, or discontinued at any time.",
  },
  {
    type: "p",
    text: "6.2 Streaks, mission progress, or promotional rewards may be forfeited if paused beyond the stated window, or if we detect abuse (e.g., automation, multiple accounts, exploiting bugs).",
  },
  {
    type: "p",
    text: "6.3 Redeem codes are single-use, non-transferable, and may carry expiration dates or eligibility restrictions stated at the time of issuance.",
  },
  { type: "h2", text: "7. Creator Content" },
  {
    type: "p",
    text: "7.1 Sugar Scratch features photographic content from real creators/influencers, which may include AI-generated outfit or styling variations of that creator's likeness, produced under agreement with the creator.",
  },
  {
    type: "p",
    text: "7.2 All creator content is provided under license to the Company for use within the Service. Users may not download, redistribute, republish, or use creator images outside the Service, including on social media, without separate written permission.",
  },
  {
    type: "p",
    text: `7.3 We prohibit content that violates our creator content guidelines (including but not limited to non-consensual, exploitative, or sexually explicit material). Users may report concerning content via in-app reporting or ${LEGAL_SUPPORT_EMAIL}.`,
  },
  { type: "h2", text: "8. Intellectual Property" },
  {
    type: "p",
    text: "8.1 The Service, including its design, software, branding, UI, animations, and all Sugar Scratch-original content, is owned by the Company and protected by intellectual property laws.",
  },
  {
    type: "p",
    text: "8.2 Photo Cards, Motion Cards, and other collectible digital items remain the property of the Company and/or its creator licensors. Your purchase or acquisition of an item grants you a personal, non-exclusive, non-transferable, revocable license to use it within the Service — it is not a transfer of ownership or intellectual property rights.",
  },
  {
    type: "p",
    text: "8.3 You may not copy, reverse-engineer, scrape, or create derivative works from the Service or its content except as expressly permitted.",
  },
  { type: "h2", text: "9. Prohibited Conduct" },
  { type: "p", text: "You agree not to:" },
  {
    type: "ul",
    items: [
      "Use bots, scripts, or automation to interact with the Service;",
      "Exploit bugs, glitches, or unintended mechanics for unfair advantage;",
      "Buy, sell, or trade accounts, Diamonds, Sugar Coin, or virtual items outside the Service;",
      "Harass creators, staff, or other users;",
      "Attempt unauthorized access to accounts, systems, or data;",
      "Use the Service for any unlawful purpose or in violation of these Terms.",
    ],
  },
  {
    type: "p",
    text: "Violation may result in warnings, suspension, forfeiture of virtual currency/items, or permanent termination, at our discretion.",
  },
  { type: "h2", text: "10. Service Availability & Changes" },
  {
    type: "p",
    text: "10.1 We may modify, suspend, or discontinue any part of the Service (including specific creators, packs, or features) at any time, with or without notice.",
  },
  {
    type: "p",
    text: "10.2 We are not liable for any loss of access to virtual currency or items resulting from scheduled maintenance, technical issues, or discontinuation of a feature, except where such loss results from our gross negligence or as required by law.",
  },
  { type: "h2", text: "11. Termination" },
  {
    type: "p",
    text: `11.1 You may stop using the Service and request account deletion at any time via Profile settings or ${LEGAL_SUPPORT_EMAIL}.`,
  },
  {
    type: "p",
    text: "11.2 We may suspend or terminate your account for breach of these Terms, suspected fraud, chargebacks, or abuse of promotions.",
  },
  {
    type: "p",
    text: "11.3 Upon termination for cause, unused Diamonds, Sugar Coin, and collected items may be forfeited without compensation, to the extent permitted by law.",
  },
  { type: "h2", text: "12. Disclaimers" },
  {
    type: "p",
    text: '12.1 The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.',
  },
  {
    type: "p",
    text: "12.2 We do not guarantee uninterrupted or error-free operation, or that any particular card, creator content, or drop rate will be available at any given time.",
  },
  { type: "h2", text: "13. Limitation of Liability" },
  {
    type: "p",
    text: "To the maximum extent permitted by applicable law, the Company's total liability for any claim arising from your use of the Service shall not exceed the amount you paid to the Company in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages.",
  },
  {
    type: "note",
    text: "This clause is subject to mandatory consumer protection laws in your jurisdiction, which may limit or override this limitation.",
  },
  { type: "h2", text: "14. Governing Law & Dispute Resolution" },
  {
    type: "p",
    text: "14.1 These Terms are governed by the laws applicable where the Company operates the Service, without regard to conflict-of-law principles.",
  },
  {
    type: "p",
    text: "14.2 Before filing a formal claim, you agree to contact us and attempt informal resolution. If we cannot resolve the dispute within 30 days, either party may pursue relief in a court of competent jurisdiction.",
  },
  { type: "h2", text: "15. Changes to These Terms" },
  {
    type: "p",
    text: "We may update these Terms from time to time. Material changes will be notified via in-Service notice or Inbox message before taking effect. Continued use of the Service after changes take effect constitutes acceptance.",
  },
  { type: "h2", text: "16. Contact" },
  {
    type: "p",
    text: "Questions about these Terms can be directed to:",
  },
  {
    type: "ul",
    items: [LEGAL_SUPPORT_EMAIL, LEGAL_COMPANY_NAME],
  },
];

export const PRIVACY_BLOCKS: LegalBlock[] = [
  {
    type: "meta",
    text: `Effective Date: ${LEGAL_EFFECTIVE_DATE} · Last Updated: ${LEGAL_EFFECTIVE_DATE}`,
  },
  {
    type: "lede",
    text: `This Privacy Policy explains how ${LEGAL_COMPANY_NAME} ("Company", "we", "us", "our") collects, uses, discloses, and protects information when you use Sugar Scratch (the "Service"). It should be read together with our Terms of Service.`,
  },
  { type: "h2", text: "1. Information We Collect" },
  { type: "h3", text: "1.1 Information you provide directly" },
  {
    type: "ul",
    items: [
      "Account data: email address, username/display name, password (hashed), date of birth (for age verification).",
      "Payment data: handled by our payment processor (Stripe) — we do not store full card numbers. We retain transaction records (amount, date, Diamond package purchased, order ID).",
      "Support communications: anything you send us via support email or in-app reporting (e.g., content reports, refund requests).",
    ],
  },
  { type: "h3", text: "1.2 Information collected automatically" },
  {
    type: "ul",
    items: [
      "Usage data: pages/screens viewed, packs opened, cards collected, missions completed, session duration, feature interactions.",
      "Device & technical data: IP address, browser type, device type, operating system, general location (city/country level, derived from IP).",
      "Cookies & similar technologies: used for login sessions, remembering preferences, and analytics. See Section 6.",
    ],
  },
  { type: "h3", text: "1.3 Information we do not intentionally collect" },
  {
    type: "ul",
    items: [
      "We do not knowingly collect data from users under 18 (see Section 8).",
      "We do not collect precise GPS location.",
      "We do not access your device contacts, camera, or microphone.",
    ],
  },
  { type: "h2", text: "2. How We Use Information" },
  { type: "p", text: "We use collected information to:" },
  {
    type: "ul",
    items: [
      "Create and maintain your account, and authenticate logins;",
      "Process purchases and deliver Diamonds, Card Packs, and collected items;",
      "Operate core gameplay features (Daily Rewards streaks, missions, Continue Collecting progress, Inbox notifications);",
      "Detect and prevent fraud, multi-accounting, and abuse of promotions;",
      "Respond to support requests and refund reviews;",
      "Send service-related communications (e.g., payment failure notices, limited-time drop alerts) via in-Service Inbox and, if you opt in, email;",
      "Improve the Service through aggregated/anonymized analytics;",
      "Comply with legal obligations (e.g., tax records, regulatory odds-disclosure requirements).",
    ],
  },
  {
    type: "p",
    text: "We do not sell your personal information to third parties.",
  },
  {
    type: "h2",
    text: "3. Legal Basis for Processing (where applicable, e.g., GDPR-equivalent frameworks)",
  },
  {
    type: "p",
    text: "Depending on your jurisdiction, we rely on one or more of the following:",
  },
  {
    type: "ul",
    items: [
      "Performance of a contract — to provide the Service you signed up for;",
      "Legitimate interests — fraud prevention, service improvement, security;",
      "Consent — for optional marketing communications and non-essential cookies;",
      "Legal obligation — recordkeeping, tax, and regulatory compliance.",
    ],
  },
  { type: "h2", text: "4. How We Share Information" },
  {
    type: "p",
    text: "We share information only as needed to operate the Service:",
  },
  {
    type: "ul",
    items: [
      "Stripe (payment processor) — Process Diamond purchases: payment details, transaction amount, billing contact.",
      "Cloud hosting / infrastructure providers — Host the Service and store account data: account data, usage data.",
      "Analytics providers — Understand feature usage, improve retention loops: usage data (aggregated where possible).",
      "Legal/regulatory authorities — Comply with law, respond to lawful requests: as required by applicable law.",
    ],
  },
  {
    type: "p",
    text: "We require third-party processors to safeguard your data and use it only for the purposes we specify. We do not share your data with creators/influencers directly — creator content delivery to you does not involve sharing your personal data with the creator.",
  },
  { type: "h2", text: "5. International Data Transfers" },
  {
    type: "p",
    text: "Sugar Scratch operates across Taiwan, Hong Kong, and Southeast Asia (Phase 1), with Japan and North America planned for Phase 2. Your information may be transferred to and processed in a country other than where you live. Where required, we use appropriate safeguards (e.g., standard contractual clauses or equivalent mechanisms) for such transfers.",
  },
  { type: "h2", text: "6. Cookies & Tracking Technologies" },
  { type: "p", text: "We use:" },
  {
    type: "ul",
    items: [
      "Essential cookies — required for login sessions and core functionality (cannot be disabled without breaking the Service).",
      "Preference cookies — remember settings like display mode.",
      "Analytics cookies — help us understand aggregate usage patterns.",
    ],
  },
  {
    type: "p",
    text: "Where required by local law, we will present a cookie consent banner allowing you to manage non-essential cookie preferences.",
  },
  { type: "h2", text: "7. Data Retention" },
  {
    type: "ul",
    items: [
      "Account data: retained while your account is active, and for up to 24 months after closure for fraud and legal purposes, unless a longer period is required by law.",
      "Transaction records: retained as required by applicable tax and financial recordkeeping law.",
      "Support communications: retained for up to 24 months to handle follow-up disputes.",
    ],
  },
  {
    type: "p",
    text: "Upon account deletion, we will delete or anonymize personal data except where retention is required by law (e.g., financial records).",
  },
  { type: "h2", text: "8. Children's Privacy" },
  {
    type: "p",
    text: `Sugar Scratch is intended for users 18 and older (see Terms, Section 1). We do not knowingly collect personal information from anyone under 18. If we become aware that we have collected data from a minor, we will delete the account and associated data promptly. If you believe a minor has provided us data, contact us at ${LEGAL_SUPPORT_EMAIL}.`,
  },
  { type: "h2", text: "9. Your Rights" },
  {
    type: "p",
    text: "Depending on your jurisdiction, you may have the right to:",
  },
  {
    type: "ul",
    items: [
      "Access the personal data we hold about you;",
      "Correct inaccurate data;",
      "Delete your account and associated personal data;",
      "Object to or restrict certain processing (e.g., marketing communications);",
      "Data portability, where applicable;",
      "Withdraw consent at any time for consent-based processing.",
    ],
  },
  {
    type: "p",
    text: `To exercise these rights, contact us at ${LEGAL_PRIVACY_EMAIL}. We may need to verify your identity before fulfilling a request. Note that deleting your account will result in forfeiture of Diamonds, Sugar Coin, and collected items, consistent with the Terms.`,
  },
  { type: "h2", text: "10. Data Security" },
  {
    type: "p",
    text: "We use industry-standard technical and organizational measures (encryption in transit, access controls, hashed passwords) to protect your data. No system is 100% secure; we cannot guarantee absolute security, but we will notify affected users and relevant authorities of any data breach as required by applicable law.",
  },
  { type: "h2", text: "11. Third-Party Links & Creator Content" },
  {
    type: "p",
    text: "The Service may reference or link to creator profiles or external platforms. This Privacy Policy does not cover the privacy practices of third-party sites. Creator photo/video content displayed in the Service is licensed content, not user data, and is governed by our content licensing agreements with creators, not this Policy.",
  },
  { type: "h2", text: "12. Changes to This Policy" },
  {
    type: "p",
    text: "We may update this Privacy Policy from time to time. Material changes will be notified via in-Service notice (e.g., Inbox message) before taking effect. Continued use after changes take effect constitutes acceptance.",
  },
  { type: "h2", text: "13. Contact Us" },
  {
    type: "p",
    text: "For privacy questions, data requests, or complaints:",
  },
  {
    type: "ul",
    items: [LEGAL_PRIVACY_EMAIL, LEGAL_COMPANY_NAME],
  },
  {
    type: "p",
    text: "If you are located in a jurisdiction with a data protection authority, you may also have the right to lodge a complaint with that authority.",
  },
];
