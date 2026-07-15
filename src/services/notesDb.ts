import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Note } from '../types/note'

interface MinDumpDB extends DBSchema {
  notes: {
    key: string
    value: Note
    indexes: { 'by-createdAt': number }
  }
}

const DB_NAME = 'mindump'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<MinDumpDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MinDumpDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('notes', { keyPath: 'id' })
        store.createIndex('by-createdAt', 'createdAt')
      },
    })
  }
  return dbPromise
}

export async function initDb(): Promise<void> {
  await getDb()
}

export async function getAllNotes(): Promise<Note[]> {
  try {
    const db = await getDb()
    const notes = await db.getAllFromIndex('notes', 'by-createdAt')
    return notes.reverse()
  } catch (error) {
    console.error('Erreur lors du chargement des notes:', error)
    throw error
  }
}

export async function getNote(id: string): Promise<Note | undefined> {
  try {
    const db = await getDb()
    return db.get('notes', id)
  } catch (error) {
    console.error('Erreur lors de la lecture de la note:', error)
    throw error
  }
}

export async function createNote(content: string): Promise<Note> {
  try {
    const db = await getDb()
    const now = Date.now()
    const note: Note = {
      id: crypto.randomUUID(),
      content,
      createdAt: now,
      updatedAt: now,
    }
    await db.put('notes', note)
    return note
  } catch (error) {
    console.error('Erreur lors de la création de la note:', error)
    throw error
  }
}

export async function updateNote(
  id: string,
  partial: Partial<Pick<Note, 'content' | 'reminderAt'>>,
): Promise<Note> {
  try {
    const db = await getDb()
    const existing = await db.get('notes', id)
    if (!existing) {
      throw new Error(`Note introuvable: ${id}`)
    }
    const updated: Note = {
      ...existing,
      ...partial,
      updatedAt: Date.now(),
    }
    if ('reminderAt' in partial && partial.reminderAt === undefined) {
      delete updated.reminderAt
    }
    await db.put('notes', updated)
    return updated
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la note:', error)
    throw error
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('notes', id)
  } catch (error) {
    console.error('Erreur lors de la suppression de la note:', error)
    throw error
  }
}
