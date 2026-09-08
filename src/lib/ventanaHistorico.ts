/**
 * NO TRAERSE DIEZ AÑOS DE RECIBOS PARA ENSEÑAR LOS DE ESTE.
 *
 * ============================================================================
 * SI ERES UN PROGRAMADOR Y ACABAS DE LLEGAR: EL PROBLEMA QUE RESUELVE
 * ============================================================================
 *
 * Gobergo se trae las tablas ENTERAS al navegador y filtra allí. Eso es lo que
 * hace que vaya instantáneo y que aguante con la red mala de una casa de
 * hermandad, y no es un error: es la decisión que sostiene todo lo demás.
 *
 * Pero tiene un techo, y el techo no lo pone el número de hermandades. Lo pone
 * EL TIEMPO. La aplicación no se rompe cuando ganas clientes: se rompe cuando
 * los que ya tienes se hacen viejos.
 *
 *   Una hermandad de 800 hermanos, con cuota trimestral:
 *
 *     año 1   →   3.200 recibos   ≈ 1 MB
 *     año 5   →  16.000 recibos   ≈ 4,5 MB
 *     año 10  →  32.000 recibos   ≈ 9 MB
 *
 * `localStorage` da unos 5 MB por dominio en casi todos los navegadores. O sea
 * que LA MISMA HERMANDAD que hoy va perfecta deja de caber sola en el año seis
 * o siete, sin que nadie cambie nada, solo porque pasa el tiempo. Y cuando no
 * cabe, `espejarEnLocal` se come el error en silencio y el espejo se queda
 * congelado — que es peor que romperse, porque no se nota.
 *
 * Y todo eso para nada: la pantalla de Cuotas enseña UN ejercicio.
 *
 * ----------------------------------------------------------------------------
 * LA VENTANA
 * ----------------------------------------------------------------------------
 *
 * Se trae el ejercicio en curso y el anterior. Dos, y no uno, porque en enero
 * media hermandad sigue cobrando lo del año pasado y porque los informes
 * comparan siempre contra el ejercicio anterior.
 *
 * MÁS —y esto es lo que hace que la ventana no cambie ninguna cifra—:
 *
 *     TODO LO QUE SIGA SIN COBRAR, DE CUALQUIER AÑO.
 *
 * La «deuda viva» de Cuotas suma los recibos pendientes, devueltos y en mora DE
 * CUALQUIER EJERCICIO. Una ventana a secas la habría dejado corta y nadie se
 * habría enterado: el número sale, es plausible, y está mal. Metiendo lo no
 * cobrado dentro de la ventana, la cifra sigue siendo exacta.
 *
 * Lo que se queda fuera es lo que ya está cerrado y cobrado de hace años, que
 * es justo lo que no se mira nunca y lo que ocupa casi todo.
 *
 * ----------------------------------------------------------------------------
 * LAS DOS MITADES TIENEN QUE DECIR LO MISMO. POR ESO VIVEN AQUÍ JUNTAS.
 * ----------------------------------------------------------------------------
 *
 * Cada ventana son dos cosas:
 *
 *   · `filtroOr` — lo que se le manda a la base de datos (sintaxis PostgREST).
 *   · `dentro()` — la misma pregunta, pero sobre un objeto ya en memoria.
 *
 * `dentro()` la usa el espejo del navegador para saber qué filas viejas puede
 * CONSERVAR de lo que ya tenía guardado (ver `supabaseSync.ts`). Si las dos
 * mitades no dicen exactamente lo mismo, el espejo empieza a duplicar filas o a
 * tirarlas, y eso no da ningún error: da unos totales que no cuadran.
 *
 * Están en el mismo fichero, una debajo de la otra, y hay una prueba
 * (`pruebas/ventana.prueba.mjs`) que las compara contra la misma lista de
 * recibos. Si tocas una, tocas la otra.
 *
 * ----------------------------------------------------------------------------
 * ESTO ESTÁ APAGADO HASTA QUE SE ENCIENDE
 * ----------------------------------------------------------------------------
 *
 * Va detrás de la bandera `cuotas-ventana` (ver `src/lib/novedades.ts`). Con la
 * bandera apagada —que es como nace— se trae todo, exactamente igual que
 * siempre. Se enciende primero para una hermandad piloto, se mira una semana, y
 * luego para todas. Cambiar QUÉ DATOS HAY EN PANTALLA es la clase de cambio que
 * no se despliega a cincuenta hermandades de golpe.
 */

