
import { db } from '@/api/client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Bot, User, Loader2, Sparkles, Stethoscope, Calendar, Plus, Globe, Trash2, X, MessageSquare, Menu, Mic, Volume2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import Disclaimer from '@/components/common/Disclaimer';
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';

import { sendChatMessage, getSessionId, startNewSession, loadHistory, persistMessage, listSessions, deleteSession } from '@/lib/chatPipeline';
import ReactMarkdown from 'react-markdown';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { DataError } from '@/components/common/DataState';

const quickPrompts = [
  { icon: Stethoscope, text: "What type of doctor should I see for headaches?" },
  { icon: Calendar, text: "How do I book an appointment?" },
  { icon: Sparkles, text: "Explain how symptom checker works" },
];

const featurePages = {
  symptom_checker: { text: 'Open Symptom Checker', page: 'SymptomChecker' },
  find_doctors: { text: 'Find Doctors', page: 'FindDoctors' },
  pharmacies: { text: 'View Pharmacies', page: 'Pharmacies' },
};

function ChatContent() {
  const { t, language, changeLanguage } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I'm your Medi Trust assistant. I can help you navigate the app, understand symptoms educationally, find the right doctor, and guide you through booking. How can I help you today?`,
      followUps: [],
      suggestFeature: 'none',
      usedWebSearch: false,
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [sessionId, setSessionId] = useState(getSessionId());
  const [sessions, setSessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sidebarError, setSidebarError] = useState('');
  const [persistError, setPersistError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const messagesLoadedRef = useRef(false);
  const voiceModeRef = useRef(false);
  const sendMessageRef = useRef(null);
  const speakResponseRef = useRef(null);
  const startListeningRef = useRef(null);
  const voiceRestartTimerRef = useRef(null);

  const RECOG_LANG = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN' };
  const { isListening, error: voiceError, interimTranscript, isSupported: voiceSupported, startListening, stopListening, clearError: clearVoiceError } = useSpeechRecognition({
    language: RECOG_LANG[language] || 'en-IN',
    onResult: (text) => {
      setInput(text);
      if (voiceModeRef.current) {
        sendMessageRef.current?.(text, true);
      } else {
        inputRef.current?.focus();
      }
    },
  });
  startListeningRef.current = startListening;

  const speakResponse = useCallback((text) => {
    if (!voiceModeRef.current) return;
    const restartListening = () => {
      if (!voiceModeRef.current) return;
      voiceRestartTimerRef.current = window.setTimeout(() => {
        if (voiceModeRef.current) startListeningRef.current?.();
      }, 500);
    };
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      setSpeechError('Speech playback is unavailable in this browser.');
      restartListening();
      return;
    }
    const cleaned = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[-*]\s/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, '. ')
      .trim();
    if (!cleaned) {
      restartListening();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(cleaned);
    utterance.lang = RECOG_LANG[language] || 'en-IN';
    utterance.rate = 0.95;
    const localePrefix = utterance.lang.split('-')[0];
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find((voice) => voice.lang.toLowerCase() === utterance.lang.toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(localePrefix));
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onend = () => {
      setIsSpeaking(false);
      restartListening();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeechError('Speech playback could not be completed.');
      restartListening();
    };
    setSpeechError('');
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [language]);
  speakResponseRef.current = speakResponse;

  const stopVoiceConversation = useCallback(() => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    setIsSpeaking(false);
    if (voiceRestartTimerRef.current) window.clearTimeout(voiceRestartTimerRef.current);
    stopListening();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, [stopListening]);

  useEffect(() => () => {
    voiceModeRef.current = false;
    if (voiceRestartTimerRef.current) window.clearTimeout(voiceRestartTimerRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const loadSessions = useCallback(async (email = userEmail) => {
    if (!email) return;
    setSessionsLoading(true);
    try {
      setSessions(await listSessions(email));
      setSidebarError('');
    } catch (error) {
      console.error('Failed to load chat sessions.', error);
      setSidebarError('Failed to load conversations. Please retry.');
    } finally {
      setSessionsLoading(false);
    }
  }, [userEmail]);

  const loadConversation = useCallback(async () => {
    messagesLoadedRef.current = false;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Could not verify the signed-in account.');
      setUserEmail(me.email);
      const history = await loadHistory(sessionId, me.email);
      setMessages(history.length
        ? history.map((message) => ({ ...message, followUps: [], suggestFeature: 'none', usedWebSearch: false }))
        : [{
          role: 'assistant',
          content: `Hello! I'm your Medi Trust assistant. How can I help you today?`,
          followUps: [],
          suggestFeature: 'none',
          usedWebSearch: false,
        }]);
      messagesLoadedRef.current = true;
      await loadSessions(me.email);
    } catch (error) {
      console.error('Failed to load chat history.', error);
      setHistoryError(error.message || 'Failed to load this conversation.');
    } finally {
      setHistoryLoading(false);
    }
  }, [sessionId, loadSessions]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text, speakReply = false) => {
    if (!text || !userEmail || isLoading) return;
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Check if this is the first user message — mark as title
    const isFirstMessage = messages.filter(m => m.role === 'user').length === 0;
    const userPersistence = persistMessage(sessionId, userEmail, 'user', text, isFirstMessage)
      .then(() => setPersistError(''))
      .catch((persistErr) => {
        console.error('Failed to save chat message.', persistErr);
        setPersistError('Message may not have been saved. Your conversation will continue but may not persist after refresh.');
      });

    try {
      const result = await sendChatMessage({
        message: text,
        language,
        history: messages.slice(-20),
      });
      const assistantMsg = {
        role: 'assistant',
        content: result.content,
        suggestFeature: result.suggestFeature,
        followUps: result.followUps,
        usedWebSearch: result.usedWebSearch,
        model: result.model,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      const assistantPersistence = persistMessage(sessionId, userEmail, 'assistant', result.content).catch((persistErr) => {
        console.error('Failed to save assistant reply.', persistErr);
        setPersistError('Response may not have been saved to history.');
      });
      void Promise.all([userPersistence, assistantPersistence])
        .then(() => listSessions(userEmail))
        .then((sess) => {
          setSessions(sess);
          setSidebarError('');
        })
        .catch((sessErr) => {
          console.error('Failed to refresh chat session list.', sessErr);
          setSidebarError('Failed to refresh conversations list.');
        });
      if (speakReply) speakResponseRef.current?.(result.content);
      return result.content;
    } catch (e) {
      console.error('Chat request failed.', e);
      const fallback = e instanceof Error && e.message
        ? e.message
        : "I'm having trouble responding right now. Please try again in a moment.";
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: fallback,
        suggestFeature: 'none',
        followUps: [],
        usedWebSearch: false,
      }]);
      if (speakReply) speakResponseRef.current?.(fallback);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, [messages, userEmail, sessionId, language, isLoading]);
  sendMessageRef.current = sendMessage;

  const startVoiceConversation = () => {
    if (!voiceSupported) return;
    if (voiceRestartTimerRef.current) window.clearTimeout(voiceRestartTimerRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeechError('');
    clearVoiceError();
    voiceModeRef.current = true;
    setVoiceMode(true);
    startListening();
  };

  const handleSend = useCallback(() => {
    const userMessage = input.trim();
    if (!userMessage || isLoading || !userEmail) return;
    if (isListening) stopListening();
    sendMessage(userMessage, voiceModeRef.current);
  }, [input, isLoading, userEmail, sendMessage, isListening, stopListening]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNewChat = () => {
    stopVoiceConversation();
    const newId = startNewSession();
    setSessionId(newId);
    setMessages([{
      role: 'assistant',
      content: `Starting a fresh conversation. How can I help you today?`,
      followUps: [],
      suggestFeature: 'none',
      usedWebSearch: false,
    }]);
    setShowSidebar(false);
  };

  const handleLoadSession = (sid) => {
    setSessionId(sid);
    setShowSidebar(false);
  };

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      if (deleteTarget.all) {
        const allSessions = await listSessions(userEmail, 5000);
        for (const session of allSessions) {
          await deleteSession(userEmail, session.id);
        }
        const remainingSessions = await listSessions(userEmail, 5000);
        if (remainingSessions.length) throw new Error('Some conversations could not be deleted. Check your access and try again.');
        setSessions(remainingSessions);
        handleNewChat();
      } else {
        await deleteSession(userEmail, deleteTarget.id);
        const sess = await listSessions(userEmail);
        if (sess.some((session) => session.id === deleteTarget.id)) {
          throw new Error('This conversation could not be deleted. Check your access and try again.');
        }
        setSessions(sess);
        if (deleteTarget.id === sessionId) handleNewChat();
      }
    } catch (e) {
      console.error('Failed to delete chat history.', e);
      setDeleteError(e.message || 'Failed to delete conversation history. Please try again.');
      setDeleting(false);
      return;
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleFollowUp = (text) => {
    sendMessage(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 flex">
      {/* ── Sidebar (Chat history) ── */}
      <AnimatePresence>
        {showSidebar && (
          <>
            {/* Backdrop on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed lg:relative z-40 w-72 h-full bg-white border-r border-gray-200 flex flex-col"
            >
              {/* New Chat button */}
              <div className="p-3 border-b border-gray-100">
                <button
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" /> New Chat
                </button>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto p-2">
                {sessionsLoading ? (
                  <p role="status" className="text-xs text-gray-400 text-center py-8">Loading conversations…</p>
                ) : sidebarError ? (
                  <div className="px-3 py-6 text-center">
                    <AlertCircle className="w-8 h-8 text-red-300 mx-auto mb-2" />
                    <p className="text-xs text-red-500">{sidebarError}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => loadSessions()}>Retry</Button>
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">No conversations yet</p>
                ) : (
                  <div className="space-y-1">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          s.id === sessionId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                        onClick={() => handleLoadSession(s.id)}
                      >
                        <MessageSquare className="w-4 h-4 flex-shrink-0 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {s.title || s.preview || 'New conversation'}
                          </p>
                          <p className="text-xs text-gray-400">{new Date(s.date).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close button (mobile) */}
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 -ml-2 text-gray-500 hover:text-blue-600"
            >
              {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-sky-500 rounded-xl flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="font-semibold text-gray-800 text-sm">{t('chatAssistant')}</h1>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  AI Health Guide
                </p>
              </div>
            </div>
            <label className="sr-only" htmlFor="assistant-language">Assistant language</label>
            <select
              id="assistant-language"
              value={language}
              onChange={(event) => changeLanguage(event.target.value)}
              className="max-w-[106px] rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="te">Telugu</option>
              <option value="ta">Tamil</option>
            </select>
            <button
              type="button"
              onClick={() => setDeleteTarget({ id: sessionId, title: 'Current chat' })}
              className="p-2 text-gray-500 hover:text-red-600"
              aria-label="Delete current chat"
              title="Delete current chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setDeleteError(''); setDeleteTarget({ all: true }); }}
              className="text-xs font-medium text-red-600 hover:text-red-700 whitespace-nowrap"
            >
              Delete all chats
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="px-4 py-2 max-w-3xl mx-auto w-full">
          <Disclaimer compact />
          <p className="mt-1 text-center text-xs text-red-600">In an emergency call 108.</p>
          <p className="mt-1 text-center text-[11px] text-gray-400">Speech recognition uses the selected language.</p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 px-4 max-w-3xl mx-auto w-full overflow-y-auto" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {historyLoading ? (
              <div role="status" aria-label="Loading chat history" className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : historyError ? (
              <DataError message={historyError} onRetry={loadConversation} />
            ) : messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-sky-500'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-500'
                  }`}>
                    {msg.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className={`p-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-br-md'
                      : 'bg-white shadow-sm border border-gray-100 text-gray-700 rounded-bl-md'
                  }`}>
                    {msg.usedWebSearch && (
                      <div className="flex items-center gap-1 mb-1.5 text-[10px] font-medium text-blue-500">
                        <Globe className="w-3 h-3" /> Powered by web search
                      </div>
                    )}
                    {msg.model === 'claude-sonnet-5' && (
                      <div className="flex items-center gap-1 mb-1.5 text-[10px] font-medium text-purple-500">
                        <Sparkles className="w-3 h-3" /> Deep reasoning
                      </div>
                    )}
                    <div className="text-sm space-y-1">
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="my-1 pl-4 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="my-1 pl-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="my-0">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            h1: ({ children }) => <h3 className="font-bold mt-2 mb-1">{children}</h3>,
                            h2: ({ children }) => <h3 className="font-bold mt-2 mb-1">{children}</h3>,
                            a: ({ children, href }) => <a href={href} className="text-blue-500 underline" target="_blank" rel="noreferrer">{children}</a>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {msg.suggestFeature && msg.suggestFeature !== 'none' && featurePages[msg.suggestFeature] && (
                      <Button
                        size="sm"
                        className="mt-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
                        onClick={() => navigate(createPageUrl(featurePages[msg.suggestFeature].page))}
                      >
                        {featurePages[msg.suggestFeature].text}
                      </Button>
                    )}
                    {msg.followUps && msg.followUps.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.followUps.map((f, i) => (
                          <button
                            key={i}
                            onClick={() => handleFollowUp(f)}
                            className="text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded-full transition-colors"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="p-3 bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 bg-gray-300 rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && !isLoading && (
          <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => { setInput(prompt.text); inputRef.current?.focus(); }}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                >
                  <prompt.icon className="w-4 h-4 text-blue-500" />
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Persist error warning */}
        {persistError && (
          <div className="px-4 py-1.5 max-w-3xl mx-auto w-full">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">{persistError}</p>
            </div>
          </div>
        )}

        {/* Voice error */}
        {voiceError && (
          <div className="px-4 py-1.5 max-w-3xl mx-auto w-full">
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700 flex-1">{voiceError}</p>
              <button onClick={clearVoiceError} className="text-red-400 hover:text-red-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {speechError && (
          <div className="px-4 py-1.5 max-w-3xl mx-auto w-full">
            <p className="text-xs text-amber-700 text-center">{speechError}</p>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-gray-100 p-4 sticky bottom-0">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <div className="flex-1 min-w-0 flex items-end border border-gray-200 rounded-xl focus-within:border-blue-400">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                rows={1}
                className="flex-1 min-w-0 resize-none rounded-xl px-4 py-3 text-sm focus:outline-none max-h-32"
                style={{ minHeight: '48px' }}
              />
              {voiceSupported && (
                <Button
                  onClick={startVoiceConversation}
                  disabled={voiceMode}
                  className={`w-10 h-10 m-1 rounded-lg p-0 flex-shrink-0 ${voiceMode ? 'bg-purple-100 text-purple-700' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90'}`}
                  title="Start voice conversation"
                  aria-label="Start voice conversation"
                >
                  {isListening ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5 text-white" />}
                </Button>
              )}
            </div>
            {voiceMode && (
              <Button
                type="button"
                onClick={stopVoiceConversation}
                className="h-12 rounded-xl bg-red-500 px-3 text-white hover:bg-red-600"
              >
                Stop
              </Button>
            )}
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !userEmail}
              className="w-12 h-12 bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl p-0 flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
          {(isListening || isSpeaking || (voiceMode && isLoading)) && (
            <p className="text-xs text-center text-purple-700 mt-2" aria-live="polite">
              {isListening ? `Listening… ${interimTranscript}` : isSpeaking ? 'Speaking…' : 'Thinking…'}
            </p>
          )}
          {!voiceSupported && (
            <p className="text-xs text-gray-400 text-center mt-2">Voice recognition is unavailable in this browser. Type your message instead.</p>
          )}
        </div>
      </div>

      {/* ── Delete confirmation dialog ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">
                {deleteTarget.all ? 'Delete all chats?' : 'Delete conversation?'}
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                {deleteTarget.all
                  ? 'This will permanently delete all of your chat sessions and messages. This action cannot be undone.'
                  : 'This will permanently delete all messages in this conversation. This action cannot be undone.'}
              </p>
              {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleDeleteSession}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : deleteTarget.all ? 'Delete all' : 'Delete'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ChatAssistant() {
  return (
    <LanguageProvider>
      <ChatContent />
    </LanguageProvider>
  );
}