import { X } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";

export function CollectionPlaceholder({
  title,
  detail,
  onClose,
}: {
  title: string;
  detail?: string;
  onClose: () => void;
}) {
  return (
    <div className="collection-placeholder" role="dialog" aria-modal="true" aria-label={title}>
      <div className="collection-placeholder-panel">
        <button
          type="button"
          className="collection-placeholder-close"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
        <h2 className="collection-placeholder-title">{title}</h2>
        {detail ? <p className="collection-placeholder-copy">{detail}</p> : null}
        <div className="collection-cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Back to My Collection"
            costAmount={null}
            fontSize={14}
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  );
}
