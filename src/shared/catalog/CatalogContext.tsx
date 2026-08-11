export type SharedMedia = {
  girlName: string;
  influencerCity: string;
  influencerCountry: string;
  flagEmoji: string;
  flagSvgUrl: string;
  overlayBackgroundColor: string;
  overlayBackgroundColorEnd: string;
};

const EMPTY_SHARED: SharedMedia = {
  girlName: "",
  influencerCity: "",
  influencerCountry: "",
  flagEmoji: "",
  flagSvgUrl: "",
  overlayBackgroundColor: "#5fd0e0",
  overlayBackgroundColorEnd: "#0b1c24",
};

export function useCatalog() {
  return {
    characters: [] as const,
    resolveProductSharedMedia: (_modelId?: string | null) => EMPTY_SHARED,
  };
}
