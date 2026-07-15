import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEventLike {
  error: string
}

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

function getSpeechRecognitionCtor() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export type TranscriptUpdate = {
  sessionFinal: string
  interimChunk: string
}

export type SessionEndUpdate = {
  sessionFinal: string
}

interface UseSpeechRecognitionOptions {
  enabled: boolean
  onTranscript?: (update: TranscriptUpdate) => void
  onSessionEnd?: (update: SessionEndUpdate) => void
}

const RESTART_DELAY_MS = 500

export function useSpeechRecognition({
  enabled,
  onTranscript,
  onSessionEnd,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported] = useState(() => getSpeechRecognitionCtor() !== null)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onSessionEndRef = useRef(onSessionEnd)
  const enabledRef = useRef(enabled)
  const shouldRestartRef = useRef(false)
  const sessionFinalRef = useRef('')
  const restartTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    onSessionEndRef.current = onSessionEnd
  }, [onSessionEnd])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    shouldRestartRef.current = false
    clearRestartTimeout()
    recognitionRef.current?.abort()
    recognitionRef.current = null
    sessionFinalRef.current = ''
    setIsListening(false)
  }, [clearRestartTimeout])

  const scheduleRestart = useCallback(
    (recognition: SpeechRecognitionInstance) => {
      clearRestartTimeout()
      restartTimeoutRef.current = window.setTimeout(() => {
        restartTimeoutRef.current = null
        if (!enabledRef.current || !shouldRestartRef.current) return
        if (recognitionRef.current !== recognition) return

        sessionFinalRef.current = ''

        try {
          recognition.start()
          setIsListening(true)
        } catch {
          setIsListening(false)
        }
      }, RESTART_DELAY_MS)
    },
    [clearRestartTimeout],
  )

  const attachHandlers = useCallback(
    (recognition: SpeechRecognitionInstance) => {
      recognition.onresult = (event) => {
        setError(null)

        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            sessionFinalRef.current += event.results[i][0].transcript
          }
        }

        let interim = ''
        for (let i = event.results.length - 1; i >= 0; i--) {
          if (!event.results[i].isFinal) {
            interim = event.results[i][0].transcript
            break
          }
        }

        onTranscriptRef.current?.({
          sessionFinal: sessionFinalRef.current.trim(),
          interimChunk: interim.trim(),
        })
      }

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setError('Permission micro refusée')
          shouldRestartRef.current = false
          setIsListening(false)
        } else if (event.error === 'network') {
          // Erreur passagère : l'écoute redémarre souvent tout seule
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setError(`Erreur micro : ${event.error}`)
        }
      }

      recognition.onend = () => {
        setIsListening(false)

        const finals = sessionFinalRef.current.trim()
        if (finals) {
          onSessionEndRef.current?.({ sessionFinal: finals })
        }
        sessionFinalRef.current = ''

        if (enabledRef.current && shouldRestartRef.current && recognitionRef.current === recognition) {
          scheduleRestart(recognition)
        }
      }
    },
    [scheduleRestart],
  )

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('Reconnaissance vocale non disponible sur ce navigateur')
      return
    }

    clearRestartTimeout()

    if (recognitionRef.current) {
      shouldRestartRef.current = false
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    setError(null)
    sessionFinalRef.current = ''
    shouldRestartRef.current = true

    const recognition = new Ctor()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    attachHandlers(recognition)
    recognitionRef.current = recognition

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      shouldRestartRef.current = false
      setError('Impossible de démarrer le micro')
    }
  }, [attachHandlers, clearRestartTimeout])

  useEffect(() => {
    if (enabled && isSupported) {
      queueMicrotask(() => {
        startRecognition()
      })
    } else {
      stop()
    }

    return () => {
      stop()
    }
  }, [enabled, isSupported, startRecognition, stop])

  return { isListening, isSupported, error, stop, start: startRecognition }
}
