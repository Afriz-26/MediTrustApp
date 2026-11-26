
import { db } from '@/api/client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Bot, User, Globe, Volume2, Sparkles } from 'lucide-react';
import { useLanguage } from '../ui/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import { sendChatMessage, getSessionId, persistMessage, loadHistory, detectLanguage } from '@/lib/chatPipeline';

const LANG_LABELS = { en: 'English', hi: 'हिन्दी', te: 'తెలుగు', ta: 'தமிழ்' };

// Map app language to BCP-47 recognition hint (best available, not true auto-detect)
const RECOG_LANG = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN' };

const featurePages = {
  symptom_checker: 'SymptomChecker',
  find_doctors: 'FindDoctors',
  pharmacies: 'Pharmacies',
};

export default function VoiceAssistant({ compact = false }) {
  const { language: appLanguage } = useLanguage();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [usedWebSearch, setUsedWebSearch] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [sessionId, setSessionId] = useState(getSessionId());
  const [history, setHistory] = useState([]);
  const [continuousMode, setContinuousMode] = useState(true);
  const voiceSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Refs to avoid stale closures
  const recognitionRef = useRef(null);
  const shouldRestartRef = useRef(false);
  const hasResultRef = useRef(false);
  const isProcessingRef = useRef(false);
  const appLanguageRef = useRef(appLanguage);
  const historyRef = useRef(history);
  const userEmailRef = useRef(userEmail);
  const sessionIdRef = useRef(sessionId);

  // Keep refs in sync with latest state
  useEffect(() => { appLanguageRef.current = appLanguage; }, [appLanguage]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { userEmailRef.current = userEmail; }, [userEmail]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Load user on mount
  useEffect(() => {
    db.auth.me().then((me) => {
      setUserEmail(me.email || '');
      if (me.email) {
        loadHistory(sessionId, me.email).then((h) => setHistory(h));
      }
    }).catch(() => {});
  }, [sessionId]);

  // Strip markdown/technical syntax for natural speech
  function cleanForSpeech(text) {
    if (!text) return '';
    return text
      .replace(/```[\s\S]*?```/g, '')   // code blocks
      .replace(/`([^`]+)`/g, '$1')      // inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
      .replace(/\*([^*]+)\*/g, '$1')     // italic
      .replace(/#{1,6}\s/g, '')           // headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/[-*]\s/g, '')             // bullet points
      .replace(/\n{2,}/g, '. ')           // double newlines to sentence breaks
      .replace(/\n/g, '. ')               // single newlines
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Speak text in the given language — uses ref for restart to avoid stale closure
  const speak = useCallback((text, lang) => {
    if (!text || !('speechSynthesis' in window)) return;
    const cleaned = cleanForSpeech(text);
    if (!cleaned) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleaned);
    const langCodes = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN' };
    utterance.lang = langCodes[lang] || 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const matchVoice = voices.find(v => v.lang === utterance.lang) ||
                       voices.find(v => v.lang.startsWith(lang));
    if (matchVoice) utterance.voice = matchVoice;

    setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-restart listening for continuous conversation
      if (shouldRestartRef.current) {
        setTimeout(() => startListeningRef.current(), 400);
      }
    };
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // Process a voice/text command through the AI pipeline
  const processCommand = useCallback(async (text) => {
    if (!text.trim()) return;
    if (!userEmailRef.current) {
      setResponse('Please sign in to use the voice assistant.');
      speak('Please sign in to use the voice assistant.', 'en');
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setResponse('');
    setTranscript(text);

    // Detect language from transcript
    const lang = detectLanguage(text);
    setDetectedLang(lang);

    try {
      await persistMessage(sessionIdRef.current, userEmailRef.current, 'user', text);

      const result = await sendChatMessage({
        message: text,
        sessionId: sessionIdRef.current,
        email: userEmailRef.current,
        language: lang,
        history: [...historyRef.current, { role: 'user', content: text }].slice(-10),
      });

      setResponse(result.content);
      setUsedWebSearch(result.usedWebSearch);
      setConversation(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: result.content }]);
      setHistory(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: result.content }]);

      await persistMessage(sessionIdRef.current, userEmailRef.current, 'assistant', result.content);

      // Speak the response in the detected language
      speak(result.content, lang);

      // Navigate if a feature is suggested (after a delay so user hears the response)
      if (result.suggestFeature && result.suggestFeature !== 'none' && featurePages[result.suggestFeature]) {
        setTimeout(() => {
          setIsOpen(false);
          navigate(createPageUrl(featurePages[result.suggestFeature]));
        }, 5000);
      }
    } catch (e) {
      setResponse("I'm having trouble right now. Please try again.");
      speak("I'm having trouble right now. Please try again.", lang);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [speak, navigate]);

  // Start listening — uses app language as recognition hint (not true auto-detect)
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setResponse("Voice recognition isn't available in this browser. Try using Chrome or Edge.");
      return;
    }

    // Cancel any ongoing speech (interruptible)
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    hasResultRef.current = false;

    const recognition = new SpeechRecognition();
    // Use the user's selected app language as a recognition hint.
    // The Web Speech API does NOT support true automatic multilingual detection;
    // this is the best available approach — set the locale hint and detect
    // the actual language from the transcript after recognition.
    recognition.lang = RECOG_LANG[appLanguageRef.current] || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
      if (event.results[event.results.length - 1].isFinal) {
        hasResultRef.current = true;
        setIsListening(false);
        processCommand(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      const errMap = {
        'no-speech': null, // handled below for auto-restart
        'not-allowed': "Microphone access denied. Please allow microphone access in your browser settings.",
        'service-not-allowed': "Microphone access denied. Please allow microphone access in your browser settings.",
        'audio-capture': "No microphone found. Please connect a microphone and try again.",
        'network': "Network error during speech recognition. Please check your connection.",
        'aborted': null, // user cancelled — silent
      };
      const msg = errMap[event.error];
      if (msg) {
        setResponse(msg);
        shouldRestartRef.current = false;
      } else if (event.error === 'no-speech') {
        // Auto-restart in continuous mode if no speech detected
        if (shouldRestartRef.current) {
          setTimeout(() => startListeningRef.current(), 300);
        }
      } else if (msg === undefined) {
        setResponse("Speech recognition error: " + event.error + ". Please try again.");
        shouldRestartRef.current = false;
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart only if no final result was received (user didn't speak)
      if (shouldRestartRef.current && !hasResultRef.current && !isProcessingRef.current) {
        setTimeout(() => startListeningRef.current(), 300);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (error) {
      // Already started — ignore
    }
  }, [processCommand]);

  // Use a ref to always access the latest startListening (avoids stale closure in speak)
  const startListeningRef = useRef(startListening);
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    setIsListening(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Open/close handler
  useEffect(() => {
    if (isOpen) {
      shouldRestartRef.current = true;
      setConversation([]);
      setTranscript('');
      setResponse('');
      setDetectedLang(null);
      // Start listening automatically only if voice is supported
      if (voiceSupported) {
        setTimeout(() => startListeningRef.current(), 500);
      } else {
        setResponse("Voice recognition isn't available in this browser. Please use Chrome or Edge for voice, or use the text Chat Assistant instead.");
      }
    } else {
      stopListening();
    }
     
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Preload voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  if (compact) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <Mic className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <>
      {/* Floating mic button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full shadow-2xl flex items-center justify-center z-[9999] hover:scale-110 transition-transform"
        animate={{
          boxShadow: [
            "0 10px 40px rgba(139, 92, 246, 0.3)",
            "0 10px 60px rgba(236, 72, 153, 0.5)",
            "0 10px 40px rgba(139, 92, 246, 0.3)"
          ]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Mic className="w-7 h-7 text-white" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 z-50 flex flex-col"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-6 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full">
                  <Globe className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs text-white/80 font-medium">{LANG_LABELS[appLanguage]}</span>
                </div>
                {detectedLang && detectedLang !== appLanguage && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 backdrop-blur-sm rounded-full">
                    <span className="text-xs text-emerald-200 font-medium">Detected: {LANG_LABELS[detectedLang]}</span>
                  </div>
                )}
                {usedWebSearch && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 backdrop-blur-sm rounded-full">
                    <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                    <span className="text-xs text-blue-200 font-medium">Web search</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Center — animated orb */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <div className="relative mb-8">
                {/* Outer rings */}
                {(isListening || isSpeaking) && (
                  <>
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="absolute inset-0 rounded-full border-2 border-purple-400/30"
                        animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
                      />
                    ))}
                  </>
                )}

                {/* Main orb */}
                <motion.div
                  className="relative w-40 h-40 rounded-full flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    if (isSpeaking) {
                      // Interrupt speech and restart listening
                      if (window.speechSynthesis) window.speechSynthesis.cancel();
                      setIsSpeaking(false);
                      startListeningRef.current();
                    }
                  }}
                  animate={{
                    scale: isListening ? [1, 1.05, 1] : isProcessing ? [1, 0.95, 1] : isSpeaking ? [1, 1.08, 1] : 1,
                  }}
                  transition={{ duration: isListening ? 1.5 : isSpeaking ? 0.8 : 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${
                    isListening ? 'from-purple-500 to-pink-500' :
                    isProcessing ? 'from-blue-500 to-purple-500' :
                    isSpeaking ? 'from-emerald-500 to-teal-500' :
                    'from-slate-600 to-slate-700'
                  } opacity-90`} />

                  {/* Waveform bars inside orb */}
                  {(isListening || isSpeaking) && (
                    <div className="relative flex items-center gap-1.5 h-12">
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 bg-white rounded-full"
                          animate={{ height: isListening ? ['20%', '100%', '20%'] : isSpeaking ? ['40%', '80%', '40%'] : '30%' }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                          style={{ height: '30%' }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Processing spinner */}
                  {isProcessing && (
                    <motion.div
                      className="relative w-12 h-12 border-4 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  )}

                  {/* Idle mic icon */}
                  {!isListening && !isProcessing && !isSpeaking && (
                    <Mic className="w-12 h-12 text-white/70" />
                  )}
                </motion.div>
              </div>

              {/* Status text */}
              <p className="text-white/90 text-lg font-medium mb-2">
                {!voiceSupported ? 'Voice unavailable' :
                 isListening ? 'Listening...' :
                 isProcessing ? 'Thinking...' :
                 isSpeaking ? 'Speaking...' :
                 'Tap to start speaking'}
              </p>
              <p className="text-white/40 text-sm text-center max-w-xs">
                {isListening ? `Speak in ${LANG_LABELS[appLanguage]} — I'll respond in your language` :
                 isProcessing ? 'Processing your question...' :
                 isSpeaking ? 'Tap the orb to interrupt' :
                 `Recognition hint: ${LANG_LABELS[appLanguage]} · Continuous conversation`}
              </p>
            </div>

            {/* Conversation transcript area */}
            <div className="px-5 pb-4 max-h-40 overflow-y-auto space-y-2">
              {transcript && (
                <div className="flex gap-2 justify-end">
                  <div className="max-w-[80%]">
                    <div className="p-2.5 bg-white/15 backdrop-blur-sm text-white rounded-2xl rounded-br-md">
                      <p className="text-sm">{transcript}</p>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
              )}
              {response && !isProcessing && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="max-w-[80%]">
                    <div className="p-2.5 bg-white/10 backdrop-blur-sm text-white/90 rounded-2xl rounded-bl-md">
                      <p className="text-sm whitespace-pre-wrap">{response}</p>
                    </div>
                    {isSpeaking && (
                      <div className="flex items-center gap-1 mt-1 ml-1">
                        <Volume2 className="w-3 h-3 text-emerald-300 animate-pulse" />
                        <span className="text-xs text-white/40">Speaking...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom — tap to control */}
            <div className="px-6 pb-8 pt-2">
              <button
                onClick={isListening || isProcessing || isSpeaking ? stopListening : () => startListeningRef.current()}
                className="w-full py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-2xl text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Mic className="w-5 h-5" />
                {isListening ? 'Tap to Stop' : isProcessing ? 'Processing...' : isSpeaking ? 'Tap to Interrupt' : 'Tap to Speak'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}