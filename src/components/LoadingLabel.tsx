import "./LoadingLabel.css";

export function LoadingLabel() {
  return (
    <div className="loading-label">
      <p className="loading-label__row" aria-label="Loading">
        <span className="loading-label__text">Loading</span>
        <span className="loading-label__dots" aria-hidden>
          <span className="loading-label__dot">.</span>
          <span className="loading-label__dot">.</span>
          <span className="loading-label__dot">.</span>
        </span>
      </p>
    </div>
  );
}
