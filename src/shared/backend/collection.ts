import { apiFetch } from '@/lib/api'
import {
  fetchModels as fetchServiceModels,
  type BackendModel as ServiceBackendModel,
} from '@/services/models'
import {
  CHARACTER_IDS,
  formatCharacterDisplayName,
  type CharacterId,
} from '@/shared/catalog/characters'

const CARDS_PER_GROUP = 3

/** Map backend labels/ids onto the five pack-fan role slots. */
const ROLE_MATCHERS: { id: CharacterId; patterns: RegExp[] }[] = [
  { id: 'policewoman', patterns: [/cop/, /police/] },
  { id: 'nurse', patterns: [/nurse/] },
  { id: 'teacher', patterns: [/teacher/] },
  { id: 'gym', patterns: [/gym/] },
  { id: 'firefighter', patterns: [/fire/, /firegirl/, /firefighter/] },
]

/** API theme_id → pack-fan role (one motion card per theme in the shuffler). */
const THEME_ID_TO_ROLE: Record<string, CharacterId> = {
  police: 'policewoman',
  cop: 'policewoman',
  nurse: 'nurse',
  teacher: 'teacher',
  gym: 'gym',
  firefighter: 'firefighter',
  firegirl: 'firefighter',
  fire: 'firefighter',
}

export type BackendModel = {
  id: string
  label: string
  avatar: string | null
  /** Unix timestamp (seconds) from `/api/models` when present. */
  created_at?: number | null
  /** Display name for card-face overlays (e.g. "Juliana"). */
  influencerName?: string | null
  influencerCity?: string | null
  influencerCountry?: string | null
  /** Flag emoji when no SVG is uploaded. */
  influencerFlag?: string | null
  /** Uploaded SVG flag URL, e.g. "/models/julianaval/flag.svg". */
  influencerFlagSvg?: string | null
  cardOverlayColorStart?: string | null
  cardOverlayColorEnd?: string | null
  /** Pack-stage key light 1 colour (maps to Key 2 + Key 3 in Three.js rig). */
  cardLightColor1?: string | null
  /** Pack-stage key light 2 colour (maps to Key 1 / primary key). */
  cardLightColor2?: string | null
  /** Product label for foil pack 1 (replaces "Pack Nº …" when set). */
  cardPackName?: string | null
  /** Product label for foil pack 2. */
  cardPackName2?: string | null
  /** Foil 3D pack video 1, e.g. "/models/julianaval/pack-face.mp4". */
  packFaceVideoUrl?: string | null
  packFaceVideoUrl2?: string | null
  swipeVideoUrl?: string | null
  /** theme_id → public URL for model×theme collection avatar. */
  theme_avatars?: Record<string, string> | null
  /** Freeform labels for dashboard filtering. */
  tags?: string[]
}

export type BackendCard = {
  id: string
  label: string
  background: string
  foreground: string
  model_id: string | null
  sort_order: number
  photo_scratch_done: number
  theme_id?: string | null
  trailer?: string | null
}

/** One published motion card usable in the pack-open fan. */
export type BackendFanCard = {
  id: string
  label: string
  videoUrl: string
  characterId: CharacterId
  modelId: string
  sortOrder: number
}

export type BackendFanCatalog = {
  /** Cards grouped by role, sorted by sort_order within each role. */
  byRole: Partial<Record<CharacterId, BackendFanCard[]>>
  /** Flat list of every published motion card with a known role. */
  cards: BackendFanCard[]
}

type VideoFlow = {
  card_id: string
  draft?: {
    theme?: string
  }
}

export type BackendPhotoScratchSlot = {
  id: string
  background?: string | null
  bikini?: string | null
  clothes?: string | null
  pending_bg?: string | null
  pending_bikini?: string | null
  pending_clothes?: string | null
  clothes_cutout?: string | null
  bikini_cutout?: string | null
}

export type BackendCollectionCard = {
  id: string
  label: string
  videoUrl: string
  /** Collection trailer preview when uploaded (preferred card-face media). */
  trailerUrl?: string | null
  photoScratchDone: number
  /** Fixed 10-slot grid (empty string = unfilled). */
  photoUrls: string[]
}