/** Cuántos ejercicios se traen: el de ahora y el de antes. */
export const EJERCICIOS_QUE_SE_TRAEN = 2

export interface Ventana<T> {
  /** El filtro que va a la base, en sintaxis `or` de PostgREST. */
  filtroOr: string
  /** La misma pregunta sobre un objeto de memoria. Tiene que decir lo mismo. */
  dentro: (item: T) => boolean
}

/** Lo que necesita saberse de un recibo para situarlo en el tiempo. */
export interface ReciboParaVentana {
  ejercicio?: number | null
  fechaEmision?: string
  estado?: string
}

/**
 * El ejercicio de un recibo. `ejercicio` cuando lo trae; si no —datos de antes
 * de que esa columna existiera— el año de la fecha de emisión.
 *
 * Es la misma regla que usa `ejercicioDe()` en la lógica de cuotas. Se repite
 * aquí, en pequeño, para que este módulo no arrastre media aplicación detrás
 * cuando lo carga el banco de pruebas.
 */
export function ejercicioDelRecibo(c: ReciboParaVentana): number | null {
  if (typeof c.ejercicio === 'number' && Number.isFinite(c.ejercicio)) return c.ejercicio
  const anio = Number(String(c.fechaEmision ?? '').slice(0, 4))
  return Number.isFinite(anio) && anio > 1900 ? anio : null
}

/**
 * LA VENTANA DE LAS CUOTAS.
 *
 * `desde` es el ejercicio más antiguo que se trae entero. Todo lo anterior solo
 * entra si sigue sin cobrar.
 *
 * OJO CON EL `neq` DE POSTGREST: `estado.neq.Pagada` es «distinto de Pagada»,
 * y en SQL una columna a NULL NO es distinta de nada — `null <> 'Pagada'` da
 * `null`, no `true`. Aquí da igual porque `estado` es `not null` en el esquema,
 * pero si algún día deja de serlo, esta línea empieza a dejarse recibos fuera
 * sin decir nada.
 */
export function ventanaDeCuotas<T extends ReciboParaVentana>(desde: number): Ventana<T> {
  return {
    filtroOr: `ejercicio.gte.${desde},estado.neq.Pagada`,
    dentro: (c) => {
      const e = ejercicioDelRecibo(c)
      if (e !== null && e >= desde) return true
      // Lo no cobrado entra siempre, de cualquier año. Ver arriba.
      return c.estado !== 'Pagada'
    },
  }
}

/** Lo que necesita saberse de una papeleta. */
export interface PapeletaParaVentana {
  anio?: number | null
  estado?: string
}

/**
 * LA VENTANA DE LAS PAPELETAS.
 *
 * Aquí no hace falta el «más lo no cobrado» de las cuotas: una papeleta de hace
 * cuatro años sin pagar no es deuda de nadie, es una papeleta que no se llegó a
 * recoger. Nadie la reclama y ninguna cifra de la aplicación la suma.
 *
 * La papeleta SIEMPRE trae año (`anio` es `not null`), así que el filtro es
 * limpio: un `gte` y ya está.
 */
export function ventanaDePapeletas<T extends PapeletaParaVentana>(desde: number): Ventana<T> {
  return {
    filtroOr: `anio.gte.${desde}`,
    dentro: (p) => typeof p.anio === 'number' && p.anio >= desde,
  }
}

/** El año más antiguo que se trae, dado el ejercicio en curso. */
export function desdeQueEjercicio(enCurso: number): number {
  return enCurso - (EJERCICIOS_QUE_SE_TRAEN - 1)
}
