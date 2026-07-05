import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Indica si las variables de entorno de Supabase están presentes.
 * Permite que la interfaz funcione y avise con claridad aunque todavía
 * no se haya conectado el proyecto de Supabase.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Cliente de Supabase. Es `null` mientras no haya credenciales configuradas
 * (ver `.env.example`). El resto de la app comprueba `isSupabaseConfigured`
 * antes de usarlo.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