export type BackendCollectionGroup = {
  id: string
  modelId: string
  title: string
  /**
   * Canonical theme label from the API (e.g. "Police", "Nurse"), optionally
   * composed as "{Model Name} {Theme}" for collection headings.
   */
  themeName?: string | null
  themeId?: string | null
  avatarUrl?: string | null
  cardOverlayColorStart?: string | null
  cardOverlayColorEnd?: string | null
  cardLightColor1?: string | null
  cardLightColor2?: string | null
  cards: BackendCollectionCard[]
}

export type BackendCollectionCatalog = {
  groups: BackendCollectionGroup[]
  /** Theme index for model-scoped pagination (from `/api/collection`). */
  themes?: BackendCollectionTheme[]
}

export type BackendCollectionTheme = {
  id: string
  label: string
  modelId: string
}

export type FetchCollectionOptions = {
  catalogGirlName?: string
  modelId?: string | null
  /** Load only this theme page; response still includes full `themes` index. */
  themeId?: string | null
}

/** Known API theme_id → display label used on collection group headings. */
const THEME_ID_LABELS: Record<string, string> = {
  police: 'Police',
  cop: 'Police',
  nurse: 'Nurse',
  teacher: 'Teacher',
  gym: 'Gym',
  firefighter: 'Firefighter',
  firegirl: 'Firegirl',
  fire: 'Firegirl',
}

/** Map free-text / card-id hints onto canonical theme ids used by the API. */
const THEME_HINT_TO_ID: Record<string, string> = {
  police: 'police',
  cop: 'police',
  nurse: 'nurse',
  teacher: 'teacher',
  gym: 'gym',
  firefighter: 'firegirl',
  firegirl: 'firegirl',
  fire: 'firegirl',
}

/**
 * Infer a collection theme id from a deep-linked card id / label
 * (e.g. `julianaval_cop` → `police`).
 */
export function themeIdFromCardHint(
  cardId: string | null | undefined,
  modelId?: string | null,
): string | null {
  const raw = (cardId ?? '').trim().toLowerCase()
  if (!raw) return null
  const model = (modelId ?? '').trim().toLowerCase()
  const hint =
    model && raw.startsWith(`${model}_`) ? raw.slice(model.length + 1) : raw
  const compact = hint.replace(/[^a-z0-9]+/g, '')
  if (THEME_HINT_TO_ID[compact]) return THEME_HINT_TO_ID[compact]
  for (const [key, id] of Object.entries(THEME_HINT_TO_ID)) {
    if (compact.includes(key) || hint.includes(key)) return id
  }
  return null
}

function titleCaseTheme(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

/** Prefer explicit API theme ids, then role matchers on free text. */
export function themeNameFromApiText(
  raw: string | null | undefined,
): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null

  const key = value.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (THEME_ID_LABELS[key]) return THEME_ID_LABELS[key]

  for (const [id, label] of Object.entries(THEME_ID_LABELS)) {
    if (key === id || key.includes(id)) return label
  }

  for (const role of ROLE_MATCHERS) {
    if (role.patterns.some((pattern) => pattern.test(value.toLowerCase()))) {
      if (role.id === 'policewoman') return 'Police'
      if (role.id === 'firefighter') return 'Firegirl'
      if (role.id === 'gym') return 'Gym'
      if (role.id === 'nurse') return 'Nurse'
      if (role.id === 'teacher') return 'Teacher'
    }
  }

  if (/^motion(?:\s*\d+)?$/i.test(value)) return null
  if (value.length <= 24 && !/\//.test(value)) return titleCaseTheme(value)
  return null
}

function themeNameFromCards(
  cards: Array<Pick<BackendCollectionCard, 'id' | 'label'>>,
  themeByCardId: Map<string, string>,
): string | null {
  for (const card of cards) {
    const fromFlow = themeNameFromApiText(themeByCardId.get(card.id))
    if (fromFlow) return fromFlow
  }
  for (const card of cards) {
    const fromLabel =
      themeNameFromApiText(card.label) ?? themeNameFromApiText(card.id)
    if (fromLabel) return fromLabel
  }
  return null
}

/**
 * Resolve the collection theme label from API signals.
 * Order: explicit themeName → themeId → video-flow/card labels → cleaned title.
 */
export function resolveCollectionGroupThemeName(input: {
  title?: string | null
  themeId?: string | null
  themeName?: string | null
  cards?: Array<Pick<BackendCollectionCard, 'id' | 'label'>>
  themeByCardId?: Map<string, string>
}): string {
  const explicit = themeNameFromApiText(input.themeName)
  if (explicit) return explicit

  const fromId = themeNameFromApiText(input.themeId)
  if (fromId) return fromId

  const fromCards = themeNameFromCards(
    input.cards ?? [],
    input.themeByCardId ?? new Map(),
  )
  if (fromCards) return fromCards

  const title = (input.title ?? '').trim()
  if (title) {
    const parts = title.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const tail = parts.slice(1).join(' ')
      const fromTail = themeNameFromApiText(tail)
      if (fromTail) return fromTail
      if (!/^motion(?:\s*\d+)?$/i.test(tail)) return titleCaseTheme(tail)
    }
    const fromTitle = themeNameFromApiText(title)
    if (fromTitle) return fromTitle
    if (!/^motion(?:\s*\d+)?$/i.test(title)) return title
  }

  return 'Motion'
}

