import {
  CHARACTER_BY_GROUP_ID,
  CHARACTER_BY_ID,
  getMotionVideoList,
  type Character,
  type GroupId,
} from '@/shared/catalog/characters'

export type HoloEffect = {
  id: string
  label: string
  rarity: string
  subtypes?: string
  supertype?: string
  types?: string
  trainerGallery?: boolean
  masked?: boolean
}

export const HOLO_EFFECTS: HoloEffect[] = [
  {
    id: 'basic',
    label: 'Basic',
    rarity: 'common',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'fire',
  },
  {
    id: 'reverse-holo',
    label: 'Reverse Holo',
    rarity: 'common reverse holo',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'water',
    masked: true,
  },
  {
    id: 'rare-holo',
    label: 'Rare Holo',
    rarity: 'rare holo',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'grass',
  },
  {
    id: 'cosmos',
    label: 'Cosmos / Galaxy',
    rarity: 'rare holo cosmos',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'psychic',
  },
  {
    id: 'amazing',
    label: 'Amazing Rare',
    rarity: 'amazing rare',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'lightning',
  },
  {
    id: 'radiant',
    label: 'Radiant',
    rarity: 'radiant rare',
    subtypes: 'basic radiant',
    supertype: 'pokémon',
    types: 'grass',
  },
  {
    id: 'trainer-gallery',
    label: 'Trainer Gallery Holo',
    rarity: 'rare holo',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'fairy',
    trainerGallery: true,
  },
  {
    id: 'v-regular',
    label: 'Pokemon V',
    rarity: 'rare holo v',
    subtypes: 'basic v',
    supertype: 'pokémon',
    types: 'fire',
  },
  {
    id: 'v-full-art',
    label: 'V Full Art',
    rarity: 'rare ultra',
    subtypes: 'basic v',
    supertype: 'pokémon',
    types: 'water',
  },
  {
    id: 'vmax',
    label: 'VMax',
    rarity: 'rare holo vmax',
    subtypes: 'basic vmax',
    supertype: 'pokémon',
    types: 'grass',
  },
  {
    id: 'vstar',
    label: 'VStar',
    rarity: 'rare holo vstar',
    subtypes: 'basic vstar',
    supertype: 'pokémon',
    types: 'psychic',
  },
  {
    id: 'rainbow',
    label: 'Rainbow Rare',
    rarity: 'rare rainbow',
    subtypes: 'basic vmax',
    supertype: 'pokémon',
    types: 'lightning',
  },
  {
    id: 'rainbow-alt',
    label: 'Rainbow Alt',
    rarity: 'rare rainbow alt',
    subtypes: 'basic vmax',
    supertype: 'pokémon',
    types: 'dragon',
  },
  {
    id: 'secret',
    label: 'Secret Rare (Gold)',
    rarity: 'rare secret',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'metal',
  },
  {
    id: 'shiny',
    label: 'Shiny',
    rarity: 'rare shiny',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'fighting',
  },
  {
    id: 'shiny-v',
    label: 'Shiny V',
    rarity: 'rare shiny v',
    subtypes: 'basic v',
    supertype: 'pokémon',
    types: 'darkness',
  },
  {
    id: 'shiny-vmax',
    label: 'Shiny VMAX',
    rarity: 'rare shiny vmax',
    subtypes: 'basic vmax',
    supertype: 'pokémon',
    types: 'fairy',
  },
]

export const VSTAR_EFFECT_INDEX = HOLO_EFFECTS.findIndex((e) => e.id === 'vstar')

export const VSTAR_EFFECT = HOLO_EFFECTS[VSTAR_EFFECT_INDEX]!

export const DEFAULT_EFFECT_INDEX = VSTAR_EFFECT_INDEX

/** Fallback front media when a group has no themed video. */
export const DEFAULT_MEDIA_URL = '/video/default.mp4'

/**
 * Per-group default front videos under public/video/.
 * Keys match FIXED_GROUPS themes (case-insensitive lookup).
 * Prefer catalog resolvers when a live Character is available.
 */
export const DEFAULT_GROUP_MEDIA_URLS: Record<string, string> = {
  'Police Woman': '/video/policewoman.mp4',
  Nurse: '/video/nurse.mp4',
  Teacher: '/video/teacher.mp4',
  Gym: '/video/gym.mp4',
  Firefighter: '/video/default.mp4',
}

/**
 * Per-group circle avatars for the stroke title (public/img/groups/).
 * Keys match FIXED_GROUPS themes (case-insensitive lookup).
 */
