function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, '')
}

export function appendVoiceChunk(base: string, chunk: string): string {
  const trimmed = chunk.trim()
  if (!trimmed) return base
  if (!base) return trimmed

  const normalizedBase = base.trimEnd()
  if (normalizedBase === trimmed) return base
  if (normalizedBase.endsWith(` ${trimmed}`)) return base
  if (normalizedBase.endsWith(trimmed)) return base

  const lastWord = normalizedBase.split(/\s+/).at(-1)
  const chunkWords = trimmed.split(/\s+/)
  if (
    chunkWords.length === 1 &&
    lastWord &&
    normalizeWord(lastWord) === normalizeWord(chunkWords[0] ?? '')
  ) {
    return base
  }

  return `${normalizedBase} ${trimmed}`
}

export function joinVoiceParts(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}