function toCatalogModel(model: ServiceBackendModel): BackendModel | null {
  const id = model.id?.trim()
  if (!id) return null
  return {
    id,
    label: model.label?.trim() || id,
    avatar: model.avatar ?? null,
    created_at: model.created_at,
    influencerName: model.influencerName,
    influencerCity: model.influencerCity,
    influencerCountry: model.influencerCountry,
    influencerFlag: model.influencerFlag,
    influencerFlagSvg: model.influencerFlagSvg,
    cardOverlayColorStart: model.cardOverlayColorStart,
    cardOverlayColorEnd: model.cardOverlayColorEnd,
    cardLightColor1: model.cardLightColor1,
    cardLightColor2: model.cardLightColor2,
    cardPackName: model.cardPackName,
    cardPackName2: model.cardPackName2,
    packFaceVideoUrl: model.packFaceVideoUrl,
    packFaceVideoUrl2: model.packFaceVideoUrl2,
    swipeVideoUrl: model.swipeVideoUrl,
    theme_avatars: model.theme_avatars,
  }
}

/** Single network path: services/models → apiFetch('/api/models'). */
export async function fetchModels(): Promise<BackendModel[] | null> {
  const models = await fetchServiceModels()
  if (!models.length) return null
  const catalog = models
    .map(toCatalogModel)
    .filter((model): model is BackendModel => Boolean(model))
  return catalog.length ? catalog : null
}

export async function fetchCards(): Promise<BackendCard[] | null> {
  const data = await apiFetch<{ cards?: BackendCard[] }>('/api/cards')
  return data && Array.isArray(data.cards) ? data.cards : null
}

export async function fetchVideoFlowThemes(): Promise<Map<string, string>> {
  const data = await apiFetch<{ flows?: VideoFlow[] }>('/api/video-flow')
  const themes = new Map<string, string>()
  if (!data || !Array.isArray(data.flows)) return themes

  for (const flow of data.flows) {
    const cardId = flow.card_id?.trim()
    const theme = flow.draft?.theme?.trim()
    if (cardId && theme) themes.set(cardId, theme)
  }
  return themes
}

async function fetchPhotoScratchSlots(
  cardId: string,
  theme = '',
): Promise<BackendPhotoScratchSlot[]> {
  const params = theme.trim()
    ? `?theme=${encodeURIComponent(theme.trim())}`
    : ''
  const data = await apiFetch<{ slots?: BackendPhotoScratchSlot[] }>(
    `/api/cards/${encodeURIComponent(cardId)}/photo-scratch${params}`,
  )
  return data && Array.isArray(data.slots) ? data.slots : []
}

/** Prefer the clothed full-scene plate (same order as Models dashboard thumbs). */
function slotThumbSrc(slot: BackendPhotoScratchSlot): string {
  return (
    slot.clothes ||
    slot.pending_clothes ||
    slot.bikini ||
    slot.pending_bikini ||
    slot.background ||
    slot.pending_bg ||
    slot.clothes_cutout ||
    slot.bikini_cutout ||
    ''
  )
}

function emptyPhotoUrls(): string[] {
  return Array.from({ length: 10 }, () => '')
}

function photoUrlsFromSlots(slots: BackendPhotoScratchSlot[]): string[] {
  const urls = emptyPhotoUrls()
  for (let i = 0; i < 10; i++) {
    const slot = slots[i]
    if (!slot) continue
    urls[i] = normalizeMediaUrl(slotThumbSrc(slot))
  }
  return urls
}

