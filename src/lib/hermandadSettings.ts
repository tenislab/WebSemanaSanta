export interface HermandadSettings {
  nombreLegal: string
  cif: string
  direccion: string
  codigoPostal: string
  ciudad: string
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
  telefono: '',
  email: '',
  iban: '',
  bizumTelefono: '',
  identificadorAcreedor: '',
  logoDataUrl: null,
  colorPrimario: '#caa24a',
  textoPieDocumentos: '',
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
