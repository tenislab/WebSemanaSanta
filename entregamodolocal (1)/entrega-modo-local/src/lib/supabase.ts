import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Indica si hay credenciales de Supabase configuradas (variables de entorno
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 *
 * - SIN configurar (modo local / demostración): toda la app funciona con
 *   localStorage, sin necesidad de base de datos. Se pueden crear personal y
 *   hermanos, y esas cuentas pueden iniciar sesión, todo en el navegador.
 *   Es el modo pensado para trabajar mientras no se conecta Supabase.
 * - CONFIGURADO (modo real): los datos viven en Supabase y el login usa
 *   Supabase Auth.
 *
 * Para forzar el modo local en producción (p. ej. mientras el proyecto de
 * Supabase esté en pausa), basta con NO definir esas variables de entorno en
 * Vercel.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Cliente principal de Supabase. Es `null` en modo local (sin credenciales).
 * El resto de la app comprueba `isSupabaseConfigured` antes de usarlo.
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

/**
 * Cliente SOLO para dar de alta cuentas de otras personas (personal,
 * hermanos) desde una sesión de administrador. No persiste sesión, así que
 * crear cuentas con signUp() no expulsa al administrador de la suya.
 */
export const supabaseAlta: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'cabildo-alta',
      },
    })
  : null
