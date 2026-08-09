import type { ReactNode } from "react";
import { Filter, Search } from "lucide-react";

export function CollectionHeader({
  onSearch,
  onFilter,
}: {
  onSearch: () => void;
  onFilter: () => void;
}) {
  return (
    <header className="collection-header">
      <div className="collection-header-copy">
        <div className="collection-header-title-row">
          <h1 className="collection-title">Collection</h1>
          <div className="collection-header-actions collection-header-actions--mobile">
            <IconAction label="Search Collection" onClick={onSearch}>
              <Search className="size-5" strokeWidth={1.8} />
            </IconAction>
            <IconAction label="Filter Collection" onClick={onFilter}>
              <Filter className="size-5" strokeWidth={1.8} />
            </IconAction>
          </div>
        </div>
        <p className="collection-description">
          Your cards, packs, and collection progress.
        </p>
      </div>
      <div className="collection-header-actions collection-header-actions--desktop">
        <IconAction label="Search Collection" onClick={onSearch}>
          <Search className="size-5" strokeWidth={1.8} />
        </IconAction>
        <IconAction label="Filter Collection" onClick={onFilter}>
          <Filter className="size-5" strokeWidth={1.8} />
        </IconAction>
      </div>
    </header>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="collection-icon-btn"
    >
      {children}
    </button>
  );
}
