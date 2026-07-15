import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotes } from '../hooks/useNotes'
import { deleteNote, updateNote } from '../services/notesDb'
import {
  cancelReminder,
  requestNotificationPermission,
  scheduleReminder,
} from '../services/reminderScheduler'
import { formatRelativeDate } from '../utils/formatDate'
import type { Note } from '../types/note'

function toDatetimeLocalValue(timestamp: number): string {
  const date = new Date(timestamp)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function FluxPage() {
  const { notes, loading, refreshNotes } = useNotes()
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editContent, setEditContent] = useState('')
  const [reminderNoteId, setReminderNoteId] = useState<string | null>(null)
  const [reminderValue, setReminderValue] = useState('')
  const [reminderMinValue, setReminderMinValue] = useState('')

  const handleDelete = async (note: Note) => {
    const confirmed = window.confirm('Supprimer cette note définitivement ?')
    if (!confirmed) return

    cancelReminder(note.id)
    await deleteNote(note.id)
    await refreshNotes()
  }

  const handleEditOpen = (note: Note) => {
    setEditingNote(note)
    setEditContent(note.content)
  }

  const handleEditSave = async () => {
    if (!editingNote) return
    const trimmed = editContent.trim()
    if (!trimmed) return

    await updateNote(editingNote.id, { content: trimmed })
    setEditingNote(null)
    setEditContent('')
    await refreshNotes()
  }

  const handleReminderOpen = async (note: Note) => {
    const granted = await requestNotificationPermission()
    if (!granted) {
      window.alert('Autorisez les notifications pour planifier un rappel.')
      return
    }

    const defaultDate = note.reminderAt
      ? toDatetimeLocalValue(note.reminderAt)
      : toDatetimeLocalValue(Date.now() + 60 * 60 * 1000)

    setReminderNoteId(note.id)
    setReminderValue(defaultDate)
    setReminderMinValue(toDatetimeLocalValue(Date.now() + 60_000))
  }

  const handleReminderSave = async (note: Note) => {
    const reminderAt = new Date(reminderValue).getTime()
    if (Number.isNaN(reminderAt) || reminderAt <= Date.now()) {
      window.alert('Choisissez une date et une heure futures.')
      return
    }

    await updateNote(note.id, { reminderAt })
    scheduleReminder(note.id, reminderAt, note.content)
    setReminderNoteId(null)
    setReminderValue('')
    await refreshNotes()
  }

  const handleReminderCancel = async (note: Note) => {
    cancelReminder(note.id)
    await updateNote(note.id, { reminderAt: undefined })
    await refreshNotes()
  }

  return (
    <div className="page flux-page">
      <header className="page-header">
        <Link to="/" className="btn-link">
          ← Capture
        </Link>
        <h1 className="page-title">Flux</h1>
      </header>

      {loading && <p className="flux-empty">Chargement…</p>}

      {!loading && notes.length === 0 && (
        <p className="flux-empty">Aucune note pour l&apos;instant</p>
      )}

      <ul className="note-list">
        {notes.map((note) => (
          <li key={note.id} className="note-card">
            <div className="note-card__content">
              <p className="note-card__text">{note.content}</p>
              <div className="note-card__meta">
                <time dateTime={new Date(note.createdAt).toISOString()}>
                  {formatRelativeDate(note.createdAt)}
                </time>
                {note.reminderAt && (
                  <span className="note-card__badge">
                    Rappel{' '}
                    {new Intl.DateTimeFormat('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(note.reminderAt))}
                  </span>
                )}
              </div>
            </div>

            <div className="note-card__actions">
              <button type="button" className="btn-secondary" onClick={() => handleEditOpen(note)}>
                Peaufiner
              </button>
              <button type="button" className="btn-secondary" onClick={() => void handleReminderOpen(note)}>
                Rappel
              </button>
              <button type="button" className="btn-danger" onClick={() => void handleDelete(note)}>
                Jeter
              </button>
            </div>

            {reminderNoteId === note.id && (
              <div className="reminder-picker">
                <label className="reminder-picker__label" htmlFor={`reminder-${note.id}`}>
                  Date et heure du rappel
                </label>
                <input
                  id={`reminder-${note.id}`}
                  type="datetime-local"
                  className="reminder-picker__input"
                  value={reminderValue}
                  min={reminderMinValue}
                  onChange={(event) => setReminderValue(event.target.value)}
                />
                <div className="reminder-picker__actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void handleReminderSave(note)}
                  >
                    Planifier
                  </button>
                  {note.reminderAt && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void handleReminderCancel(note)}
                    >
                      Annuler le rappel
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setReminderNoteId(null)}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editingNote && (
        <div className="modal-overlay" role="presentation" onClick={() => setEditingNote(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-modal-title" className="modal__title">
              Peaufiner la note
            </h2>
            <textarea
              className="modal__textarea"
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              autoFocus
            />
            <div className="modal__actions">
              <button type="button" className="btn-primary" onClick={() => void handleEditSave()}>
                Sauvegarder
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditingNote(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
