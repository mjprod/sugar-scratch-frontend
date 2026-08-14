import { ChevronLeft } from "lucide-react";

export function CreatorHeader({
  name,
  coverUrl,
  onBack,
}: {
  name: string;
  coverUrl: string;
  onBack: () => void;
}) {
  return (
    <header className="cpv2-header">
      <div className="cpv2-header-hero">
        <img src={coverUrl} alt="" className="size-full object-cover object-top" />
        <div className="cpv2-header-shade" />
        <button
          type="button"
          aria-label="Back to Home"
          onClick={onBack}
          className="cpv2-back"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="cpv2-header-copy">
          <h1 className="cpv2-title">{name}</h1>
          <p className="cpv2-subtitle">All Collections</p>
        </div>
      </div>
    </header>
  );
}
