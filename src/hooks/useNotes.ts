import { useCallback, useEffect, useState } from 'react'
import { getAllNotes, initDb } from '../services/notesDb'
import type { Note } from '../types/note'

async function loadNotes(): Promise<Note[]> {
  await initDb()
  return getAllNotes()
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const refreshNotes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadNotes()
      setNotes(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const data = await loadNotes()
        if (!cancelled) {
          setNotes(data)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { notes, loading, refreshNotes }
}
