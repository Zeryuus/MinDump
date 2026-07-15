function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, '')
}

function normalizePhrase(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function mergeFinalParts(parts: string[]): string {
  let result = ''

  for (const part of parts) {
    const trimmed = normalizePhrase(part)
    if (!trimmed) continue

    if (!result) {
      result = trimmed
      continue
    }

    if (trimmed.startsWith(result) || result.startsWith(trimmed)) {
      result = trimmed.length >= result.length ? trimmed : result
      continue
    }

    result = `${result} ${trimmed}`
  }

  return result
}

export type SpeechResultSlice = {
  isFinal: boolean
  transcript: string
}

export function buildSessionTranscript(results: SpeechResultSlice[]): {
  sessionFinal: string
  interimChunk: string
} {
  const finalParts: string[] = []

  for (const result of results) {
    const transcript = result.transcript.trim()
    if (!transcript) continue
    if (result.isFinal) {
      finalParts.push(transcript)
    }
  }

  let interim = ''
  for (let i = results.length - 1; i >= 0; i--) {
    if (!results[i].isFinal) {
      interim = results[i].transcript.trim()
      break
    }
  }

  return {
    sessionFinal: mergeFinalParts(finalParts),
    interimChunk: interim,
  }
}

export function nonRedundantInterim(sessionFinal: string, interim: string): string {
  const finalText = normalizePhrase(sessionFinal)
  const interimText = normalizePhrase(interim)

  if (!interimText) return ''
  if (!finalText) return interimText
  if (finalText === interimText) return ''
  if (finalText.endsWith(interimText)) return ''

  if (interimText.startsWith(finalText)) {
    return interimText.slice(finalText.length).trim()
  }

  return interimText
}

export function appendVoiceChunk(base: string, chunk: string): string {
  const trimmed = normalizePhrase(chunk)
  if (!trimmed) return base
  if (!base) return trimmed

  const normalizedBase = base.trimEnd()
  if (normalizedBase === trimmed) return base
  if (normalizedBase.endsWith(` ${trimmed}`)) return base
  if (normalizedBase.endsWith(trimmed)) return base

  const merged = mergeFinalParts([normalizedBase, trimmed])
  if (merged === normalizedBase) return base

  const lastWord = normalizedBase.split(/\s+/).at(-1)
  const chunkWords = trimmed.split(/\s+/)
  if (
    chunkWords.length === 1 &&
    lastWord &&
    normalizeWord(lastWord) === normalizeWord(chunkWords[0] ?? '')
  ) {
    return base
  }

  return merged
}

export function joinVoiceParts(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

export function buildVoiceDisplay(
  base: string,
  sessionFinal: string,
  interimChunk: string,
): string {
  const interim = nonRedundantInterim(sessionFinal, interimChunk)
  return joinVoiceParts(base, sessionFinal, interim)
}
