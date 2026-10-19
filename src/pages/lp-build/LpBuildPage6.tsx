import { LpBuildShell } from "@/pages/lp-build/LpBuildShell";

export function LpBuildPage6() {
  return (
    <LpBuildShell>
      <div className="lp-build-page6">
        <div className="lp-build-page6-body">
          <div className="lp-build-page6-message">
            <div className="lp-build-page3-headline">Submitted!</div>
            <div className="lp-build-copy-wrap lp-build-page6-copy">
              <img
                src="/svg/scratchHeartBg.svg"
                alt=""
                className="lp-build-copy-heart"
                aria-hidden="true"
                draggable={false}
              />
              <p className="lp-build-copy">
                Your account manger{" "}
                <span className="lp-build-username">Jorlyn</span> will contact you
                in the next 24 hours.
              </p>
            </div>
          </div>
          <p className="lp-build-page6-contact">
            Any questions? <a href="mailto:hello@sugarscratch.com">Email Us</a>
          </p>
        </div>
      </div>
    </LpBuildShell>
  );
}
