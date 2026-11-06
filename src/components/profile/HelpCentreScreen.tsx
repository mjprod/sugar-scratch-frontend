import { useId, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { SubpageHeader } from "@/components/SubpageHeader";
import { useAuthSession } from "@/contexts/useAuth";
import {
  APPLE_REFUND_URL,
  HELP_APP_VERSION,
  HELP_FAQS,
  HELP_LINKS,
  LEGAL_SUPPORT_EMAIL,
  PACK_ODDS_LEDE,
  PACK_ODDS_TIERS,
  RECOVER_PURCHASE_COPY,
  REFUND_APPLE_COPY,
  REFUND_WEB_COPY,
  SUPPORT_TOPICS,
  helpContactPath,
  isSupportTopic,
  type SupportTopic,
} from "@/content/helpCenter";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";
import { getAuthEmail, getAuthUserId } from "@/services/auth";
import { submitSupportRequest } from "@/services/support";

const HELP_CTA = ctaButtonPropsFromTemplate("squircleCTA");

export function HelpCentreScreen() {
  const navigate = useNavigate();
  const { authed } = useAuthSession();
  const goBack = useGoBack(authed ? Paths.settings : Paths.discover);
  const [params, setParams] = useSearchParams();
  const contact = params.get("contact");
  const doc = params.get("doc");
  const topic: SupportTopic = isSupportTopic(contact) ? contact : "other";

  function openContact(next: SupportTopic, transactionRef?: string) {
    const search = new URLSearchParams({ contact: next });
    if (transactionRef) search.set("ref", transactionRef);
    setParams(search, { replace: true });
    document.getElementById("help-contact")?.scrollIntoView({ block: "start" });
  }

  if (doc === "privacy" || doc === "terms") {
    return (
      <AppPageShell
        aria-label={doc === "terms" ? "Terms of Service" : "Privacy Policy"}
        className="app-page-shell--profile help-centre-page"
      >
        <LegalDocPanel
          variant="page"
          kind={doc}
          backLabel="Back to Help Centre"
          onBack={() => setParams({})}
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Help Centre"
      className="app-page-shell--profile help-centre-page"
    >
      <SubpageHeader
        title="Help Centre"
        onBack={goBack}
        backLabel={authed ? "Back to Settings" : "Back"}
      />

      <SupportForm
        topic={topic}
        transactionRef={params.get("ref") ?? ""}
        onTopic={(next) => openContact(next, params.get("ref") ?? undefined)}
      />

      <section className="help-section" aria-labelledby="help-faq">
        <h2 id="help-faq" className="help-section-label">
          FAQs
        </h2>
        <div className="help-card">
          {HELP_FAQS.map((item) => (
            <details key={item.q} className="help-faq">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="help-section" aria-labelledby="help-purchases">
        <h2 id="help-purchases" className="help-section-label">
          Purchases and balances
        </h2>
        <div className="help-card">
          <button
            type="button"
            className="help-link"
            onClick={() => navigate(Paths.transactions)}
          >
            Transaction history
          </button>
          <button
            type="button"
            className="help-link"
            onClick={() => openContact("missing-diamonds")}
          >
            Recover unfinished purchase
          </button>
          <button
            type="button"
            className="help-link"
            onClick={() => navigate(Paths.legalOdds)}
          >
            Pack odds
          </button>
        </div>
        <div className="help-card help-pad">
          <p className="help-copy">{RECOVER_PURCHASE_COPY}</p>
          <p className="help-copy">{REFUND_WEB_COPY}</p>
          <p className="help-copy">
            {REFUND_APPLE_COPY}{" "}
            <a className="help-mailto" href={APPLE_REFUND_URL}>
              Request an Apple refund
            </a>
          </p>
          <button
            type="button"
            className="help-link"
            onClick={() => openContact("refund")}
          >
            Request a refund review
          </button>
        </div>
      </section>

      <section className="help-section" aria-labelledby="help-legal">
        <h2 id="help-legal" className="help-section-label">
          Legal and safety
        </h2>
        <div className="help-card">
          {HELP_LINKS.filter((link) =>
            ["privacy", "terms", "delete", "report"].includes(link.id),
          ).map((link) => (
            <button
              key={link.id}
              type="button"
              className="help-link"
              onClick={() => {
                if (link.id === "privacy") setParams({ doc: "privacy" });
                else if (link.id === "terms") setParams({ doc: "terms" });
                else if (link.id === "delete") navigate(Paths.deleteAccount);
                else openContact("report-content");
              }}
            >
              {link.label}
            </button>
          ))}
        </div>
        <p className="help-copy">
          Or email{" "}
          <a className="help-mailto" href={`mailto:${LEGAL_SUPPORT_EMAIL}`}>
            {LEGAL_SUPPORT_EMAIL}
          </a>
        </p>
      </section>
    </AppPageShell>
  );
}

function SupportForm({
  topic,
  transactionRef,
  onTopic,
}: {
  topic: SupportTopic;
  transactionRef: string;
  onTopic: (topic: SupportTopic) => void;
}) {
  const formId = useId();
  const [email, setEmail] = useState(() => getAuthEmail() ?? "");
  const accountId = getAuthUserId() ?? "";
  const [refSource, setRefSource] = useState(transactionRef);
  const [ref, setRef] = useState(transactionRef);
  const [reportTarget, setReportTarget] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mailto, setMailto] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  if (transactionRef !== refSource) {
    setRefSource(transactionRef);
    setRef(transactionRef);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMailto("");
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Enter the email we should reply to.");
      return;
    }
    if (topic === "report-content" && reportTarget.trim().length < 2) {
      setError("Name the card or creator you are reporting.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Add a few details so we can look this up.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitSupportRequest({
        topic,
        email: trimmedEmail,
        message,
        accountId,
        transactionRef: ref,
        reportTarget,
        appVersion: HELP_APP_VERSION,
      });
      if (!result.ok) {
        setError(result.message);
        setMailto(result.mailto);
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="help-contact" className="help-section" aria-label="Contact">
      {sent ? (
        <div className="help-form-shell">
          <p className="help-copy">
            Message sent. We’ll reply to {email.trim()}.
          </p>
        </div>
      ) : (
        <form
          className="help-form help-form-shell"
          aria-labelledby="help-form-title"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <h2 id="help-form-title" className="help-form-title">
            Having an issue?
          </h2>
          {topic === "missing-diamonds" ? (
            <p className="help-copy">{RECOVER_PURCHASE_COPY}</p>
          ) : null}
          {topic === "refund" ? (
            <>
              <p className="help-copy">{REFUND_WEB_COPY}</p>
              <p className="help-copy">{REFUND_APPLE_COPY}</p>
            </>
          ) : null}
          <div className="auth7-field">
            <label className="auth7-label" htmlFor={`${formId}-topic`}>
              Topic
            </label>
            <select
              id={`${formId}-topic`}
              className="auth7-input"
              value={topic}
              disabled={submitting}
              onChange={(event) => {
                if (isSupportTopic(event.target.value)) onTopic(event.target.value);
              }}
            >
              {SUPPORT_TOPICS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="auth7-field">
            <label className="auth7-label" htmlFor={`${formId}-email`}>
              Email
            </label>
            <input
              id={`${formId}-email`}
              className="auth7-input"
              type="email"
              autoComplete="email"
              value={email}
              disabled={submitting}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <input type="hidden" name="account_id" value={accountId} />
          <input type="hidden" name="app_version" value={HELP_APP_VERSION} />
          <div className="auth7-field">
            <label className="auth7-label" htmlFor={`${formId}-ref`}>
              Transaction reference
            </label>
            <input
              id={`${formId}-ref`}
              className="auth7-input"
              value={ref}
              disabled={submitting}
              autoComplete="off"
              onChange={(event) => setRef(event.target.value)}
            />
          </div>
          {topic === "report-content" ? (
            <div className="auth7-field">
              <label className="auth7-label" htmlFor={`${formId}-report`}>
                Card or creator
              </label>
              <input
                id={`${formId}-report`}
                className="auth7-input"
                value={reportTarget}
                disabled={submitting}
                autoComplete="off"
                onChange={(event) => setReportTarget(event.target.value)}
              />
            </div>
          ) : null}
          <div className="auth7-field">
            <label className="auth7-label" htmlFor={`${formId}-message`}>
              Message
            </label>
            <textarea
              id={`${formId}-message`}
              className="auth7-input"
              value={message}
              disabled={submitting}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          {error ? (
            <p className="auth7-error" role="alert">
              {error}{" "}
              {mailto ? (
                <a className="help-mailto" href={mailto}>
                  Email {LEGAL_SUPPORT_EMAIL}
                </a>
              ) : null}
            </p>
          ) : null}
          <div className="help-cta">
            <CtaButton
              {...HELP_CTA}
              fillParent
              type="submit"
              label={
                submitting
                  ? "Sending…"
                  : topic === "missing-diamonds"
                    ? "Recover unfinished purchase"
                    : "Send message"
              }
              costAmount={null}
              disabled={submitting}
            />
          </div>
          <p className="help-copy">
            You can also email{" "}
            <a className="help-mailto" href={`mailto:${LEGAL_SUPPORT_EMAIL}`}>
              {LEGAL_SUPPORT_EMAIL}
            </a>
            .
          </p>
        </form>
      )}
    </section>
  );
}

export function PackOddsScreen() {
  const navigate = useNavigate();
  const goBack = useGoBack(Paths.help);
  return (
    <AppPageShell
      variant="secondary"
      aria-label="Pack odds"
      className="app-page-shell--profile help-centre-page"
    >
      <SubpageHeader title="Pack odds" onBack={goBack} backLabel="Back" />
      <section className="help-section" aria-labelledby="pack-odds">
        <h2 id="pack-odds" className="help-section-label">
          Before you pay
        </h2>
        <div className="help-card help-pad">
          <p className="help-copy">{PACK_ODDS_LEDE}</p>
        </div>
        <div className="help-card">
          {PACK_ODDS_TIERS.map((tier) => (
            <div key={tier.tier} className="help-odds-tier">
              <strong>{tier.tier}</strong>
              <span>{tier.detail}</span>
            </div>
          ))}
          <button
            type="button"
            className="help-link"
            onClick={() => navigate(helpContactPath("other"))}
          >
            Questions about a pack
          </button>
        </div>
      </section>
    </AppPageShell>
  );
}
