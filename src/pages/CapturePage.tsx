import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { createNote } from '../services/notesDb'
import {
  getDefaultCaptureMode,
  setDefaultCaptureMode,
  type CaptureMode,
} from '../utils/captureMode'
import { appendVoiceChunk, joinVoiceParts } from '../utils/appendVoiceChunk'
import { extractSaveCommand } from '../utils/voiceSave'

export default function CapturePage() {
  const [mode, setMode] = useState<CaptureMode>(() => getDefaultCaptureMode())
  const [defaultMode, setDefaultModeState] = useState<CaptureMode>(() => getDefaultCaptureMode())
  const [content, setContent] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
    enabled: mode === 'voice',
    onTranscript: handleTranscript,
    onSessionEnd: handleSessionEnd,
  })

  useEffect(() => {
    if (mode === 'text') {
      focusTextarea()
    }
  }, [mode, focusTextarea])

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

  const switchMode = (next: CaptureMode) => {
    setMode(next)
    if (next === 'text') {
      focusTextarea()
    }
  }

  return (
    <div className={`page capture-page ${saveFlash ? 'capture-page--saved' : ''}`}>
      <header className="page-header capture-page__header">
        <h1 className="page-title">Capture</h1>
        <button
          type="button"
          className="btn-icon capture-page__settings"
          aria-label="Préférences"
          onClick={() => setShowSettings((value) => !value)}
        >
          ⚙
        </button>
      </header>

      {showSettings && (
        <div className="settings-panel">
          <p className="settings-label">Ouvrir par défaut en :</p>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-toggle__btn ${defaultMode === 'text' ? 'mode-toggle__btn--active' : ''}`}
              onClick={() => {
                setDefaultCaptureMode('text')
                setDefaultModeState('text')
              }}
            >
              Texte
            </button>
            <button
              type="button"
              className={`mode-toggle__btn ${defaultMode === 'voice' ? 'mode-toggle__btn--active' : ''}`}
              onClick={() => {
                setDefaultCaptureMode('voice')
                setDefaultModeState('voice')
              }}
            >
              Vocal
            </button>
          </div>
        </div>
      )}

      <div className="capture-mode-block">
        <Link to="/flux" className="btn-link capture-flux-link">
          Voir le flux
        </Link>
        <div className="mode-switch">
          <button
            type="button"
            className={`mode-switch__btn ${mode === 'text' ? 'mode-switch__btn--active' : ''}`}
            onClick={() => switchMode('text')}
          >
            Texte
          </button>
          <button
            type="button"
            className={`mode-switch__btn ${mode === 'voice' ? 'mode-switch__btn--active' : ''}`}
            onClick={() => switchMode('voice')}
          >
            Vocal
          </button>
        </div>
      </div>

      {mode === 'voice' && (
        <div className="voice-status">
          {!isSupported && (
            <span className="voice-status__warn">
              Reconnaissance vocale non disponible sur ce navigateur
            </span>
          )}
          {speechError && <span className="voice-status__warn">{speechError}</span>}
          {isListening && isSupported && (
            <span className="voice-status__listening">
              <span className="pulse-dot" aria-hidden="true" />
              Écoute en cours…
            </span>
          )}
        </div>
      )}

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
          autoFocus={mode === 'text'}
          aria-label="Contenu de la note"
        />
      </div>

      <div className="capture-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void handleManualSave()}
          disabled={!content.trim() || isSaving}
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
