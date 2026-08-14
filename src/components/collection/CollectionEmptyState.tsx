import { Layers } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";

/** True empty Collection — first-time journey entry. */
export function CollectionEmptyState({
  onExplorePacks,
}: {
  onExplorePacks: () => void;
}) {
  return (
    <EmptyState
      icon={Layers}
      title="Start Your Collection"
      titleId="empty-collection-title"
      copy="You don't have any cards or packs yet."
      action={
        <div className="collection-cta collection-true-empty-cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Explore Packs"
            costAmount={null}
            fontSize={14}
            onClick={onExplorePacks}
          />
        </div>
      }
    />
  );
}
