export type CharacterId =
  | "policewoman"
  | "nurse"
  | "teacher"
  | "gym"
  | "firefighter";

export type PackFaceSlot = 1 | 2;

export type Character = {
  id: CharacterId;
  name: string;
  videoUrl: string;
  backUrl: string;
  motionVideos: [string, string, string];
};

export const CARD_BACK_URL = "/img/SugarScratch.png";
export const MOTION_VIDEO_COUNT = 3;
export const DEFAULT_OVERLAY_BACKGROUND_COLOR = "#5fd0e0";
export const DEFAULT_OVERLAY_BACKGROUND_COLOR_END = "#0b1c24";

export type SharedMedia = {
  girlName: string;
  influencerCity: string;
  influencerCountry: string;
  flagEmoji: string;
  flagSvgUrl: string;
  overlayBackgroundColor: string;
  overlayBackgroundColorEnd: string;
};

const ROLES: Character[] = [
  {
    id: "policewoman",
    name: "Police Woman",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
  },
  {
    id: "nurse",
    name: "Nurse",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
  },
  {
    id: "teacher",
    name: "Teacher",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
  },
  {
    id: "gym",
    name: "Gym",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
  },
  {
    id: "firefighter",
    name: "Firefighter",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
  },
];

export const CHARACTER_IDS = ROLES.map((role) => role.id);

export const CHARACTER_BY_ID: Record<CharacterId, Character> = ROLES.reduce(
  (acc, role) => {
    acc[role.id] = role;
    return acc;
  },
  {} as Record<CharacterId, Character>,
);

export function isCharacterId(
  value: string | null | undefined,
): value is CharacterId {
  return !!value && value in CHARACTER_BY_ID;
}

export function formatCharacterDisplayName(
  roleName: string,
  girlName?: string | null,
): string {
  const girl = (girlName ?? "").trim();
  const role = (roleName ?? "").trim();
  if (!girl) return role || "Card";
  if (!role) return girl;
  if (role.toLowerCase() === girl.toLowerCase()) return girl;
  if (role.toLowerCase().startsWith(`${girl.toLowerCase()} `)) return role;
  return `${girl} ${role}`;
}

export function revealCardId(characterId: CharacterId, slot: number): string {
  return `reveal-${characterId}-${slot}`;
}

const CARD_NUMBER_PREFIX: Record<CharacterId, string> = {
  policewoman: "P",
  nurse: "N",
  teacher: "T",
  gym: "G",
  firefighter: "F",
};

export function formatCardNumber(
  category: CharacterId | string | null | undefined,
  slotIndex: number,
): string {
  const n = Math.max(1, Math.floor(slotIndex) + 1);
  const padded = String(n).padStart(2, "0");
  const prefix =
    category && category in CARD_NUMBER_PREFIX
      ? CARD_NUMBER_PREFIX[category as CharacterId]
      : "";
  return `${prefix}${padded}`;
}

export function packIdFor(ownerId: string, slot: PackFaceSlot = 1): string {
  const key = ownerId.trim().toLowerCase();
  return slot === 2 ? `pack-${key}-2` : `pack-${key}`;
}

export function parsePackId(packId: string): {
  ownerId: string;
  characterId: CharacterId | null;
  slot: PackFaceSlot;
} | null {
  const match = /^pack-([a-z0-9][a-z0-9_-]*)(?:-(2))?$/i.exec(packId.trim());
  if (!match) return null;
  const ownerId = match[1]!.toLowerCase();
  return {
    ownerId,
    characterId: isCharacterId(ownerId) ? ownerId : null,
    slot: match[2] === "2" ? 2 : 1,
  };
}

export function characterIdFromPackId(packId: string): CharacterId | null {
  return parsePackId(packId)?.characterId ?? null;
}

export function ownerIdFromPackId(packId: string): string | null {
  return parsePackId(packId)?.ownerId ?? null;
}
