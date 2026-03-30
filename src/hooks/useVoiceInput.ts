/**
 * useVoiceInput — Web Speech API wrapper for Spanish voice input
 *
 * Wraps the SpeechRecognition API with:
 * - TypeScript types for webkitSpeechRecognition
 * - Automatic language detection (es-ES default)
 * - Timeout handling (5s max)
 * - Clean state management
 */

import { useState, useRef, useCallback } from 'react';

// ── TypeScript declarations for Web Speech API ──

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

// ── Types ──

export type VoiceInputStatus = 'idle' | 'listening' | 'processing' | 'done' | 'error';

export interface VoiceInputState {
  status: VoiceInputStatus;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
}

// ── Hook ──

export function useVoiceInput(lang: string = 'es-ES'): VoiceInputState {
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Tu navegador no soporta reconocimiento de voz');
      setStatus('error');
      return;
    }

    cleanup();
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setStatus('listening');

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    let hasFinalResult = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        hasFinalResult = true;
        setTranscript(prev => (prev + ' ' + final).trim());
        setStatus('done');
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessages: Record<string, string> = {
        'no-speech': 'No se detectó voz. Intenta de nuevo.',
        'audio-capture': 'No se puede acceder al micrófono.',
        'not-allowed': 'Permiso de micrófono denegado.',
        'network': 'Error de red. Verifica tu conexión.',
        'aborted': '', // Normal abort, don't show error
      };
      const msg = errorMessages[event.error] || `Error: ${event.error}`;
      if (msg) {
        setError(msg);
        setStatus('error');
      }
    };

    recognition.onend = () => {
      // Use local variable to avoid stale closure
      if (!hasFinalResult) {
        setStatus('idle');
      }
      recognitionRef.current = null;
    };

    recognition.onspeechend = () => {
      if (!hasFinalResult) {
        setStatus('processing');
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      setError('No se pudo iniciar el reconocimiento de voz');
      setStatus('error');
      return;
    }

    // Auto-stop after 10 seconds
    timeoutRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }, 10000);
  }, [isSupported, lang, cleanup]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setStatus(transcript ? 'done' : 'idle');
  }, [transcript]);

  const reset = useCallback(() => {
    cleanup();
    setStatus('idle');
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, [cleanup]);

  return {
    status,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    reset,
  };
}
