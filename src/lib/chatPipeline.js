
// Shared chat pipeline used by both ChatAssistant and VoiceAssistant.
// The server selects one configured Gemini model to keep requests predictable and cost-conscious.
import { db } from '@/api/client';
import features from '@/config/features';

const LANG_NAMES = { en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil" };

// ── Session management ──────────────────────────────────────────────────────
export function getSessionId() {
  let id = sessionStorage.getItem("meditrust_chat_session");
  if (!id) {
    id = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem("meditrust_chat_session", id);
  }
  return id;
}

export function startNewSession() {
  const id = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  sessionStorage.setItem("meditrust_chat_session", id);
  return id;
}

// ── Language detection from text (for voice auto-detect) ─────────────────────
export function detectLanguage(text) {
  if (!text) return "en";
  // Devanagari (Hindi)
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  // Telugu
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  // Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  return "en";
}

// ── Conversation history ─────────────────────────────────────────────────────
export async function loadHistory(sessionId, email, limit = 100) {
  try {
    const page = await db.entities.ChatMessage.filter(
      { session_id: sessionId, user_email: email },
      { sort: "-created_date", limit }
    );
    const rows = page;
    return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
  } catch (e) {
    throw new Error("Failed to load chat history: " + (e.message || "Unknown error"));
  }
}

export async function persistMessage(sessionId, email, role, content, isTitle = false) {
  if (!email || !sessionId) return;
  await db.entities.ChatMessage.create({
    user_email: email,
    session_id: sessionId,
    role,
    content,
    is_title: isTitle,
  });
}

// ── List all sessions for a user (for history sidebar) ──────────────────────
export async function listSessions(email, limit = 100) {
  if (!email) return [];
  const page = await db.entities.ChatMessage.filter(
    { user_email: email },
    { sort: '-created_date', limit }
  );
  const rows = page;
  const seen = new Map();
  for (const m of rows) {
    if (!seen.has(m.session_id)) {
      seen.set(m.session_id, {
        id: m.session_id,
        preview: m.content.slice(0, 80),
        date: m.created_date,
        title: m.is_title ? m.content : null,
      });
    } else if (!seen.get(m.session_id).title && m.is_title) {
      seen.get(m.session_id).title = m.content;
    }
  }
  return Array.from(seen.values());
}

// ── Delete an entire conversation (all messages in a session) ───────────────
export async function deleteSession(email, sessionId) {
  if (!email || !sessionId) return;
  await db.entities.ChatMessage.deleteSession(sessionId);
}

// ── Complexity classifier (heuristic — no extra LLM cost) ───────────────────
const MEDICAL_KEYWORDS = [
  "pain", "fever", "symptom", "diagnos", "medicine", "disease", "condition",
  "treatment", "dosage", "side effect", "blood pressure", "diabetes", "cholesterol",
  "infection", "allerg", "nausea", "dizziness", "fatigue", "rash", "swelling",
  "headache", "migraine", "arthritis", "asthma", "hypertension", "anxiety",
  "depression", "insomnia", "cough", "cold", "flu", "viral", "bacterial",
  "antibiotic", "vaccine", "surgery", "chronic", "acute", "specialist",
  "cardiologist", "dermatologist", "neurologist", "pediatrician", "gynecologist",
  "why do i", "what causes", "how does", "which doctor", "should i take",
  "is it safe", "what are the", "explain", "difference between",
];

const SIMPLE_KEYWORDS = [
  "hello", "hi", "hey", "thanks", "thank you", "bye", "ok", "okay",
  "how do i book", "how to book", "where is", "how to find", "open",
  "show me", "navigate", "go to", "help me", "what can you do",
];

function classifyComplexity(message) {
  const lower = message.toLowerCase();
  const len = message.length;

  // Long, detailed questions → complex
  if (len > 150) return "complex";

  // Contains medical reasoning keywords → complex
  for (const kw of MEDICAL_KEYWORDS) {
    if (lower.includes(kw)) return "complex";
  }

  // Multi-sentence questions → complex
  const sentenceCount = (message.match(/[.?!]/g) || []).length;
  if (sentenceCount >= 2 && len > 60) return "complex";

  // Simple greetings/navigation → simple
  for (const kw of SIMPLE_KEYWORDS) {
    if (lower.includes(kw)) return "simple";
  }

  // Default: medium-length single questions → simple (flash can handle)
  return len > 80 ? "complex" : "simple";
}

// ── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(language, isComplex) {
  const langName = LANG_NAMES[language] || "English";
  let context = `You are MediTrust AI, a warm, capable multilingual assistant for Indian users. Hold a natural, respectful conversation, answer general questions directly, and help users navigate MediTrust. Use plain language and avoid sounding scripted.

CRITICAL RULES:
1. Reply in the language of the user's latest message. Use ${langName} only if the language is unclear or mixed.
2. Never diagnose, prescribe, or recommend changing prescribed treatment. Give general medical education and encourage licensed care when appropriate.
3. Be honest about uncertainty and do not claim live web search or verified current information.
4. Respond naturally to greetings and follow the user's conversational tone; don't force disclaimers or follow-up questions on unrelated topics.`;

  if (isComplex) {
    context += `

For a complex question, answer the actual question first, then give only the most useful supporting details and next step. Keep it clear and concise; do not reveal private chain-of-thought.`;
  } else {
    context += `

Keep simple answers brief and direct, usually one or two sentences.`;
  }

  const availableFeatures = [
    "find_doctors: Find Doctors — search and book appointments",
    ...(features.symptomChecker ? ["symptom_checker: Symptom Checker — educational information, not diagnosis"] : []),
    ...(features.pharmacy ? ["pharmacies: Pharmacies — find pharmacies and request medicine pickup"] : []),
  ];

  context += `

APP FEATURES YOU CAN RECOMMEND (set suggestFeature accordingly):
- ${availableFeatures.join("\n- ")}
- none: when no feature is relevant`;

  return context;
}

