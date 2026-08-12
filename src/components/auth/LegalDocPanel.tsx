type LegalDocKind = "terms" | "privacy";

/** Shared Terms / Privacy surface — Create Account + Settings use the same content. */
export function LegalDocPanel({
  kind,
  titleId,
  onBack,
}: {
  kind: LegalDocKind;
  titleId?: string;
  onBack: () => void;
}) {
  const title = kind === "terms" ? "Terms of Service" : "Privacy Policy";

  return (
    <div className="auth7-legal-doc">
      <button type="button" className="auth7-sheet-back" onClick={onBack}>
        Back
      </button>
      <h2 id={titleId} className="auth7-sheet-title">
        {title}
      </h2>
      <p className="auth7-sheet-copy">
        {kind === "terms"
          ? "Review Sugar’s Terms of Service. Your account details stay saved when you return."
          : "Review Sugar’s Privacy Policy. Your account details stay saved when you return."}
      </p>
    </div>
  );
}
