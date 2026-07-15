const SAVE_KEYWORDS = new Set([
  'sauvegarder',
  'sauvegarde',
  'enregistrer',
  'enregistre',
])

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/g, '')
}

export function extractSaveCommand(text: string): { content: string; shouldSave: boolean } {
  const trimmed = text.trim()
  if (!trimmed) {
    return { content: '', shouldSave: false }
  }

  const words = trimmed.split(/\s+/)
  const lastWord = normalize(words[words.length - 1] ?? '')

  if (SAVE_KEYWORDS.has(lastWord)) {
    const content = words.slice(0, -1).join(' ').trim()
    return { content, shouldSave: content.length > 0 }
  }

  return { content: trimmed, shouldSave: false }
}