/**
 * Media paths that Vite proxies to VITE_MEDIA_PROXY (see vite.config.ts).
 * Absolute URLs under these prefixes are rewritten to same-origin paths so
 * Three.js video textures / <img> loads go through the dev proxy (CORS-safe).
 */
const PROXIED_MEDIA_PREFIXES = [
  '/api/',
  '/cards/',
  '/models/',
  '/photo-scratch/',
  '/mesh/',
] as const

function isProxiedMediaPath(pathname: string): boolean {
  return PROXIED_MEDIA_PREFIXES.some(
    (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
  )
}

/**
 * Normalize backend/catalog media into a browser-loadable URL.
 * - Keeps blob: and data: as-is
 * - Strips a leading `public/` (admin/local paths)
 * - Rewrites absolute http(s) URLs whose path is under a Vite media proxy
 *   prefix into same-origin relative paths (so /models/... hits the proxy)
 * - Leaves other absolute URLs untouched
 */
export function normalizeMediaUrl(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw

  // Protocol-relative or absolute http(s) → prefer same-origin proxy path.
  if (/^(?:https?:)?\/\//i.test(raw)) {
    try {
      const absolute = new URL(raw, 'https://placeholder.local')
      const pathWithSearch = `${absolute.pathname}${absolute.search}${absolute.hash}`
      if (isProxiedMediaPath(absolute.pathname)) {
        return pathWithSearch
      }
      // Non-proxied absolute URL (CDN, etc.) — keep fully qualified when possible.
      if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw
      return pathWithSearch
    } catch {
      return raw
    }
  }

  const withoutPublic = raw.replace(/^\.?\/?public\//, '')
  const withSlash = withoutPublic.startsWith('/')
    ? withoutPublic
    : `/${withoutPublic}`
  return withSlash
}

/** Infer pack/collection role from theme_id, then id/label text. */
export function characterIdFromBackendCard(
  card: Pick<BackendCard, 'id' | 'label' | 'theme_id'>,
): CharacterId | null {
  const themeKey = (card.theme_id ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
  if (themeKey && THEME_ID_TO_ROLE[themeKey]) {
    return THEME_ID_TO_ROLE[themeKey]!
  }

  const haystack = `${card.id} ${card.label} ${card.theme_id ?? ''}`.toLowerCase()
  for (const role of ROLE_MATCHERS) {
    if (role.patterns.some((pattern) => pattern.test(haystack))) {
      return role.id
    }
  }
  return null
}

function toBackendFanCard(card: BackendCard): BackendFanCard | null {
  if (!card.model_id) return null
  const characterId = characterIdFromBackendCard(card)
  if (!characterId) return null
  const trailerUrl = normalizeMediaUrl(card.trailer ?? '')
  const motionUrl =
    normalizeMediaUrl(card.foreground) || normalizeMediaUrl(card.background)
  const videoUrl = trailerUrl || motionUrl
  if (!videoUrl) return null
  return {
    id: card.id,
    label: card.label.trim() || card.id,
    videoUrl,
    characterId,
    modelId: card.model_id,
    sortOrder: card.sort_order ?? 0,
  }
}

/**
 * Published motion cards for the pack-open fan (one random pick per role).
 * Returns null when the backend is unreachable.
 */
export async function fetchPackFanCatalog(
  modelId?: string | null,
): Promise<BackendFanCatalog | null> {
  const cards = await fetchCards()
  if (!cards) return null

  const published = cards
    .map(toBackendFanCard)
    .filter((card): card is BackendFanCard => Boolean(card))
    .filter((card) => !modelId || card.modelId === modelId)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    )

  const byRole: Partial<Record<CharacterId, BackendFanCard[]>> = {}
  for (const card of published) {
    const list = byRole[card.characterId] ?? []
    list.push(card)
    byRole[card.characterId] = list
  }

  // Keep role order stable even when some roles are empty.
  for (const id of CHARACTER_IDS) {
    if (!byRole[id]) byRole[id] = []
  }

  return { byRole, cards: published }
}

/** Prefer API influencerName, then model label, then model id. */
function displayModelName(
  model: BackendModel | null | undefined,
  catalogGirlName = '',
): string {
  const fromInfluencer = model?.influencerName?.trim()
  if (fromInfluencer) return fromInfluencer

  const girlName = catalogGirlName.trim()
  if (girlName) return girlName

  const fromLabel = model?.label?.trim()
  if (fromLabel) return fromLabel

  const fromId = model?.id?.trim()
  if (fromId) return fromId

  return ''
}

function safeIdPart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'motion'
  )
}

