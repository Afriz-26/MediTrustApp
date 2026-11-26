import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useMock = mode === 'development' && env.VITE_USE_MOCK === 'true'
  const hasSupabaseConfig = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  const apiClient = useMock
    ? './src/api/devMockClient.js'
    : hasSupabaseConfig
      ? './src/api/supabaseClient.js'
      : './src/api/stubClient.js'

  return {
  logLevel: 'info',
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api-client': path.resolve(__dirname, apiClient),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  }
})
