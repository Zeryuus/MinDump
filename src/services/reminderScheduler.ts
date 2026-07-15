import { getAllNotes } from './notesDb'

const scheduledTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function truncate(text: string, max = 100): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

async function showReminderNotification(noteId: string, content: string) {
  if (!('Notification' in window)) return

  if (Notification.permission === 'granted') {
    new Notification('MinDump', {
      body: truncate(content),
      tag: noteId,
    })
  }
}

export function cancelReminder(noteId: string) {
  const timeout = scheduledTimeouts.get(noteId)
  if (timeout) {
    clearTimeout(timeout)
    scheduledTimeouts.delete(noteId)
  }
}

export function scheduleReminder(noteId: string, reminderAt: number, content: string) {
  cancelReminder(noteId)

  const delay = reminderAt - Date.now()
  if (delay <= 0) return

  // v1 : notifications fiables seulement si l'app/PWA reste ouverte
  const timeout = setTimeout(() => {
    void showReminderNotification(noteId, content)
    scheduledTimeouts.delete(noteId)
  }, delay)

  scheduledTimeouts.set(noteId, timeout)
}

export async function replanAllReminders() {
  for (const timeout of scheduledTimeouts.values()) {
    clearTimeout(timeout)
  }
  scheduledTimeouts.clear()

  const notes = await getAllNotes()
  const now = Date.now()

  for (const note of notes) {
    if (note.reminderAt && note.reminderAt > now) {
      scheduleReminder(note.id, note.reminderAt, note.content)
    }
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}
