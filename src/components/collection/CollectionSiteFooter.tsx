import { useNavigate } from "react-router-dom";
import { HomeSiteFooter } from "@/components/home/HomeSiteFooter";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useWallet } from "@/contexts/WalletContext";
import { Paths } from "@/routes/Paths";
import "@/components/creator/creator-influencer.css";

/** Collection-only diamonds CTA, then the shared site footer. */
export function CollectionSiteFooter() {
  const navigate = useNavigate();
  const { diamonds } = useWallet();

  return (
    <>
      {diamonds < 10 ? (
        <button
          type="button"
          className="cpv2-diamonds-cta mc-diamonds-cta"
          onClick={() => navigate(Paths.store)}
        >
          <span className="cpv2-diamonds-cta-title">Running low on Diamonds?</span>
          <span className="cpv2-diamonds-cta-btn">
            <DiamondLottie size={14} aria-hidden />
            Get Diamonds
          </span>
          <span className="cpv2-diamonds-orb is-a" aria-hidden="true">
            <DiamondLottie size={34} aria-hidden />
          </span>
          <span className="cpv2-diamonds-orb is-b" aria-hidden="true">
            <DiamondLottie size={24} aria-hidden />
          </span>
        </button>
      ) : null}

      <HomeSiteFooter />
    </>
  );
}
