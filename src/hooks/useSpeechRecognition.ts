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

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('Reconnaissance vocale non disponible sur ce navigateur')
      return
    }

    setError(null)

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    const recognition = new Ctor()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      setError(null)

      let interim = ''
      let finalChunk = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalChunk += transcript
        } else {
          interim += transcript
        }
      }

      onFinalTranscriptRef.current?.({
        finalChunk: finalChunk.trim(),
        interimChunk: interim.trim(),
      })
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('Permission micro refusée')
        setIsListening(false)
      } else if (event.error === 'network') {
        // Erreur passagère : l'écoute redémarre souvent tout seule
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`Erreur micro : ${event.error}`)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      if (enabled) {
        try {
          recognition.start()
          setIsListening(true)
        } catch {
          // Ignore restart race
        }
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      setError('Impossible de démarrer le micro')
    }
  }, [enabled])

  useEffect(() => {
    if (enabled && isSupported) {
      queueMicrotask(() => {
        start()
      })
    } else {
      recognitionRef.current?.abort()
      recognitionRef.current = null
      queueMicrotask(() => {
        setIsListening(false)
      })
    }

    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [enabled, isSupported, start])

  return { isListening, isSupported, error, stop, start }
}