/** Collection group heading: "{Model Name} {Theme Name}". */
function formatCollectionGroupTitle(
  modelName: string,
  themeName: string,
  part = 1,
): string {
  const theme = part > 1 ? `${themeName} ${part}` : themeName
  return formatCharacterDisplayName(theme, modelName)
}

const COLLECTION_CATALOG_TTL_MS = 60_000
const collectionCatalogCache = new Map<
  string,
  { at: number; value: BackendCollectionCatalog | null }
>()

function collectionCacheKey(opts: FetchCollectionOptions = {}) {
  const girl = (opts.catalogGirlName ?? '').trim().toLowerCase() || '_'
  const model = (opts.modelId ?? '').trim().toLowerCase() || 'all'
  const theme = (opts.themeId ?? '').trim().toLowerCase() || 'all'
  return `${girl}::${model}::${theme}`
}

function modelCacheKey(opts: FetchCollectionOptions = {}) {
  const girl = (opts.catalogGirlName ?? '').trim().toLowerCase() || '_'
  const model = (opts.modelId ?? '').trim().toLowerCase() || 'all'
  return `${girl}::${model}::all`
}

function normalizeCollectionGroup(
  group: BackendCollectionGroup,
): BackendCollectionGroup {
  const themeName =
    resolveCollectionGroupThemeName({
      title: group.title,
      themeId: group.themeId,
      themeName: group.themeName,
      cards: group.cards ?? [],
    }) || group.themeName || null
  return {
    id: group.id,
    modelId: group.modelId,
    title: group.title,
    themeName,
    themeId: group.themeId ?? null,
    avatarUrl: group.avatarUrl
      ? normalizeMediaUrl(group.avatarUrl)
      : null,
    cardOverlayColorStart: group.cardOverlayColorStart ?? null,
    cardOverlayColorEnd: group.cardOverlayColorEnd ?? null,
    cardLightColor1: group.cardLightColor1 ?? null,
    cardLightColor2: group.cardLightColor2 ?? null,
    cards: (group.cards ?? []).map((card) => {
      const photoUrls = Array.isArray(card.photoUrls)
        ? card.photoUrls.map((url) => normalizeMediaUrl(url || ''))
        : emptyPhotoUrls()
      while (photoUrls.length < 10) photoUrls.push('')
      const trailerUrl = card.trailerUrl
        ? normalizeMediaUrl(card.trailerUrl)
        : ''
      const videoUrl = normalizeMediaUrl(card.videoUrl || '')
      return {
        id: card.id,
        label: (card.label || card.id).trim(),
        trailerUrl: trailerUrl || null,
        videoUrl: trailerUrl || videoUrl,
        photoScratchDone: Math.max(
          0,
          Math.min(10, Math.round(card.photoScratchDone ?? 0)),
        ),
        photoUrls: photoUrls.slice(0, 10),
      }
    }),
  }
}

function mergeCollectionCatalogs(
  base: BackendCollectionCatalog | null | undefined,
  page: BackendCollectionCatalog | null | undefined,
): BackendCollectionCatalog | null {
  if (!base && !page) return null
  if (!base) return page ?? null
  if (!page) return base
  const byId = new Map(base.groups.map((group) => [group.id, group] as const))
  for (const group of page.groups) byId.set(group.id, group)
  // Preserve theme index order from either response.
  const themeOrder = page.themes?.length ? page.themes : base.themes
  const themeRank = new Map(
    (themeOrder ?? []).map((theme, index) => {
      const key = `${theme.modelId}::${(theme.id || theme.label).toLowerCase()}`
      return [key, index] as const
    }),
  )
  const groups = Array.from(byId.values()).sort((a, b) => {
    const aKey = `${a.modelId}::${(a.themeId || a.themeName || a.title).toLowerCase()}`
    const bKey = `${b.modelId}::${(b.themeId || b.themeName || b.title).toLowerCase()}`
    const aRank = themeRank.get(aKey) ?? Number.MAX_SAFE_INTEGER
    const bRank = themeRank.get(bKey) ?? Number.MAX_SAFE_INTEGER
    if (aRank !== bRank) return aRank - bRank
    return a.id.localeCompare(b.id)
  })
  return {
    groups,
    themes: themeOrder ?? base.themes ?? page.themes,
  }
}

