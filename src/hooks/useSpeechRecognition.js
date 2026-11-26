import { useState, useRef, useCallback, useEffect } from 'react';

// Reusable speech recognition hook with proper error handling.
// Detects browser support upfront and exposes a clear isSupported flag.
// Handles: no-speech, permission denied, no microphone, network errors, unsupported browser.
export function useSpeechRecognition({ language = 'en-IN', onResult } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const isSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Voice recognition isn't available in this browser. Please use Chrome or Edge, or type your message below.");
      return;
    }

    // Don't start if already listening
    if (recognitionRef.current && isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
      setInterimTranscript('');
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInterimTranscript(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false);
        setInterimTranscript('');
        if (onResultRef.current) onResultRef.current(transcript);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setInterimTranscript('');
      const errMap = {
        'no-speech': "No speech detected. Please try again.",
        'not-allowed': "Microphone access denied. Please allow microphone access in your browser settings.",
        'service-not-allowed': "Microphone access denied. Please allow microphone access in your browser settings.",
        'audio-capture': "No microphone found. Please connect a microphone and try again.",
        'network': "Network error during speech recognition. Please check your connection.",
        'aborted': "", // user cancelled — silent
      };
      setError(errMap[event.error] || ("Speech recognition error: " + event.error));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setError("Failed to start voice recognition. Please try again.");
    }
  }, [language, isSupported, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const clearError = useCallback(() => setError(''), []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  return { isListening, error, interimTranscript, isSupported, startListening, stopListening, clearError };
}