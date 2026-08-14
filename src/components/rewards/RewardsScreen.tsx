import { ChevronRight, ShoppingBag, Zap } from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";

/**
 * Hub — engagement / reward center.
 * Daily reward + events live on Browse; redeem lives on Store.
 */
export function HubScreen({
  onOpenStore,
}: {
  onClaimDaily?: (diamonds: number) => void;
  onOpenStore?: () => void;
  onDiamondReward?: (amount: number) => void;
  onPackReward?: (reward: {
    type: "free_pack";
    packId: string;
    sceneName: string;
    creatorHandle: string;
  }) => { instanceId?: string };
  onOpenPack?: (input: {
    packId: string;
    packName: string;
    creator: string;
    instanceId?: string;
  }) => void;
}) {
  return (
    <AppPageShell aria-label="Store" className="hub-page">
      <h1 className="sr-only">Store</h1>

      <section className="hub-module" aria-labelledby="hub-active-heading">
        <h2 id="hub-active-heading" className="hub-section-label hub-section-label--active">
          <Zap className="size-3.5" aria-hidden="true" />
          Active
        </h2>
        <div className="hub-active-grid hub-active-grid--solo">
          <button type="button" className="hub-feature-tile" onClick={onOpenStore}>
            <span className="hub-feature-tile-icon is-store" aria-hidden="true">
              <ShoppingBag className="size-5" strokeWidth={1.6} />
            </span>
            <span className="hub-feature-tile-copy">
              <span className="hub-feature-tile-title">Store</span>
              <span className="hub-feature-tile-detail">
                Get Diamonds & packs
              </span>
            </span>
            <ChevronRight className="hub-feature-tile-chevron" aria-hidden="true" />
          </button>
        </div>
      </section>
    </AppPageShell>
  );
}