function rememberCollectionCatalog(
  opts: FetchCollectionOptions,
  value: BackendCollectionCatalog | null,
) {
  const at = performance.now()
  collectionCatalogCache.set(collectionCacheKey(opts), { at, value })
  // Also refresh the merged model-level cache used by peek / full loads.
  if (opts.themeId) {
    const mergedKey = modelCacheKey(opts)
    const existing = collectionCatalogCache.get(mergedKey)
    const merged = mergeCollectionCatalogs(existing?.value, value)
    collectionCatalogCache.set(mergedKey, { at, value: merged })
  } else {
    collectionCatalogCache.set(modelCacheKey(opts), { at, value })
  }
}

/** Sync peek used to avoid a LOADING flash when returning from Play Game. */
export function peekCollectionCatalog(
  catalogGirlName = '',
  modelId?: string | null,
): BackendCollectionCatalog | null | undefined {
  const cached = collectionCatalogCache.get(
    modelCacheKey({ catalogGirlName, modelId }),
  )
  if (!cached) return undefined
  if (performance.now() - cached.at >= COLLECTION_CATALOG_TTL_MS) return undefined
  return cached.value
}

/**
 * Fetch collection groups, optionally scoped to one model / theme page.
 * When `themeId` is set, only that theme's groups are returned (plus `themes` index).
 */
export async function fetchCollectionCatalog(
  catalogGirlNameOrOpts: string | FetchCollectionOptions = '',
  maybeOpts?: Omit<FetchCollectionOptions, 'catalogGirlName'>,
): Promise<BackendCollectionCatalog | null> {
  const opts: FetchCollectionOptions =
    typeof catalogGirlNameOrOpts === 'string'
      ? { catalogGirlName: catalogGirlNameOrOpts, ...maybeOpts }
      : catalogGirlNameOrOpts

  const cacheKey = collectionCacheKey(opts)
  const cached = collectionCatalogCache.get(cacheKey)
  if (cached) {
    const age = performance.now() - cached.at
    const ttl = cached.value ? COLLECTION_CATALOG_TTL_MS : 2_000
    if (age < ttl) return cached.value
  }
  const fromApi = await fetchCollectionCatalogFromApi(opts)
  // Skip legacy photo-scratch waterfall — it hangs when media proxy is down.
  // Creator / collection browse rely on `/api/collection` only.
  const result = fromApi ?? null
  rememberCollectionCatalog(opts, result)
  return result
}

/**
 * Load the focused theme first, then fill remaining themes in the background.
 * `onPage` is called after the first page and again after each merge.
 */
export async function fetchCollectionCatalogPaginated(
  opts: FetchCollectionOptions & {
    onPage?: (catalog: BackendCollectionCatalog) => void
  },
): Promise<BackendCollectionCatalog | null> {
  const { onPage, ...fetchOpts } = opts
  const firstTheme = (fetchOpts.themeId ?? '').trim() || null

  // Warm path: full model catalog already cached.
  const warm = peekCollectionCatalog(fetchOpts.catalogGirlName, fetchOpts.modelId)
  if (warm?.groups.length) {
    onPage?.(warm)
    // Revalidate full catalog in background without blocking first paint.
    void fetchCollectionCatalog({ ...fetchOpts, themeId: null })
    return warm
  }

  // No theme hint → one full request (now cheap after index-only thumbs).
  if (!firstTheme) {
    const all = await fetchCollectionCatalog({ ...fetchOpts, themeId: null })
    if (all) onPage?.(all)
    return all
  }

  const first = await fetchCollectionCatalog({
    ...fetchOpts,
    themeId: firstTheme,
  })
  if (!first) return null
  onPage?.(first)

  const remaining = (first.themes ?? [])
    .map((theme) => theme.id)
    .filter((id) => Boolean(id) && id !== firstTheme)

  if (!remaining.length) return first

  const pages = await Promise.all(
    remaining.map((themeId) =>
      fetchCollectionCatalog({
        ...fetchOpts,
        themeId,
      }),
    ),
  )
  let merged: BackendCollectionCatalog = first
  for (const page of pages) {
    if (!page) continue
    merged = mergeCollectionCatalogs(merged, page) ?? merged
  }
  rememberCollectionCatalog({ ...fetchOpts, themeId: null }, merged)
  onPage?.(merged)
  return merged
}

