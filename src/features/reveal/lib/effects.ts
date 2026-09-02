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
    id: 'secret',
    label: 'Secret Rare (Gold)',
    rarity: 'rare secret',
    subtypes: 'basic',
    supertype: 'pokémon',
    types: 'metal',
  },
]

export const VSTAR_EFFECT_INDEX = HOLO_EFFECTS.findIndex((e) => e.id === 'vstar')
export const DEFAULT_EFFECT_INDEX = VSTAR_EFFECT_INDEX >= 0 ? VSTAR_EFFECT_INDEX : 0
export const DEFAULT_MEDIA_URL = '/video/default.mp4'

export const DEMO_CARD_MEDIA = [
  { name: 'Police Woman', mediaUrl: '/video/policewoman.mp4' },
  { name: 'Nurse', mediaUrl: '/video/nurse.mp4' },
  { name: 'Teacher', mediaUrl: '/video/teacher.mp4' },
  { name: 'Gym', mediaUrl: '/video/gym.mp4' },
  { name: 'Firefighter', mediaUrl: '/video/default.mp4' },
] as const
