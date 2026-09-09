import { ChevronLeft } from "lucide-react";
import {
  PRIVACY_BLOCKS,
  PRIVACY_TITLE,
  TERMS_BLOCKS,
  TERMS_TITLE,
  type LegalBlock,
} from "@/content/legalDocs";
import { SubpageHeader } from "@/components/SubpageHeader";

type LegalDocKind = "terms" | "privacy";

/** Shared Terms / Privacy surface — Create Account + Profile use the same content. */
export function LegalDocPanel({
  kind,
  titleId,
  onBack,
  /** `page` uses the shared inner-page header; `sheet` keeps auth chrome. */
  variant = "sheet",
  backLabel = "Back",
}: {
  kind: LegalDocKind;
  titleId?: string;
  onBack: () => void;
  variant?: "sheet" | "page";
  backLabel?: string;
}) {
  const title = kind === "terms" ? TERMS_TITLE : PRIVACY_TITLE;
  const blocks = kind === "terms" ? TERMS_BLOCKS : PRIVACY_BLOCKS;

  if (variant === "page") {
    return (
      <div className="auth7-legal-doc auth7-legal-doc--page">
        <SubpageHeader
          title={title}
          onBack={onBack}
          backLabel={backLabel}
        />
        <div
          id={titleId}
          className="auth7-legal-body"
          role="region"
          aria-label={title}
        >
          {blocks.map(renderBlock)}
        </div>
      </div>
    );
  }

  return (
    <div className="auth7-legal-doc">
      <button
        type="button"
        className="auth7-sheet-back"
        aria-label={backLabel}
        onClick={onBack}
      >
        <ChevronLeft className="size-5" strokeWidth={2} aria-hidden="true" />
      </button>
      <h2 id={titleId} className="auth7-sheet-title">
        {title}
      </h2>
      <div className="auth7-legal-body">{blocks.map(renderBlock)}</div>
    </div>
  );
}

function renderBlock(block: LegalBlock, index: number) {
  switch (block.type) {
    case "meta":
      return (
        <p key={index} className="auth7-legal-meta">
          {block.text}
        </p>
      );
    case "lede":
      return (
        <p key={index} className="auth7-legal-lede">
          {block.text}
        </p>
      );
    case "h2":
      return (
        <h3 key={index} className="auth7-legal-h2">
          {block.text}
        </h3>
      );
    case "h3":
      return (
        <h4 key={index} className="auth7-legal-h3">
          {block.text}
        </h4>
      );
    case "p":
      return (
        <p key={index} className="auth7-legal-p">
          {block.text}
        </p>
      );
    case "note":
      return (
        <p key={index} className="auth7-legal-note">
          {block.text}
        </p>
      );
    case "ul":
      return (
        <ul key={index} className="auth7-legal-ul">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}
