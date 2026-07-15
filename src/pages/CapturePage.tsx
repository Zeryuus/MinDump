import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { createNote } from '../services/notesDb'
import { appendVoiceChunk, joinVoiceParts } from '../utils/appendVoiceChunk'
import { extractSaveCommand } from '../utils/voiceSave'

export default function CapturePage() {
  const [content, setContent] = useState('')
  const [saveFlash, setSaveFlash] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTalking, setIsTalking] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastVoiceSaveRef = useRef(0)
  const skipSessionMergeRef = useRef(false)
  const baseContentRef = useRef('')

  const focusTextarea = useCallback(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [])

  const resetCapture = useCallback(() => {
    setContent('')
    baseContentRef.current = ''
    focusTextarea()
  }, [focusTextarea])

  const triggerSaveFlash = useCallback(() => {
    setSaveFlash(true)
    window.setTimeout(() => setSaveFlash(false), 350)
  }, [])

  const saveNote = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isSaving) return false

      setIsSaving(true)
      try {
        await createNote(trimmed)
        resetCapture()
        triggerSaveFlash()
        return true
      } finally {
        window.setTimeout(() => setIsSaving(false), 1000)
      }
    },
    [isSaving, resetCapture, triggerSaveFlash],
  )

  const handleManualSave = useCallback(async () => {
    await saveNote(content)
  }, [content, saveNote])

  const handleTranscript = useCallback(
    ({ sessionFinal, interimChunk }: { sessionFinal: string; interimChunk: string }) => {
      const activeNote = joinVoiceParts(baseContentRef.current, sessionFinal)
      setContent(joinVoiceParts(activeNote, interimChunk))

      if (!sessionFinal) return

      const { content: cleaned, shouldSave } = extractSaveCommand(activeNote)

      if (shouldSave) {
        const now = Date.now()
        if (now - lastVoiceSaveRef.current < 1000) return
        lastVoiceSaveRef.current = now

        void (async () => {
          const saved = await saveNote(cleaned)
          if (saved) {
            skipSessionMergeRef.current = true
          }
        })()
      }
    },
    [saveNote],
  )

  const handleSessionEnd = useCallback(({ sessionFinal }: { sessionFinal: string }) => {
    if (skipSessionMergeRef.current) {
      skipSessionMergeRef.current = false
      return
    }

    if (!sessionFinal) return

    baseContentRef.current = appendVoiceChunk(baseContentRef.current, sessionFinal)
    setContent(baseContentRef.current)
  }, [])

  const { isListening, isSupported, error: speechError } = useSpeechRecognition({
    enabled: true,
    listening: isTalking,
    onTranscript: handleTranscript,
    onSessionEnd: handleSessionEnd,
  })

  useEffect(() => {
    focusTextarea()
  }, [focusTextarea])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void handleManualSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  return (
    <div className={`page capture-page ${saveFlash ? 'capture-page--saved' : ''}`}>
      <header className="page-header capture-page__header">
        <h1 className="page-title">Capture</h1>
        <Link to="/flux" className="btn-link capture-flux-link">
          Voir le flux
        </Link>
      </header>

      <div className="capture-editor">
        <textarea
          ref={textareaRef}
          className="capture-textarea"
          value={content}
          onChange={(event) => {
            setContent(event.target.value)
            baseContentRef.current = event.target.value
          }}
          placeholder="Une idée…"
          autoFocus
          aria-label="Contenu de la note"
        />
      </div>

      {(speechError || !isSupported) && (
        <p className="capture-voice-hint" role="status">
          {!isSupported
            ? 'Reconnaissance vocale non disponible sur ce navigateur'
            : speechError}
        </p>
      )}

      <div className="capture-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void handleManualSave()}
          disabled={!content.trim() || isSaving}
        >
          Enregistrer
        </button>
        {isSupported && (
          <button
            type="button"
            className={`ptt-button ${isTalking ? 'ptt-button--active' : ''}`}
            aria-pressed={isTalking}
            aria-label="Maintenez pour parler"
            onPointerDown={(event) => {
              event.preventDefault()
              setIsTalking(true)
            }}
            onPointerUp={() => setIsTalking(false)}
            onPointerLeave={() => setIsTalking(false)}
            onPointerCancel={() => setIsTalking(false)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="ptt-button__icon" aria-hidden="true">
              🎙
            </span>
            <span className="ptt-button__label">
              {isListening ? 'Écoute…' : 'Parler'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
