import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

export interface HermandadSettings {
  nombreLegal: string
  cif: string
  direccion: string
  codigoPostal: string
  ciudad: string
  provincia: string
  telefono: string
  email: string
  iban: string
  /** Teléfono asociado al Bizum de la hermandad, para que los hermanos paguen papeletas y donativos. */
  bizumTelefono: string
  /** Identificador de acreedor SEPA (p. ej. ES23000B12345678), para las remesas de adeudo directo. */
  identificadorAcreedor: string
  /** Imagen del logo como data URL (subida desde el navegador, sin backend). */
  logoDataUrl: string | null
  /** Color de marca de la hermandad; tiñe los botones y acentos de su área del hermano. */
  colorPrimario: string
  /** Texto legal del pie de recibos y justificantes (exención fiscal, registro…); si está vacío se usa uno genérico. */
  textoPieDocumentos: string
}

const STORAGE_KEY = 'cabildo-hermandad-settings'

const EMPTY: HermandadSettings = {
  nombreLegal: '',
  cif: '',
  direccion: '',
  codigoPostal: '',
  ciudad: '',
  provincia: '',
  telefono: '',
  email: '',
  iban: '',
  bizumTelefono: '',
  identificadorAcreedor: '',
  logoDataUrl: null,
  colorPrimario: '#caa24a',
  textoPieDocumentos: '',
}

function rowToSettings(r: Record<string, unknown>, fallbackNombre?: string): HermandadSettings {
  return {
    nombreLegal: (r.nombre_legal as string) || fallbackNombre || '',
    cif: (r.cif as string) ?? '',
    direccion: (r.direccion as string) ?? '',
    codigoPostal: (r.codigo_postal as string) ?? '',
    ciudad: (r.ciudad as string) ?? '',
    provincia: (r.provincia as string) ?? '',
    telefono: (r.telefono as string) ?? '',
    email: (r.email as string) ?? '',
    iban: (r.iban as string) ?? '',
    bizumTelefono: (r.bizum_telefono as string) ?? '',
    identificadorAcreedor: (r.identificador_acreedor as string) ?? '',
    logoDataUrl: (r.logo_data_url as string | null) ?? null,
    colorPrimario: (r.color_primario as string) || '#caa24a',
    textoPieDocumentos: (r.texto_pie_documentos as string) ?? '',
  }
}

function settingsToRow(s: HermandadSettings): Record<string, unknown> {
  return {
    nombre_legal: s.nombreLegal,
    cif: s.cif,
    direccion: s.direccion,
    codigo_postal: s.codigoPostal,
    ciudad: s.ciudad,
    provincia: s.provincia,
    telefono: s.telefono,
    email: s.email,
    iban: s.iban,
    bizum_telefono: s.bizumTelefono,
    identificador_acreedor: s.identificadorAcreedor,
    logo_data_url: s.logoDataUrl,
    color_primario: s.colorPrimario,
    texto_pie_documentos: s.textoPieDocumentos,
  }
}

/**
 * Datos de la hermandad usados como membrete en los recibos (logo, nombre
 * legal, CIF, dirección, IBAN…). Se guardan en este navegador mientras no
 * hay Supabase; en cuanto se conecta, `useHermandadSettings` los trae de la
 * fila única `hermandad_settings` (id 1) sin que cambie cómo los consume el
 * resto de la app. Esta función de lectura directa sigue existiendo para el
 * primer render (sin esperar a la red) y como caché de reserva.
 */
export function getHermandadSettings(fallbackNombre?: string): HermandadSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<HermandadSettings>) }
  } catch {
    // localStorage no disponible o datos corruptos: seguimos con los valores por defecto
  }
  return { ...EMPTY, nombreLegal: fallbackNombre ?? '' }
}

/** Como `getHermandadSettings`, pero con Supabase conectado trae la fila real en cuanto llega. */
export function useHermandadSettings(fallbackNombre?: string): HermandadSettings {
  const [settings, setSettings] = useState<HermandadSettings>(() => getHermandadSettings(fallbackNombre))

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    supabase
      .from('hermandad_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado || error || !data) return
        const traidos = rowToSettings(data, fallbackNombre)
        setSettings(traidos)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(traidos))
        } catch {
          // sin espacio o sin localStorage: no pasa nada, ya está en memoria
        }
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return settings
}

export async function saveHermandadSettings(settings: HermandadSettings) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('hermandad_settings').update(settingsToRow(settings)).eq('id', 1)
    if (error) console.error('No se pudo guardar la configuración de la hermandad:', error.message)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // sin espacio o sin localStorage: la app sigue funcionando en memoria
  }
}
