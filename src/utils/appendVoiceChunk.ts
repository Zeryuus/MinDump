export function appendVoiceChunk(base: string, chunk: string): string {
  const trimmed = chunk.trim()
  if (!trimmed) return base
  if (!base) return trimmed

  const normalizedBase = base.trimEnd()
  if (normalizedBase.endsWith(trimmed)) return base

  const lastWord = normalizedBase.split(/\s+/).at(-1)
  const chunkWords = trimmed.split(/\s+/)
  if (chunkWords.length === 1 && lastWord === chunkWords[0]) {
    return base
  }

  return `${normalizedBase} ${trimmed}`
}
