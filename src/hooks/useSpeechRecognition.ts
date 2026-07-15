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
  listening: boolean
  autoRestart?: boolean
  onTranscript?: (update: TranscriptUpdate) => void
  onSessionEnd?: (update: SessionEndUpdate) => void
}

const RESTART_DELAY_MS = 500

export function useSpeechRecognition({
  enabled,
  listening,
  autoRestart = false,
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
  const listeningRef = useRef(listening)
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

  useEffect(() => {
    listeningRef.current = listening
  }, [listening])

  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }
  }, [])

  const stopHard = useCallback(() => {
    shouldRestartRef.current = false
    clearRestartTimeout()
    recognitionRef.current?.abort()
    recognitionRef.current = null
    sessionFinalRef.current = ''
    setIsListening(false)
  }, [clearRestartTimeout])

  const stopGracefully = useCallback(() => {
    shouldRestartRef.current = false
    clearRestartTimeout()

    if (!recognitionRef.current) {
      setIsListening(false)
      return
    }

    try {
      recognitionRef.current.stop()
    } catch {
      recognitionRef.current.abort()
      recognitionRef.current = null
      setIsListening(false)
    }
  }, [clearRestartTimeout])

  const scheduleRestart = useCallback(
    (recognition: SpeechRecognitionInstance) => {
      clearRestartTimeout()
      restartTimeoutRef.current = window.setTimeout(() => {
        restartTimeoutRef.current = null
        if (!enabledRef.current || !listeningRef.current || !shouldRestartRef.current) return
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
          // Erreur passagère
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

        if (
          enabledRef.current &&
          listeningRef.current &&
          shouldRestartRef.current &&
          recognitionRef.current === recognition
        ) {
          scheduleRestart(recognition)
        } else {
          recognitionRef.current = null
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
    shouldRestartRef.current = autoRestart

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
      recognitionRef.current = null
      setError('Impossible de démarrer le micro')
    }
  }, [attachHandlers, autoRestart, clearRestartTimeout])

  useEffect(() => {
    if (!enabled || !isSupported) {
      stopHard()
      return
    }

    if (listening) {
      queueMicrotask(() => {
        if (enabledRef.current && listeningRef.current) {
          startRecognition()
        }
      })
      return
    }

    stopGracefully()
  }, [enabled, listening, isSupported, startRecognition, stopGracefully, stopHard])

  useEffect(() => {
    return () => {
      stopHard()
    }
  }, [stopHard])

  return { isListening, isSupported, error, stop: stopHard, start: startRecognition }
}
