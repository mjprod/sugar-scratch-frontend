/**
 * High-fidelity photo assets for Sugar Scratch v8 prototype.
 * Spec 8 holographic pack art (local) for carousel / collection / splash.
 */

/** Spec 8 holographic / revealed pack covers */
export const HOLO_PACKS = {
  cyberHolo: "/images/packs/cyber-holo.webp",
  cyberRevealed: "/images/packs/cyber-revealed.webp",
  kimonoHolo: "/images/packs/kimono-holo.webp",
  kimonoRevealed: "/images/packs/kimono-revealed.webp",
  idolHolo: "/images/packs/idol-holo.webp",
  idolRevealed: "/images/packs/idol-revealed.webp",
  nurseHolo: "/images/packs/nurse-holo.webp",
  studentHolo: "/images/packs/student-holo.webp",
  mageHolo: "/images/packs/mage-holo.webp",
  cafeHolo: "/images/packs/cafe-holo.webp",
  racingHolo: "/images/packs/racing-holo.webp",
  samuraiHolo: "/images/packs/samurai-holo.webp",
  winterHolo: "/images/packs/winter-holo.webp",
} as const;

export const CREATOR_PHOTOS = {
  emma: {
    avatar: HOLO_PACKS.cyberRevealed,
    portrait: HOLO_PACKS.cyberHolo,
  },
  nancy: {
    avatar: HOLO_PACKS.kimonoRevealed,
    portrait: HOLO_PACKS.kimonoHolo,
  },
  alex: {
    avatar: HOLO_PACKS.idolRevealed,
    portrait: HOLO_PACKS.idolHolo,
  },
  sam: {
    avatar: HOLO_PACKS.nurseHolo,
    portrait: HOLO_PACKS.racingHolo,
  },
} as const;

/** Pack cover art — holographic Spec 8 assets */
export const PACK_PHOTOS: Record<string, string> = {
  ep1: HOLO_PACKS.cyberHolo,
  ep2: HOLO_PACKS.cyberRevealed,
  ep3: HOLO_PACKS.kimonoHolo,
  en1: HOLO_PACKS.kimonoRevealed,
  en2: HOLO_PACKS.idolHolo,
  eb1: HOLO_PACKS.idolRevealed,
  eb2: HOLO_PACKS.nurseHolo,
  em1: HOLO_PACKS.studentHolo,
  nl1: HOLO_PACKS.mageHolo,
  nl2: HOLO_PACKS.cafeHolo,
  np1: HOLO_PACKS.racingHolo,
  al1: HOLO_PACKS.samuraiHolo,
  al2: HOLO_PACKS.winterHolo,
  aa1: HOLO_PACKS.idolHolo,
  sw1: HOLO_PACKS.kimonoHolo,
};

export const SPLASH_PHOTOS = [
  HOLO_PACKS.cyberHolo,
  HOLO_PACKS.samuraiHolo,
  HOLO_PACKS.racingHolo,
] as const;

/** Full creator card art (photo + chrome) from FigJam reference */
export const CREATOR_CARD_PHOTOS = {
  juliana: "/images/cards/juliana-card.png",
} as const;

export const PREFERENCE_PHOTOS = [
  CREATOR_CARD_PHOTOS.juliana,
  HOLO_PACKS.kimonoHolo,
  HOLO_PACKS.idolHolo,
  HOLO_PACKS.nurseHolo,
  HOLO_PACKS.studentHolo,
  HOLO_PACKS.mageHolo,
  HOLO_PACKS.racingHolo,
  HOLO_PACKS.samuraiHolo,
] as const;
