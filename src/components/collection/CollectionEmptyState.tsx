import { Layers } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

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
        <button
          type="button"
          className="collection-cta collection-true-empty-cta"
          onClick={onExplorePacks}
        >
          Explore Packs
        </button>
      }
    />
  );
}
