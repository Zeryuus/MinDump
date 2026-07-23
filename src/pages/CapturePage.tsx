import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { createNote } from '../services/notesDb'
import { appendVoiceChunk, buildVoiceDisplay, joinVoiceParts } from '../utils/appendVoiceChunk'
import { extractSaveCommand } from '../utils/voiceSave'

export default function CapturePage() {
  const [content, setContent] = useState('')
  const [saveFlash, setSaveFlash] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTalking, setIsTalking] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastVoiceSaveRef = useRef(0)
  const skipSessionMergeRef = useRef(false)
  const pendingSessionRef = useRef('')
  const baseContentRef = useRef('')

  const resetCapture = useCallback(() => {
    setContent('')
    baseContentRef.current = ''
    pendingSessionRef.current = ''
    textareaRef.current?.blur()
  }, [])

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
      pendingSessionRef.current = sessionFinal
      setContent(buildVoiceDisplay(baseContentRef.current, sessionFinal, interimChunk))

      if (!sessionFinal) return

      const activeNote = joinVoiceParts(baseContentRef.current, sessionFinal)
      const { content: cleaned, shouldSave } = extractSaveCommand(activeNote)

      if (shouldSave) {
        const now = Date.now()
        if (now - lastVoiceSaveRef.current < 1000) return
        lastVoiceSaveRef.current = now

        void (async () => {
          const saved = await saveNote(cleaned)
          if (saved) {
            skipSessionMergeRef.current = true
            pendingSessionRef.current = ''
          }
        })()
      }
    },
    [saveNote],
  )

  const handleSessionEnd = useCallback(({ sessionFinal }: { sessionFinal: string }) => {
    pendingSessionRef.current = ''

    if (skipSessionMergeRef.current) {
      skipSessionMergeRef.current = false
      return
    }

    if (!sessionFinal) {
      setContent(baseContentRef.current)
      return
    }

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void handleManualSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  const startTalking = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    textareaRef.current?.blur()
    setIsTalking(true)
  }, [])

  const stopTalking = useCallback(() => {
    setIsTalking(false)
  }, [])

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
          enterKeyHint="done"
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
            onPointerDown={startTalking}
            onPointerUp={stopTalking}
            onPointerLeave={stopTalking}
            onPointerCancel={stopTalking}
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
