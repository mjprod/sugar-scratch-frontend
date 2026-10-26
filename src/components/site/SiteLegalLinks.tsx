import { Link } from "react-router-dom";
import { Paths } from "@/routes/Paths";

/** Shared site legal row — Privacy, Support, Terms, then influencer signup. */
export function SiteLegalLinks({
  onPrivacy,
  onTerms,
  className = "home-site-footer-nav",
  linkClassName = "home-site-footer-link",
}: {
  onPrivacy: () => void;
  onTerms: () => void;
  className?: string;
  linkClassName?: string;
}) {
  return (
    <nav className={className} aria-label="Legal">
      <div className="home-site-footer-nav-row">
        <button type="button" className={linkClassName} onClick={onPrivacy}>
          Privacy Policy
        </button>
        <a className={linkClassName} href="mailto:support@sugarscratch.com">
          Support
        </a>
        <button type="button" className={linkClassName} onClick={onTerms}>
          Terms &amp; Conditions
        </button>
      </div>
      <Link className={linkClassName} to={Paths.lpBuild}>
        Sign up as an influencer
      </Link>
    </nav>
  );
}
