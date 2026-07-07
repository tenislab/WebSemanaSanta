export interface HermandadSettings {
  nombreLegal: string
  cif: string
  direccion: string
  codigoPostal: string
  ciudad: string
  telefono: string
  email: string
  iban: string
  /** Imagen del logo como data URL (subida desde el navegador, sin backend). */
  logoDataUrl: string | null
}

const STORAGE_KEY = 'cabildo-hermandad-settings'

const EMPTY: HermandadSettings = {
  nombreLegal: '',
  cif: '',
  direccion: '',
  codigoPostal: '',
  ciudad: '',
  telefono: '',
  email: '',
  iban: '',
  logoDataUrl: null,
}

/**
 * Datos de la hermandad usados como membrete en los recibos (logo, nombre
 * legal, CIF, dirección, IBAN…). Se guardan en este navegador mientras no
 * hay Supabase; en cuanto se conecte, pasarán a vivir en la base de datos
 * sin que cambie cómo los consume el resto de la app.
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

export function saveHermandadSettings(settings: HermandadSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
