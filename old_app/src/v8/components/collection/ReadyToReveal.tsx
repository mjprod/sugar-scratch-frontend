import { useMemo, useState } from "react";
import {
  PENDING_CONTENT,
  SCRATCH_READY_GROUPS,
  UNOPENED_PACKS,
  type ScratchReadyGroup,
  type UnopenedPack,
} from "../../flow/collection";

type ReadySegment = "packs" | "scratch";

export function ReadyToReveal({
  onOpenPack,
  onScratch,
  onExplorePacks,
}: {
  onOpenPack: (pack: UnopenedPack) => void;
  onScratch: (group: ScratchReadyGroup) => void;
  onExplorePacks: () => void;
}) {
  const packs = UNOPENED_PACKS;
  const scratches = SCRATCH_READY_GROUPS;
  const packCount = PENDING_CONTENT.unopenedPacks;
  const scratchCount = PENDING_CONTENT.scratchCards;
  const empty = packCount === 0 && scratchCount === 0;

  const defaultSegment = useMemo<ReadySegment>(() => {
    if (scratchCount > 0) return "scratch";
    if (packCount > 0) return "packs";
    return "packs";
  }, [packCount, scratchCount]);

  const [segment, setSegment] = useState<ReadySegment>(defaultSegment);

  if (empty) {
    return (
      <section className="collection-section" aria-labelledby="ready-heading">
        <SectionIntro
          id="ready-heading"
          title="Ready to Reveal"
          description="Items waiting for you to reveal their magic."
        />
        <div className="collection-empty-panel">
          <h3 className="collection-empty-title">Everything is revealed</h3>
          <p className="collection-empty-copy">
            Explore more creator packs to continue your collection.
          </p>
          <button type="button" className="collection-cta" onClick={onExplorePacks}>
            Explore Packs
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="collection-section" aria-labelledby="ready-heading">
      <SectionIntro
        id="ready-heading"
        title="Ready to Reveal"
        description="Items waiting for you to reveal their magic."
      />

      <div className="collection-segment" role="tablist" aria-label="Pending type">
        <button
          type="button"
          role="tab"
          aria-selected={segment === "packs"}
          className={["collection-segment-btn", segment === "packs" ? "is-active" : ""].join(
            " ",
          )}
          onClick={() => setSegment("packs")}
        >
          Unopened Packs
          <span className="collection-segment-count">{packCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={segment === "scratch"}
          className={[
            "collection-segment-btn",
            segment === "scratch" ? "is-active" : "",
          ].join(" ")}
          onClick={() => setSegment("scratch")}
        >
          Scratch Cards
          <span className="collection-segment-count">{scratchCount}</span>
        </button>
      </div>

      <div className="collection-h-row" key={segment}>
        {segment === "packs"
          ? packs.map((pack) => (
              <article key={pack.id} className="ready-pack-card">
                <div className="ready-pack-art">
                  <img src={pack.coverUrl} alt="" className="size-full object-cover" />
                </div>
                <div className="ready-pack-body">
                  <h3 className="ready-card-title">{pack.name}</h3>
                  <p className="ready-card-meta">by {pack.creator}</p>
                  <p className="ready-card-qty">
                    {pack.count} {pack.count === 1 ? "Pack" : "Packs"}
                  </p>
                  <button
                    type="button"
                    className="collection-cta ready-card-cta"
                    onClick={() => onOpenPack(pack)}
                  >
                    Open Pack
                  </button>
                </div>
              </article>
            ))
          : scratches.map((group) => (
              <article key={group.id} className="ready-scratch-card">
                <div className="ready-scratch-art">
                  <img src={group.coverUrl} alt="" className="size-full object-cover" />
                </div>
                <div className="ready-pack-body">
                  <h3 className="ready-card-title">{group.creatorName}</h3>
                  <p className="ready-card-meta">{group.collectionName}</p>
                  <p className="ready-card-qty">
                    {group.count} {group.count === 1 ? "Card Ready" : "Cards Ready"}
                  </p>
                  <button
                    type="button"
                    className="collection-cta collection-cta--secondary ready-card-cta"
                    onClick={() => onScratch(group)}
                  >
                    Scratch Now
                  </button>
                </div>
              </article>
            ))}

        <article className="ready-explore-card">
          <p className="ready-card-meta">Need more packs?</p>
          <h3 className="ready-card-title">Explore new collections</h3>
          <button type="button" className="collection-cta-ghost" onClick={onExplorePacks}>
            Explore Packs
          </button>
        </article>
      </div>
    </section>
  );
}

function SectionIntro({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="collection-section-intro">
      <h2 id={id} className="collection-section-title">
        {title}
      </h2>
      <p className="collection-section-copy">{description}</p>
    </div>
  );
}
