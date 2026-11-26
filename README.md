# Medi Trust

Healthcare platform connecting patients, doctors, and pharmacies.

## Stack
- Vite + React 18
- Tailwind CSS + shadcn/ui
- Framer Motion
- React Router
- React Query

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Phase 1 completed (standalone cleanup)
- Removed `@base44/sdk` and `@base44/vite-plugin` dependencies
- Fixed `vite.config.js` (no longer depends on Base44 plugin)
- Dev-only mock data client at `src/api/devMockClient.js`, selected by `src/api/client.js` when `VITE_USE_MOCK=true`
- Empty fallback client at `src/api/stubClient.js` for production and non-mock development builds
- Removed the repeated `globalThis.__B44_DB__` stub from 47 files; all now import the central client
- Cleaned `app-params.js` storage keys and env vars (`meditrust_*` instead of `base44_*`)
- Rewrote `AuthContext` for localStorage-based mock auth (ready for Directus later)
- Updated package name to `meditrust`
- Original entity schemas kept in `base44/entities/` as reference for future Directus mapping

## Notes for next phases
- Auth currently uses localStorage mock (see `src/lib/AuthContext.jsx` → `loginAs` helper)
- Chat & Voice assistants use the shared `src/lib/chatPipeline.js`
- Ready for UI redesign (Phase 2) and Directus backend connection

## AI assistant setup
- The browser calls the `ai` Supabase Edge Function; keep the Gemini API key out of frontend `.env` files and all `VITE_` variables.
- Add `GEMINI_API_KEY` under **Supabase → Edge Functions → Secrets**. The function prefers `gemini-3.5-flash-lite` and can discover another enabled Flash model if that model is unavailable for the key. `GEMINI_MODEL` can optionally override the preference.
- After changing `supabase/functions/ai/index.ts`, deploy it from the project root with `npx supabase login`, `npx supabase link --project-ref <project-ref>`, then `npx supabase functions deploy ai`. A local frontend build does not update the hosted Edge Function.
- The AI function retries transient Gemini timeouts, rate limits, and server errors once; the frontend retries transient function/network errors once. These bounded retries improve recovery but cannot guarantee uninterrupted service. Gemini quotas, billing, and provider availability still limit throughput; configure suitable quota/billing for expected usage rather than putting the API key in the browser.
- Chat history is saved in Supabase and recent messages are sent for conversational continuity.

## Main features
- Patient / Doctor / Pharmacy role dashboards
- Chat Assistant + Voice Assistant
- Symptom checker, medicine verification
- Appointment booking, prescriptions, pharmacy orders
- Health tracker, subscriptions, admin panel
