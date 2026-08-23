/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Fecha/hora de construcción de esta versión (inyectada por Vite en el build). */
declare const __BUILD_TIME__: string
