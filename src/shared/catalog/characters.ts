export type CharacterId =
  | "policewoman"
  | "nurse"
  | "teacher"
  | "gym"
  | "firefighter";

export type GroupId = "group-1" | "group-2" | "group-3" | "group-4" | "group-5";

export type PackFaceSlot = 1 | 2;

export type MotionVideos = [string, string, string];
export type MotionPhotoUrls = [string[], string[], string[]];

export type Character = {
  id: CharacterId;
  name: string;
  groupId: GroupId;
  videoUrl: string;
  backUrl: string;
  motionVideos: MotionVideos;
  motionPhotoUrls: MotionPhotoUrls;
  giftVideoUrl: string;
  photoUrls?: string[];
  /** Optional role avatar for group strokes / effects. */
  avatarUrl?: string;
};

export const CARD_BACK_URL = "/img/SugarScratch.png";
/** Local fallback when `/api/models` has no swipe video. */
export const DEFAULT_SWIPE_VIDEO_URL = "/assets/juliana/swipe.mp4";
export const PHOTO_SLOT_COUNT = 10;
export const MOTION_VIDEO_COUNT = 3;
export const ROLE_PHOTO_SLOT_COUNT = MOTION_VIDEO_COUNT * PHOTO_SLOT_COUNT;
export const DEFAULT_OVERLAY_BACKGROUND_COLOR = "oklch(0.798 0.104 207.84)";
export const DEFAULT_OVERLAY_BACKGROUND_COLOR_END = "oklch(0.216 0.028 230.24)";

export type SharedMedia = {
  girlName: string;
  influencerCity: string;
  influencerCountry: string;
  flagEmoji: string;
  flagSvgUrl: string;
  overlayBackgroundColor: string;
  overlayBackgroundColorEnd: string;
};

export const DEFAULT_SHARED_MEDIA: SharedMedia = {
  girlName: "",
  influencerCity: "",
  influencerCountry: "",
  flagEmoji: "",
  flagSvgUrl: "",
  overlayBackgroundColor: DEFAULT_OVERLAY_BACKGROUND_COLOR,
  overlayBackgroundColorEnd: DEFAULT_OVERLAY_BACKGROUND_COLOR_END,
};

/** Normalize a social handle for display (ensures a leading @ when non-empty). */
export function formatSocialHandle(raw?: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("@")) return value;
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      const seg = url.pathname.split("/").filter(Boolean).pop() || "";
      if (seg) return `@${seg.replace(/^@/, "")}`;
    }
  } catch {
    // fall through
  }
  return `@${value.replace(/^@+/, "")}`;
}

export function emptyMotionPhotoUrls(): MotionPhotoUrls {
  return [[], [], []];
}

export function padPhotoUrls(
  urls: readonly string[] | undefined | null,
): string[] {
  const next = Array.from({ length: PHOTO_SLOT_COUNT }, () => "");
  if (!urls) return next;
  for (let i = 0; i < PHOTO_SLOT_COUNT; i += 1) {
    next[i] = (urls[i] ?? "").trim();
  }
  return next;
}

export function padMotionPhotoUrls(
  motion: MotionPhotoUrls | undefined | null,
  legacy?: readonly string[] | null,
): MotionPhotoUrls {
  const first = padPhotoUrls(motion?.[0] ?? legacy);
  return [first, padPhotoUrls(motion?.[1]), padPhotoUrls(motion?.[2])];
}

const ROLES: Character[] = [
  {
    id: "policewoman",
    name: "Police Woman",
    groupId: "group-1",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
    motionPhotoUrls: emptyMotionPhotoUrls(),
    giftVideoUrl: "",
  },
  {
    id: "nurse",
    name: "Nurse",
    groupId: "group-2",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
    motionPhotoUrls: emptyMotionPhotoUrls(),
    giftVideoUrl: "",
  },
  {
    id: "teacher",
    name: "Teacher",
    groupId: "group-3",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
    motionPhotoUrls: emptyMotionPhotoUrls(),
    giftVideoUrl: "",
  },
  {
    id: "gym",
    name: "Gym",
    groupId: "group-4",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
    motionPhotoUrls: emptyMotionPhotoUrls(),
    giftVideoUrl: "",
  },
  {
    id: "firefighter",
    name: "Firefighter",
    groupId: "group-5",
    videoUrl: "",
    backUrl: CARD_BACK_URL,
    motionVideos: ["", "", ""],
    motionPhotoUrls: emptyMotionPhotoUrls(),
    giftVideoUrl: "",
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

export const CHARACTER_BY_GROUP_ID: Record<GroupId, Character> = ROLES.reduce(
  (acc, role) => {
    acc[role.groupId] = role;
    return acc;
  },
  {} as Record<GroupId, Character>,
);

export function isCharacterId(
  value: string | null | undefined,
): value is CharacterId {
  return !!value && value in CHARACTER_BY_ID;
}

export function isGroupId(value: string | null | undefined): value is GroupId {
  return (
    value === "group-1" ||
    value === "group-2" ||
    value === "group-3" ||
    value === "group-4" ||
    value === "group-5"
  );
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

export function getMotionVideoList(character: Character): string[] {
  const list = character.motionVideos.map((url) => url.trim()).filter(Boolean);
  if (list.length > 0) return list;
  const swipe = character.videoUrl.trim();
  return swipe ? [swipe] : [];
}

export function getFilledPhotoUrls(
  character: Character,
  motionSlot?: number,
): string[] {
  const groups = padMotionPhotoUrls(
    character.motionPhotoUrls,
    character.photoUrls,
  );
  if (
    typeof motionSlot === "number" &&
    motionSlot >= 0 &&
    motionSlot < MOTION_VIDEO_COUNT
  ) {
    return groups[motionSlot]!.filter(Boolean);
  }
  return groups.flatMap((group) => group.filter(Boolean));
}

export function getRolePhotoFilledCount(character: Character): number {
  return getFilledPhotoUrls(character).length;
}

export function getGiftVideoUrl(character: Character): string {
  return (character.giftVideoUrl ?? "").trim();
}

export function indexCharactersById(
  characters: Character[],
): Record<CharacterId, Character> {
  return characters.reduce(
    (acc, character) => {
      acc[character.id] = character;
      return acc;
    },
    {} as Record<CharacterId, Character>,
  );
}

export function indexCharactersByGroupId(
  characters: Character[],
): Record<GroupId, Character> {
  return characters.reduce(
    (acc, character) => {
      acc[character.groupId] = character;
      return acc;
    },
    {} as Record<GroupId, Character>,
  );
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