async function fetchCollectionCatalogFromApi(
  opts: FetchCollectionOptions = {},
): Promise<BackendCollectionCatalog | null> {
  const params = new URLSearchParams()
  const modelId = (opts.modelId ?? '').trim()
  const themeId = (opts.themeId ?? '').trim()
  if (modelId) params.set('model', modelId)
  if (themeId) params.set('theme', themeId)
  const qs = params.toString()
  const data = await apiFetch<{
    groups?: BackendCollectionGroup[]
    themes?: BackendCollectionTheme[]
  }>(`/api/collection${qs ? `?${qs}` : ''}`)
  if (!data || !Array.isArray(data.groups)) return null

  // Prefer the API's already-themed groups (titles + avatars + photoUrls).
  // Avoid re-fetching cards / video-flow / models — those were dominating TTI.
  const groups = data.groups.map(normalizeCollectionGroup)
  return {
    groups,
    themes: Array.isArray(data.themes) ? data.themes : undefined,
  }
}

export async function fetchCollectionCatalogLegacy(
  catalogGirlName = '',
): Promise<BackendCollectionCatalog | null> {
  const [models, cards, themes] = await Promise.all([
    fetchModels(),
    fetchCards(),
    fetchVideoFlowThemes(),
  ])
  if (!models || !cards) return null

  const publishedCards = cards.filter((card) => card.model_id)
  const photosByCardId = new Map<string, string[]>()
  for (const card of publishedCards) {
    const theme = themes.get(card.id) || ''
    const slots = await fetchPhotoScratchSlots(card.id, theme)
    photosByCardId.set(card.id, photoUrlsFromSlots(slots))
  }

  const groups: BackendCollectionGroup[] = []
  for (const model of models) {
    const modelCards = cards
      .filter((card) => card.model_id === model.id)
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.label.localeCompare(b.label),
      )
    const cardsByTheme = new Map<string, BackendCard[]>()
    for (const card of modelCards) {
      // Prefer video-flow theme, then theme_id, then label inference — never a
      // generic local "Motion" bucket when the API gives a real theme signal.
      const theme =
        themeNameFromApiText(themes.get(card.id)) ||
        themeNameFromApiText(card.theme_id) ||
        themeNameFromApiText(card.label) ||
        themeNameFromApiText(card.id) ||
        'Motion'
      const themedCards = cardsByTheme.get(theme) ?? []
      themedCards.push(card)
      cardsByTheme.set(theme, themedCards)
    }

    const modelName = displayModelName(model, catalogGirlName)
    for (const [theme, themedCards] of cardsByTheme) {
      for (let offset = 0; offset < themedCards.length; offset += CARDS_PER_GROUP) {
        const part = offset / CARDS_PER_GROUP + 1
        // "{Model Name} {Theme Name}" from the API (e.g. "Juliana Police").
        const title = formatCollectionGroupTitle(modelName, theme, part)
        const themeId =
          themedCards.find((card) => card.theme_id)?.theme_id ??
          Object.entries(THEME_ID_LABELS).find(
            ([, label]) => label.toLowerCase() === theme.toLowerCase(),
          )?.[0] ??
          null
        const avatarUrl = themeId
          ? normalizeMediaUrl(model.theme_avatars?.[themeId] ?? '')
          : ''
        groups.push({
          id: `${safeIdPart(model.id)}-${safeIdPart(theme)}-${part}`,
          modelId: model.id,
          title,
          themeName: title,
          themeId,
          avatarUrl: avatarUrl || null,
          cards: themedCards
            .slice(offset, offset + CARDS_PER_GROUP)
            .map((card) => {
              const photoUrls =
                photosByCardId.get(card.id) ?? emptyPhotoUrls()
              const filled = photoUrls.filter(Boolean).length
              const trailerUrl = normalizeMediaUrl(card.trailer ?? '')
              const motionUrl =
                normalizeMediaUrl(card.foreground) ||
                normalizeMediaUrl(card.background)
              return {
                id: card.id,
                label: card.label,
                trailerUrl: trailerUrl || null,
                // Prefer trailer for collection face; fall back to motion clips.
                videoUrl: trailerUrl || motionUrl,
                photoScratchDone: Math.max(
                  0,
                  Math.min(
                    10,
                    Math.round(card.photo_scratch_done ?? filled),
                  ),
                ),
                photoUrls,
              }
            }),
        })
      }
    }
  }

  return { groups }
}
