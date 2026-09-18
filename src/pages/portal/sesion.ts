/**
 * LA SESIÓN DEL HERMANO Y LOS AYUDANTES DEL ÁREA.
 *
 * Quién está dentro, cómo se guarda, a dónde se le devuelve y las cuatro
 * funciones sueltas que usan las dos pantallas del área (la de identificarse y
 * el portal).
 *
 * Está aparte porque NO es interfaz: es lógica que se puede ejecutar con datos.
 * Dentro de `HermanoPortal.tsx` no se podía probar ni una línea de esto, y hay
 * cosas que merecen prueba —`aDondeVolver`, que decide si un destino que viene
 * de la URL es de fiar, la más clara—.
 */
import { type TipoEvento } from '../../data/eventos'
import { HERMANDADES_MUESTRA } from '../../lib/hermandades'
import { leerPersistido } from '../../lib/persistencia'
import { CLAVE_SESION_HERMANO } from '../../lib/sesion'
import { claveSolicitudesMuestra, type SolicitudAlta } from '../../lib/solicitudes'
import { useMemo, useState } from 'react'

/**
 * «SIN DATOS» NO SE ESCRIBE DENTRO DE UN CAMPO PARA RELLENAR.
 *
 * Cuando se da de alta a un hermano sin teléfono ni dirección, la ficha guarda
 * literalmente la cadena «Sin datos» —sirve para que las listas de secretaría
 * no salgan con huecos—. Pero al hermano, en su área, le aparecía ese texto
 * DENTRO del recuadro del teléfono, y para poner el suyo tenía que borrarlo
 * primero. Muchos escribían detrás: «Sin datos 600123456».
 *
 * Aquí se cambia por un `placeholder`, que es lo que hace de verdad: dice qué
 * va en el hueco y desaparece al escribir.
 */
export function siNoEsElHueco(valor: string): string {
  return valor === 'Sin datos' ? '' : valor
}

/** Lo que se le enseña al hermano: los cabildos y la formación interna no. */
export const TIPOS_PARA_HERMANOS = new Set<TipoEvento>(['Culto', 'Salida', 'Caridad', 'Convivencia', 'Formación'])

/* La clave vive en `lib/sesion.ts` para que el panel también pueda cerrarla. */
export const SESION_KEY = CLAVE_SESION_HERMANO
export const CONSENT_KEY = 'cabildo-hermano-consent'
export const DNI_DEMO = 'h4' // Francisco Gómez Nieto, nº 501 · usado por el botón "hermano de prueba"


export interface Sesion {
  hermandadId: string
  hermanoId: string
}

export function leerSesion(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(SESION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Sesion>
    if (parsed && typeof parsed.hermandadId === 'string' && typeof parsed.hermanoId === 'string') {
      return { hermandadId: parsed.hermandadId, hermanoId: parsed.hermanoId }
    }
  } catch {
    // sesión corrupta o de un formato anterior: se ignora
  }
  return null
}

export function guardarSesion(sesion: Sesion) {
  sessionStorage.setItem(SESION_KEY, JSON.stringify(sesion))
}

/**
 * A DÓNDE VOLVER DESPUÉS DE ENTRAR, si a esta pantalla se llegó desde otro sitio.
 *
 * Lo usa la tienda de la web pública: «¿Eres hermano? Entra y verás tu precio»
 * manda aquí con `?volver=/w/mi-hermandad#tienda`, y al entrar se vuelve al
 * escaparate con los precios ya rebajados. Sin esto, quien pulsa ese enlace
 * acaba en su área del hermano preguntándose qué ha pasado con su cesta.
 *
 * SOLO SE ADMITE UN CAMINO DE ESTA MISMA WEB: tiene que empezar por una barra y
 * NO por dos. `//otrositio.com` es una dirección absoluta con el esquema
 * heredado, así que sin la segunda comprobación bastaría con mandarle a alguien
 * `…/hermano?volver=//parecido-a-gobergo.com` para que, tras teclear su DNI y
 * su contraseña aquí, acabara en una página ajena.
 */
export function aDondeVolver(destino: string | null): string | null {
  if (!destino) return null
  if (!destino.startsWith('/') || destino.startsWith('//')) return null
  return destino
}

/**
 * Un hermano dado de baja no entra en su área. Se le dice por qué: un «DNI o
 * contraseña incorrectos» le haría probar diez veces y llamar a secretaría
 * pensando que ha perdido la clave.
 */
export const MENSAJE_BAJA =
  'Tu ficha figura de baja en la hermandad, así que el área del hermano no está disponible. Si crees que es un error, habla con secretaría.'

export function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export type TablaMuestra<T> = Record<string, [T[], (updater: (prev: T[]) => T[]) => void]>

/** Censo o papeletas de cada hermandad de muestra, cada una con su clave propia — igual que en la base de datos real, cada hermandad vería solo sus filas. */
export function useTablaPorHermandad<T>(prefijoClave: string, porDefecto: (hermandadId: string) => T[]): TablaMuestra<T> {
  const [mapa, setMapa] = useState<Record<string, T[]>>(() =>
    Object.fromEntries(
      HERMANDADES_MUESTRA.map((h) => [h.id, leerPersistido(`${prefijoClave}-${h.id}`, porDefecto(h.id))]),
    ),
  )
  return useMemo(() => {
    const tabla: TablaMuestra<T> = {}
    for (const h of HERMANDADES_MUESTRA) {
      tabla[h.id] = [
        mapa[h.id] ?? [],
        (updater) => {
          setMapa((prev) => {
            const next = updater(prev[h.id] ?? [])
            localStorage.setItem(`${prefijoClave}-${h.id}`, JSON.stringify(next))
            return { ...prev, [h.id]: next }
          })
        },
      ]
    }
    return tabla
  }, [mapa, prefijoClave])
}

export function guardarSolicitudMuestra(hermandadId: string, nueva: SolicitudAlta) {
  const clave = claveSolicitudesMuestra(hermandadId)
  const prev = leerPersistido<SolicitudAlta[]>(clave, [])
  localStorage.setItem(clave, JSON.stringify([nueva, ...prev]))
}
