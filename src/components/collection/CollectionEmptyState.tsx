import { EmptyState } from "@/components/EmptyState";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";

const EMPTY_COLLECTION_ART = "/images/collection/imageEmptyCollection";

function CollectionEmptyArt() {
  return (
    <picture>
      <source
        type="image/jxl"
        srcSet={`${EMPTY_COLLECTION_ART}@1x.jxl 1x, ${EMPTY_COLLECTION_ART}@2x.jxl 2x`}
      />
      <source
        type="image/webp"
        srcSet={`${EMPTY_COLLECTION_ART}@1x.webp 1x, ${EMPTY_COLLECTION_ART}@2x.webp 2x`}
      />
      <img
        className="collection-empty-art"
        src={`${EMPTY_COLLECTION_ART}@1x.png`}
        srcSet={`${EMPTY_COLLECTION_ART}@1x.png 1x, ${EMPTY_COLLECTION_ART}@2x.png 2x`}
        alt=""
        width={354}
        height={330}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}

/** True empty Collection — first-time journey entry. */
export function CollectionEmptyState({
  onExplorePacks,
}: {
  onExplorePacks: () => void;
}) {
  return (
    <EmptyState
      art={<CollectionEmptyArt />}
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
            onClick={onExplorePacks}
          />
        </div>
      }
    />
  );
}
