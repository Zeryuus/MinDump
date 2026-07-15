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
  finalChunk: string
  interimChunk: string
}

interface UseSpeechRecognitionOptions {
  enabled: boolean
  onFinalTranscript?: (update: TranscriptUpdate) => void
}

export function useSpeechRecognition({
  enabled,
  onFinalTranscript,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported] = useState(() => getSpeechRecognitionCtor() !== null)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const enabledRef = useRef(enabled)
  const shouldRestartRef = useRef(false)
  const processedFinalCountRef = useRef(0)

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const stop = useCallback(() => {
    shouldRestartRef.current = false
    recognitionRef.current?.abort()
    recognitionRef.current = null
    processedFinalCountRef.current = 0
    setIsListening(false)
  }, [])

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('Reconnaissance vocale non disponible sur ce navigateur')
      return
    }

    if (recognitionRef.current) {
      shouldRestartRef.current = false
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    setError(null)
    processedFinalCountRef.current = 0
    shouldRestartRef.current = true

    const recognition = new Ctor()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      setError(null)

      let interim = ''
      let finalChunk = ''
      const processed = processedFinalCountRef.current

      for (let i = processed; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          finalChunk += transcript
          processedFinalCountRef.current = i + 1
          interim = ''
        } else {
          interim = transcript
        }
      }

      if (!finalChunk && !interim) return

      onFinalTranscriptRef.current?.({
        finalChunk: finalChunk.trim(),
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
      recognitionRef.current = null
      setIsListening(false)

      if (enabledRef.current && shouldRestartRef.current) {
        queueMicrotask(() => {
          if (enabledRef.current && shouldRestartRef.current) {
            startRecognition()
          }
        })
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      shouldRestartRef.current = false
      setError('Impossible de démarrer le micro')
    }
  }, [])

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
