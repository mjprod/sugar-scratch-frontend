export type PackPreviewPoster = {
  src: string;
  alt: string;
};

/** Two creator pack posters, side by side. */
export function PackPreview({
  left,
  right,
  open = true,
}: {
  left: PackPreviewPoster;
  right: PackPreviewPoster;
  /** Fan the second card out. Closed keeps both stacked. */
  open?: boolean;
}) {
  return (
    <div
      className={["pack-preview", open ? "is-open" : ""].filter(Boolean).join(" ")}
      aria-label="Pack preview"
    >
      <img className="pack-preview__poster" src={left.src} alt={left.alt} draggable={false} />
      <img className="pack-preview__poster" src={right.src} alt={right.alt} draggable={false} />
    </div>
  );
}
