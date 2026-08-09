/**
 * Cold-start Preference entry — only when behaviour has not already answered.
 * Never inserted between Authentication and a pending purchase.
 */
export function PersonalizationPrompt({
  onStart,
  onLater,
}: {
  onStart: () => void;
  onLater: () => void;
}) {
  return (
    <div
      className="auth7-persona-prompt"
      role="dialog"
      aria-label="Find more creators you'll love"
    >
      <div className="auth7-persona-prompt-copy">
        <p className="auth7-persona-prompt-title">
          Find More Creators You&apos;ll Love
        </p>
        <p className="auth7-persona-prompt-text">
          Swipe through a few Creators and Themes so we can recommend Packs
          you&apos;re more likely to enjoy.
        </p>
      </div>
      <div className="auth7-persona-prompt-actions">
        <button
          type="button"
          className="auth7-persona-prompt-start"
          onClick={onStart}
        >
          Start
        </button>
        <button
          type="button"
          className="auth7-persona-prompt-later"
          onClick={onLater}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
