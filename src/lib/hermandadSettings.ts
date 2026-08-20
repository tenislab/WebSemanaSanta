import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { useEscuchaOtrasPestanas } from './persistencia'
import { hermandadActualId } from './multiHermandad'

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
  /** Segundo color de marca (dorado/acento), para detalles y degradados. */
  colorSecundario: string
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
  colorPrimario: '#6A1A23',
  colorSecundario: '#C5A059',
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
    colorPrimario: (r.color_primario as string) || '#6A1A23',
    colorSecundario: (r.color_secundario as string) || '#C5A059',
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
    color_secundario: s.colorSecundario,
    texto_pie_documentos: s.textoPieDocumentos,
  }
}

/**
 * Datos de la hermandad usados como membrete en los recibos (logo, nombre
 * legal, CIF, dirección, IBAN…). Se guardan en este navegador mientras no
 * hay Supabase; en cuanto se conecta, `useHermandadSettings` los trae de
 * `hermandad_settings` sin que cambie cómo los consume el resto de la app. Esta función de lectura directa sigue existiendo para el
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
    // Sin `.eq('id', …)`: todas las hermandades comparten tabla y las
    // políticas de Supabase ya hacen que esta cuenta solo vea su propia fila,
    // así que lo que llegue aquí es la suya y no hay otra. Antes se pedía la
    // fila 1 porque solo había una en toda la base; ahora la de cada
    // hermandad tiene el número que le tocó y pedir la 1 traería la de otra
    // —o, más probablemente, ninguna.
    supabase
      .from('hermandad_settings')
      .select('*')
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

  // Lo que cambie en otra pestaña (el panel y el área del hermano abiertos a
  // la vez) se refleja aquí sin recargar.
  useEscuchaOtrasPestanas(STORAGE_KEY, () => setSettings(getHermandadSettings(fallbackNombre)))

  return settings
}

/**
 * Guarda la configuración. Devuelve qué ha fallado, si algo, para que la
 * pantalla no diga «Guardado correctamente» pase lo que pase: se guardaban
 * logos de 800 KB que no cabían y el usuario se iba tan tranquilo.
 */
export async function saveHermandadSettings(settings: HermandadSettings): Promise<{ ok: boolean; error?: string }> {
  // PRIMERO en el navegador. Si se intentaba Supabase antes y la red fallaba,
  // se salía con un error y lo escrito NO se guardaba ni siquiera aquí: el
  // usuario perdía el rato de rellenar la ficha de la hermandad. El resto de
  // módulos (tramos, catálogos…) ya hacían lo correcto.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    return {
      ok: false,
      error: 'No cabe en el navegador. Suele pasar con logos muy grandes: prueba con una imagen más ligera.',
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // `upsert`, no `update`: si por lo que sea la fila todavía no existe,
      // el update afectaría a cero filas sin devolver error y el usuario se
      // iría creyendo que ha guardado.
      //
      // Lo que decide si es alta o modificación es `hermandad_id`, no el
      // número de fila: cada hermandad tiene la suya y hay un índice único
      // que lo garantiza.
      const hermandadId = await hermandadActualId()
      if (!hermandadId) throw new Error('no se ha podido saber a qué hermandad pertenece esta sesión')
      const { error } = await supabase
        .from('hermandad_settings')
        .upsert({ hermandad_id: hermandadId, ...settingsToRow(settings) }, { onConflict: 'hermandad_id' })
      if (error) throw new Error(error.message)
    } catch (err) {
      console.error('No se pudo sincronizar la configuración de la hermandad:', err)
      return {
        ok: false,
        error: 'Guardado en este navegador, pero no se ha podido enviar a la base de datos. Revisa la conexión.',
      }
    }
  }
  return { ok: true }
}
