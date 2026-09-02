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

/** Themes list for motion intro clips (read-only). */
export async function fetchThemes(): Promise<ThemeInfo[]> {
  try {
    const data = await api<{ themes: ThemeInfo[] }>('/api/themes')
    return Array.isArray(data.themes) ? data.themes : []
  } catch {
    return []
  }
}