// ── Main entry: send a message through the upgraded pipeline ─────────────────
export async function sendChatMessage({ message, language, history }) {
  const complexity = classifyComplexity(message);
  const isComplex = complexity === "complex";
  const systemPrompt = buildSystemPrompt(language, isComplex);

  const recentMessages = [];
  let historyCharacters = 0;
  for (const item of (history || []).slice(-20).reverse()) {
    const remaining = 16000 - historyCharacters;
    if (remaining <= 0) break;
    const content = item.content.slice(0, Math.min(1200, remaining));
    recentMessages.unshift(`${item.role === "user" ? "User" : "Assistant"}: ${content}`);
    historyCharacters += content.length;
  }
  const conversation = recentMessages.join("\n\n");

  const fullPrompt = `${systemPrompt}

${conversation ? `RECENT CONVERSATION:\n${conversation}\n\n` : ""}
USER'S NEW MESSAGE:
${message}

Reply naturally in the latest user's language and use earlier messages to keep continuity. Don't repeat the conversation or the question. For medical information only, include a brief safety note and don't diagnose or prescribe. For app-navigation questions, give the next useful step. Suggest a follow-up only when it genuinely helps; otherwise return an empty array.`;

  const response = await db.integrations.Core.InvokeLLM({
    prompt: fullPrompt,
    max_output_tokens: isComplex ? 640 : 256,
    response_json_schema: {
      type: "object",
      properties: {
        response: { type: "string", description: "The assistant's reply in the user's language" },
        suggestFeature: {
          type: "string",
          enum: ["symptom_checker", "find_doctors", "pharmacies", "none"],
          description: "App feature to recommend, or none"
        },
        followUps: {
          type: "array",
          items: { type: "string" },
          description: "Up to two useful follow-up questions in the user's language, or an empty array"
        },
        usedWebSearch: {
          type: "boolean",
          description: "Whether web search results informed this answer"
        }
      }
    }
  });

  return {
    content: response.response || "",
    suggestFeature: response.suggestFeature || "none",
    followUps: Array.isArray(response.followUps) ? response.followUps.slice(0, 3) : [],
    usedWebSearch: response.usedWebSearch || false,
    model: response.model || "Gemini Flash",
    complexity,
  };
}