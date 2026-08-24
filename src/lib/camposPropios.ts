import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { guardarPlantilla, traerPlantilla } from './plantillasHermandad'

/**
 * Campos a medida de la ficha del hermano. Cada hermandad apunta cosas
 * distintas —la talla de la túnica, el número de llave de la casa hermandad,
 * si tiene el carné de costalero al día— y no tiene sentido inventarse un
 * campo fijo para cada una. Aquí la hermandad define los suyos.
 *
 * El valor se guarda SIEMPRE como texto en `Hermano.campos`, indexado por el
 * id del campo. Así, si mañana se cambia el tipo de un campo, lo escrito no se
 * pierde: como mucho deja de encajar y se vuelve a elegir.
 */

export type TipoCampo = 'texto' | 'numero' | 'siNo' | 'lista' | 'fecha'

export const TIPOS_CAMPO: { id: TipoCampo; nombre: string; ejemplo: string }[] = [
  { id: 'texto', nombre: 'Texto', ejemplo: 'Alergias, observaciones…' },
  { id: 'numero', nombre: 'Número', ejemplo: 'Nº de llave, talla…' },
  { id: 'siNo', nombre: 'Sí o no', ejemplo: '¿Tiene carné de costalero?' },
  { id: 'lista', nombre: 'Lista de opciones', ejemplo: 'Talla: S, M, L, XL' },
  { id: 'fecha', nombre: 'Fecha', ejemplo: 'Fecha de la jura de reglas' },
]

export interface CampoPropio {
  id: string
  nombre: string
  tipo: TipoCampo
  /** Solo para el tipo «lista». */
  opciones: string[]
  /** Una línea de ayuda bajo el campo, opcional. */
  ayuda: string
  /** Se pide también al dar de alta a un hermano nuevo. */
  enAlta: boolean
}

export const CLAVE_CAMPOS_PROPIOS = 'cabildo-campos-propios'

/**
 * Con qué arranca una hermandad nueva. Son ejemplos reales de lo que las
 * hermandades apuntan a mano en una hoja aparte.
 */
export const CAMPOS_PROPIOS_INICIALES: CampoPropio[] = [
  {
    id: 'cp-talla',
    nombre: 'Talla de túnica',
    tipo: 'lista',
    opciones: ['Infantil', 'S', 'M', 'L', 'XL', 'XXL'],
    ayuda: 'La que usa en la estación de penitencia.',
    enAlta: false,
  },
  {
    id: 'cp-observaciones',
    nombre: 'Observaciones',
    tipo: 'texto',
    opciones: [],
    ayuda: 'Lo que secretaría deba tener en cuenta.',
    enAlta: false,
  },
]

export function getCamposPropios(): CampoPropio[] {
  return leerPersistido<CampoPropio[]>(CLAVE_CAMPOS_PROPIOS, CAMPOS_PROPIOS_INICIALES).map(conDefectos)
}

/** Los guardados por una versión anterior pueden no traer todos los campos. */
function conDefectos(c: Partial<CampoPropio>): CampoPropio {
  return {
    id: c.id ?? 'cp',
    nombre: c.nombre ?? '',
    tipo: c.tipo ?? 'texto',
    opciones: c.opciones ?? [],
    ayuda: c.ayuda ?? '',
    enAlta: c.enAlta ?? false,
  }
}

const EVENTO = 'cabildo-campos-propios'

export function saveCamposPropios(campos: CampoPropio[]) {
  localStorage.setItem(CLAVE_CAMPOS_PROPIOS, JSON.stringify(campos))
  window.dispatchEvent(new Event(EVENTO))
  /*
   * Y A LA BASE, porque los campos los define LA HERMANDAD.
   *
   * Aquí pasaba algo peculiar: el VALOR sí viajaba y la DEFINICIÓN no. Lo que
   * se escribe en «Talla de túnica» se guarda dentro de la ficha del hermano
   * (`Hermano.campos`), y esa ficha va a Supabase como todo lo demás. Pero la
   * lista de qué campos existen se quedaba en el navegador de quien los creó.
   *
   * O sea: la secretaria creaba el campo, rellenaba cuatrocientas tallas, y
   * desde el ordenador del mayordomo la ficha no enseñaba ninguna — el dato
   * estaba guardado y no había forma de verlo. Y al cerrar sesión se limpia
   * todo lo que empieza por `cabildo-`, así que también desaparecía del suyo.
   */
  void guardarPlantilla('campos_propios', campos)
}

/** Trae los campos de la hermandad y los deja en la copia de este navegador. */
export async function cargarCamposPropiosDeLaBase(): Promise<void> {
  const c = await traerPlantilla<CampoPropio[]>('campos_propios')
  // Una lista vacía es una respuesta válida —la hermandad borró todos sus
  // campos— y por eso se comprueba que sea un array, no que tenga cosas.
  if (!Array.isArray(c)) return
  localStorage.setItem(CLAVE_CAMPOS_PROPIOS, JSON.stringify(c))
  window.dispatchEvent(new Event(EVENTO))
}

/** Hook con los campos propios y un setter que persiste. */
export function useCamposPropios(): [CampoPropio[], (siguiente: CampoPropio[]) => void] {
  const [campos, setCamposState] = useState<CampoPropio[]>(() => getCamposPropios())

  useEffect(() => {
    function sincronizar() {
      setCamposState(getCamposPropios())
    }
    window.addEventListener('storage', sincronizar)
    window.addEventListener(EVENTO, sincronizar)
    // Al montar, lo que diga la base manda sobre lo que hubiera aquí.
    void cargarCamposPropiosDeLaBase()
    return () => {
      window.removeEventListener('storage', sincronizar)
      window.removeEventListener(EVENTO, sincronizar)
    }
  }, [])

  function setCampos(siguiente: CampoPropio[]) {
    setCamposState(siguiente)
    saveCamposPropios(siguiente)
  }

  return [campos, setCampos]
}

/** Cómo se enseña el valor de un campo (vacío = «—»). */
export function valorLegible(campo: CampoPropio, valor: string | undefined): string {
  const v = (valor ?? '').trim()
  if (!v) return '—'
  if (campo.tipo === 'siNo') return v === 'si' ? 'Sí' : 'No'
  if (campo.tipo === 'fecha') {
    const d = new Date(`${v}T00:00:00`)
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return v
}
