import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { LoadingLabel } from "@/components/LoadingLabel";
import { SubpageHeader } from "@/components/SubpageHeader";
import type { LegalBlock } from "@/content/legalDocs";
import { PRIVACY_TITLE, TERMS_TITLE } from "@/content/legalTitles";

type LegalDocKind = "terms" | "privacy";

type LegalBlocks = Record<LegalDocKind, LegalBlock[]>;

let legalBlocksCache: LegalBlocks | null = null;

function loadLegalBlocks(): Promise<LegalBlocks> {
  if (legalBlocksCache) return Promise.resolve(legalBlocksCache);
  return import("@/content/legalDocs").then((m) => {
    legalBlocksCache = { terms: m.TERMS_BLOCKS, privacy: m.PRIVACY_BLOCKS };
    return legalBlocksCache;
  });
}

function useLegalBlocks(kind: LegalDocKind) {
  const [loaded, setLoaded] = useState<LegalBlocks | null>(legalBlocksCache);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (loaded) return;
    let alive = true;
    loadLegalBlocks().then(
      (blocks) => {
        if (alive) setLoaded(blocks);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [loaded]);
  return { blocks: loaded ? loaded[kind] : null, failed };
}

/** Browsers cache a failed dynamic import, so only a reload can retry it. */
function LegalLoadError() {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="auth7-legal-p">
        This document didn&apos;t load. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[14px] font-medium text-white transition hover:bg-white/15 active:scale-95"
      >
        Reload
      </button>
    </div>
  );
}

/** Shared Terms / Privacy surface — Create Account + Profile use the same content. */
export function LegalDocPanel({
  kind,
  titleId,
  onBack,
  /** `sheet` = auth modal chrome; `page` = SubpageHeader like Settings / Edit Profile. */
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
  const { blocks, failed } = useLegalBlocks(kind);
  const body = (
    <div className="auth7-legal-body">
      {blocks ? (
        blocks.map(renderBlock)
      ) : failed ? (
        <LegalLoadError />
      ) : (
        <LoadingLabel />
      )}
    </div>
  );

  if (variant === "page") {
    return (
      <div className="settings-legal-doc">
        <SubpageHeader
          title={title}
          titleId={titleId}
          onBack={onBack}
          backLabel={backLabel}
        />
        {body}
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
      {body}
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
