import selectedClient from '@api-client';

// Visible in the browser console (F12) so we can always tell which backend is active.
const backendName = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'
  ? 'sample-data mock'
  : import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? 'Supabase'
    : 'EMPTY STUB (check .env)';
console.info('MediTrust backend:', backendName);

export const db = selectedClient;

export const base44 = db;
export default db;