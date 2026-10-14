import { CATALOG_TTL_MS, cachedRequest } from '../../../lib/cachedRequest'
import { api } from '../scratch/api'

export type ThemeInfo = {
  id: string
  label: string
  sort_order: number
  created_at?: number | null
  /** One-time in-game intro clip shared by every motion card in this theme. */
  intro?: string | null
  cardOverlayColorStart?: string | null
  cardOverlayColorEnd?: string | null
  cardLightColor1?: string | null
  cardLightColor2?: string | null
}

/** Theme intro clips are off for performance; flip to re-enable. */
export const THEME_INTROS_ENABLED = false

/** Themes list for motion intro clips (read-only, shared across callers). */
export function fetchThemes(): Promise<ThemeInfo[]> {
  return cachedRequest('/api/themes', CATALOG_TTL_MS, async () => {
    try {
      const data = await api<{ themes: ThemeInfo[] }>('/api/themes')
      return Array.isArray(data.themes) ? data.themes : []
    } catch {
      return []
    }
  })
}