export const DEFAULT_GROUP_AVATAR_URLS: Record<string, string> = {
  'Police Woman': '/img/groups/policewoman.jpg',
  Nurse: '/img/groups/nurse.jpg',
  Teacher: '/img/groups/teacher.jpg',
  Gym: '/img/groups/gym.jpg',
  Firefighter: '/img/groups/default.jpg',
}

export const DEFAULT_GROUP_AVATAR_URL = '/img/imgAvatarDefault.jpg'

function resolveGroupAsset(
  map: Record<string, string>,
  fallback: string,
  groupTheme?: string | null,
  groupId?: string | null,
): string {
  const theme = groupTheme?.trim()
  if (theme) {
    const byTheme = map[theme]
    if (byTheme) return byTheme
    // Case-insensitive fallback for renamed/saved themes that still match.
    const lower = theme.toLowerCase()
    for (const [key, url] of Object.entries(map)) {
      if (key.toLowerCase() === lower) return url
    }
  }

  // Stable id map for the fixed five groups.
  switch (groupId) {
    case 'group-1':
      return map['Police Woman'] ?? fallback
    case 'group-2':
      return map.Nurse ?? fallback
    case 'group-3':
      return map.Teacher ?? fallback
    case 'group-4':
      return map.Gym ?? fallback
    case 'group-5':
      return map.Firefighter ?? fallback
    default:
      return fallback
  }
}

function characterFromGroupId(
  groupId?: string | null,
  catalogByGroupId?: Partial<Record<GroupId, Character>> | Record<string, Character>,
): Character | null {
  if (!groupId) return null
  if (catalogByGroupId) {
    const fromCatalog = (catalogByGroupId as Record<string, Character | undefined>)[
      groupId
    ]
    if (fromCatalog) return fromCatalog
  }
  if (groupId in CHARACTER_BY_GROUP_ID) {
    return CHARACTER_BY_GROUP_ID[groupId as GroupId]
  }
  return null
}

/** Resolve the default front media for a group theme (falls back to DEFAULT_MEDIA_URL). */
export function getDefaultMediaUrlForGroup(
  groupTheme?: string | null,
  groupId?: string | null,
  catalogByGroupId?: Partial<Record<GroupId, Character>> | Record<string, Character>,
): string {
  const character = characterFromGroupId(groupId, catalogByGroupId)
  if (character) {
    const motions = getMotionVideoList(character)
    if (motions[0]) return motions[0]
    if (character.videoUrl.trim()) return character.videoUrl.trim()
  }
  // Theme may match a renamed live catalog name.
  if (groupTheme?.trim() && catalogByGroupId) {
    const lower = groupTheme.trim().toLowerCase()
    for (const character of Object.values(catalogByGroupId)) {
      if (character?.name?.trim().toLowerCase() === lower) {
        const motions = getMotionVideoList(character)
        if (motions[0]) return motions[0]
        if (character.videoUrl.trim()) return character.videoUrl.trim()
      }
    }
  }
  return resolveGroupAsset(
    DEFAULT_GROUP_MEDIA_URLS,
    DEFAULT_MEDIA_URL,
    groupTheme,
    groupId,
  )
}

/** Resolve the circle avatar image for a group stroke title. */
export function getGroupAvatarUrl(
  groupTheme?: string | null,
  groupId?: string | null,
  catalogByGroupId?: Partial<Record<GroupId, Character>> | Record<string, Character>,
  avatarUrl?: string | null,
): string {
  if (avatarUrl?.trim()) return avatarUrl.trim()
  const character = characterFromGroupId(groupId, catalogByGroupId)
  if (character?.avatarUrl?.trim()) return character.avatarUrl.trim()
  if (groupTheme?.trim() && catalogByGroupId) {
    const lower = groupTheme.trim().toLowerCase()
    for (const c of Object.values(catalogByGroupId)) {
      if (c?.name?.trim().toLowerCase() === lower && c.avatarUrl?.trim()) {
        return c.avatarUrl.trim()
      }
    }
  }
  // Also allow matching default CHARACTER names when theme was renamed in admin.
  for (const character of Object.values(CHARACTER_BY_ID)) {
    if (
      groupTheme &&
      character.name.trim().toLowerCase() === groupTheme.trim().toLowerCase() &&
      character.avatarUrl?.trim()
    ) {
      return character.avatarUrl.trim()
    }
  }
  return resolveGroupAsset(
    DEFAULT_GROUP_AVATAR_URLS,
    DEFAULT_GROUP_AVATAR_URL,
    groupTheme,
    groupId,
  )
}

/** True when a URL is one of the known default front videos. */
export function isDefaultMediaUrl(url: string | undefined | null): boolean {
  if (!url) return true
  if (url === DEFAULT_MEDIA_URL) return true
  return Object.values(DEFAULT_GROUP_MEDIA_URLS).includes(url)
}
