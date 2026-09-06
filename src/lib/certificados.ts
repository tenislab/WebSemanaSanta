/**
 * EXPEDIR Y LISTAR CERTIFICADOS DE ANTIGÜEDAD.
 *
 * TODO LO QUE SE IMPRIME LO RESUELVE LA BASE, y esto solo lo pide. Si el
 * navegador mandara el nombre o la antigüedad, cualquiera con la consola
 * abierta se expediría un certificado de 1950 — y este papel se enseña fuera,
 * que es justamente donde nadie puede comprobarlo.
 *
 * Con la demostración pasa lo mismo pero contra la copia del navegador: la
 * cuenta se hace aquí, no la manda la pantalla.
 */
import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabase'
import { CLAVES_DATOS, leerPersistido } from './persistencia'
import { nuevoId } from './supabaseSync'
import { hoyIso } from './hoy'
import { fechaEs } from './leerTabla'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import type { Certificado } from '../data/certificados'

/** Sin base de datos, los certificados viven en el navegador: es la demostración. */
function enLocal(): boolean {
  return !isSupabaseConfigured || !supabase
}

function leerLocales(): Certificado[] {
  return leerPersistido<Certificado[]>(CLAVES_DATOS.certificados, [])
}

function guardarLocales(lista: Certificado[]) {
  try {
    localStorage.setItem(CLAVES_DATOS.certificados, JSON.stringify(lista))
  } catch {
    // Sin sitio o en navegación privada: se queda en memoria. No es un dato de
    // una hermandad de verdad, es una demostración.
  }
}

function deFila(r: Record<string, unknown>): Certificado {
  const creado = String(r.creado_en ?? '')
  return {
    id: String(r.id),
    anio: Number(r.anio ?? 0),
    numero: Number(r.numero ?? 0),
    hermanoId: (r.hermano_id as string | null) ?? undefined,
    hermanoNombre: String(r.hermano_nombre ?? ''),
    hermanoDni: String(r.hermano_dni ?? ''),
    hermanoNumero: Number(r.hermano_numero ?? 0),
    antiguedad: Number(r.antiguedad ?? 0),
    aniosDeAntiguedad: Number(r.anios_de_antiguedad ?? 0),
    motivo: String(r.motivo ?? ''),
    firmaSecretario: String(r.firma_secretario ?? ''),
    firmaHermanoMayor: String(r.firma_hermano_mayor ?? ''),
    emitidoPor: String(r.emitido_por ?? ''),
    // La fecha como se lee en el papel. `creado_en` es un `timestamptz` y llega
    // en UTC: cortarlo a pelo fecharía de ayer un certificado expedido a las
    // once de la noche. Ver `lib/hoy.ts`.
    fecha: fechaEs(creado ? hoyIso(new Date(creado)) : hoyIso()),
    creadoEn: creado,
  }
}

/**
 * Los certificados que ya se le han expedido a un hermano.
 *
 * Importa más de lo que parece: lo primero que hace la secretaría cuando le
 * piden uno es mirar si ya se lo dio, y con qué número.
 */
export function useCertificadosDe(hermanoId: string | null): {
  certificados: Certificado[]
  cargando: boolean
  recargar: () => void
} {
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [cargando, setCargando] = useState(true)
  const [vez, setVez] = useState(0)

  useEffect(() => {
    if (!hermanoId) { setCertificados([]); setCargando(false); return }
    if (enLocal()) {
      setCertificados(leerLocales().filter((c) => c.hermanoId === hermanoId))
      setCargando(false)
      return
    }
    let cancelado = false
    setCargando(true)
    void supabase!.from('certificados').select('*')
      .eq('hermano_id', hermanoId).order('creado_en', { ascending: false })
      .then(({ data, error }) => {
        if (cancelado) return
        setCertificados(error || !data ? [] : (data as Record<string, unknown>[]).map(deFila))
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [hermanoId, vez])

  return { certificados, cargando, recargar: () => setVez((v) => v + 1) }
}

/**
 * EXPEDIRLO. Devuelve el certificado ya registrado, con su número.
 *
 * El mensaje de la base va tal cual: los suyos están escritos para leerlos en
 * pantalla («ese hermano figura de baja: no se le puede certificar que está
 * inscrito»), y cambiarlos por un «no se ha podido» le quita a quien está en
 * secretaría la única pista de qué pasa.
 */
export async function emitirCertificado(hermanoId: string, motivo = ''): Promise<
  { ok: true; certificado: Certificado } | { ok: false; error: string }
> {
  if (enLocal()) return emitirLocal(hermanoId, motivo)
  try {
    const { data, error } = await supabase!.rpc('emitir_certificado', {
      p_hermano_id: hermanoId, p_motivo: motivo,
    })
    if (error) return { ok: false, error: error.message }
    const id = (data as { id?: string } | null)?.id
    if (!id) return { ok: false, error: 'La base no ha devuelto el certificado.' }
    // Se relee lo que quedó guardado, en vez de armarlo con lo que la pantalla
    // creía: lo que se imprime tiene que ser lo que hay en el registro.
    const { data: fila, error: e2 } = await supabase!
      .from('certificados').select('*').eq('id', id).maybeSingle()
    if (e2 || !fila) {
      return { ok: false, error: 'Se ha expedido, pero no se ha podido traer para imprimirlo. Está en la ficha.' }
    }
    return { ok: true, certificado: deFila(fila as Record<string, unknown>) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido expedir.' }
  }
}

function emitirLocal(hermanoId: string, motivo: string):
  { ok: true; certificado: Certificado } | { ok: false; error: string } {
  const censo = leerPersistido<Hermano[]>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
  const h = censo.find((x) => x.id === hermanoId)
  if (!h) return { ok: false, error: 'Ese hermano ya no está en el censo.' }
  // El mismo freno que la base: de quien causó baja se puede certificar que LO
  // FUE, y eso es otro papel con otro texto.
  if (h.estado === 'Baja') {
    return { ok: false, error: 'Ese hermano figura de baja: no se le puede certificar que está inscrito.' }
  }

  const anio = Number(hoyIso().slice(0, 4))
  const lista = leerLocales()
  const numero = lista.filter((c) => c.anio === anio).reduce((m, c) => Math.max(m, c.numero), 0) + 1
  const firma = (cargo: string) => censo.find((x) => x.cargo === cargo && x.estado !== 'Baja')?.nombre ?? ''

  const certificado: Certificado = {
    id: nuevoId(),
    anio,
    numero,
    hermanoId: h.id,
    hermanoNombre: h.nombre,
    hermanoDni: h.dni ?? '',
    hermanoNumero: h.numero ?? 0,
    antiguedad: h.antiguedad ?? 0,
    // Nunca negativo: una antigüedad mal importada con un año futuro daría
    // «lleva −3 años» en un papel que se enseña fuera.
    aniosDeAntiguedad: Math.max(0, anio - (h.antiguedad || anio)),
    motivo: motivo.trim().slice(0, 300),
    firmaSecretario: firma('Secretario/a'),
    firmaHermanoMayor: firma('Hermano Mayor'),
    emitidoPor: '',
    fecha: fechaEs(hoyIso()),
    creadoEn: new Date().toISOString(),
  }
  guardarLocales([certificado, ...lista])
  return { ok: true, certificado }
}
