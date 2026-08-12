/** Build /collection deep-link that restores model + opened motion card. */
export function collectionReturnHref(model?: string | null, card?: string | null): string {
  const params = new URLSearchParams()
  const modelId = model?.trim()
  const cardId = card?.trim()
  if (modelId) params.set('model', modelId)
  if (cardId) params.set('card', cardId)
  const qs = params.toString()
  return qs ? `/collection?${qs}` : '/collection'
}
