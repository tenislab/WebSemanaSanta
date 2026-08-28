/**
 * LAS DEVOLUCIONES DEL BANCO.
 *
 * Se manda la remesa, el banco cobra, y unos días después devuelve una parte:
 * cuentas canceladas, saldos sin fondos, gente que ha reclamado el cargo. El
 * banco lo comunica en un fichero, y hasta ahora ese fichero no se podía
 * abrir en ninguna parte.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTO NO ES UN LUJO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sin leerlo, TODOS los recibos de la remesa se quedan «Pagada». O sea:
 *
 *   · La hermandad cree que ha cobrado un dinero que no tiene. El saldo del
 *     libro no cuadra con el banco y nadie sabe por qué.
 *   · Al hermano devuelto no se le vuelve a pasar el recibo —ya consta
 *     pagado—, así que se le acumula el año entero sin que nadie lo note.
 *   · Y a la remesa siguiente vuelve a entrar la cuenta cancelada, que se
 *     vuelve a devolver, con su comisión otra vez.
 *
 * Un fichero de veinte devoluciones son veinte hermanos con la cuota mal
 * puesta y una comisión por cada uno.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ FORMATO SE LEE, Y QUÉ NO — LEER ESTO ANTES DE AMPLIARLO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SE LEE **pain.002** (ISO 20022), que es lo que entrega hoy cualquier banco
 * para una remesa SEPA. Es el fichero que corresponde a las remesas que genera
 * `lib/sepa.ts`, que son pain.008.
 *
 * NO SE LEE el cuaderno antiguo de ancho fijo (19-14 y parientes), Y ES A
 * PROPÓSITO. Se reconoce y se dice qué pedirle al banco, pero no se interpreta:
 * para acertar sus columnas hay que saber exactamente en qué posición pone cada
 * banco cada cosa, y adivinarlas significaría leer el número de recibo de la
 * columna equivocada. Eso no falla con un error: marca como devuelta la cuota
 * DE OTRO HERMANO. Un fichero que no se entiende se rechaza; uno que se
 * malinterpreta se cobra dos veces y nadie se entera.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO SE RECONOCE CADA RECIBO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Por el `EndToEndId` que se puso al presentar: `REC-<número de recibo>`, en
 * `lib/sepa.ts`. El banco lo devuelve tal cual en `OrgnlEndToEndId`. Es el
 * único hilo que une el fichero de vuelta con la cuota, y por eso ese formato
 * no se puede tocar en un sitio sin tocarlo en el otro — hay una prueba que
 * vigila que sigan siendo el mismo.
 */

/**
 * POR QUÉ LO DEVUELVEN, en cristiano.
 *
 * Los códigos son los de las R-transactions de SEPA. Que el motivo se lea
 * importa más de lo que parece: no se hace lo mismo con cada uno.
 *
 *   · «Sin fondos» se vuelve a intentar el mes que viene.
 *   · «Cuenta cancelada» hay que llamar al hermano y pedirle otra: volver a
 *     pasarlo es otra comisión segura.
 *   · «Lo ha rechazado el titular» no es un problema del banco: es alguien que
 *     no quiere que le cobren, y eso lo arregla secretaría hablando.
 *
 * Con el código a secas —«AC04»— las tres se tratan igual, que es como se
 * acumulan las comisiones.
 */
export const MOTIVOS_DEVOLUCION: Record<string, string> = {
  AC01: 'El número de cuenta no tiene el formato correcto',
  AC04: 'La cuenta está cancelada',
  AC06: 'La cuenta está bloqueada',
  AC13: 'La cuenta del deudor es de un particular y no admite este cobro',
  AG01: 'Esa cuenta no admite domiciliaciones',
  AG02: 'La operación se ha mandado con un código que el banco no admite',
  AM04: 'No había saldo suficiente',
  AM05: 'Estaba repetido: ya se había cobrado',
  BE05: 'El identificador de acreedor de la hermandad no le consta al banco',
  CNOR: 'La hermandad no consta registrada como acreedor',
  DNOR: 'El banco del hermano no consta registrado',
  FF01: 'El fichero que se mandó no tenía el formato correcto',
  MD01: 'No hay mandato válido: el hermano no ha firmado la domiciliación',
  MD02: 'Al mandato le faltan datos obligatorios',
  MD06: 'Lo ha reclamado el hermano después del cargo',
  MD07: 'El titular de la cuenta ha fallecido',
  MS02: 'El titular ha rechazado el cargo',
  MS03: 'El banco no dice el motivo',
  RC01: 'El BIC del banco no es correcto',
  RR01: 'Falta información del hermano que el banco exige',
  RR02: 'Falta el nombre o la dirección del hermano',
  RR03: 'Falta el nombre o la dirección de la hermandad',
  RR04: 'Falta información que exige la normativa',
  SL01: 'El hermano tiene puesto en su banco un filtro que bloquea este cobro',
}

/** Cómo se lee un motivo, aunque el banco mande uno que no está en la lista. */
export function motivoEnCristiano(codigo: string): string {
  const c = (codigo ?? '').trim().toUpperCase()
  return MOTIVOS_DEVOLUCION[c] ?? `El banco lo devuelve con el código ${c || '(ninguno)'}`
}

export interface Devolucion {
  /** El `EndToEndId` original, tal cual viene: «REC-128». */
  referencia: string
  /** El número de recibo que sale de esa referencia. `null` si no se reconoce. */
  numeroRecibo: number | null
  codigo: string
  motivo: string
  /** Lo devuelto, en euros. Cero si el banco no lo dice. */
  importe: number
}

export type LecturaDevoluciones =
  | { ok: true; devoluciones: Devolucion[] }
  | { ok: false; error: string }

/**
 * El número de recibo escondido en el `EndToEndId`.
 *
 * Se acepta con y sin el prefijo: hay bancos que devuelven la referencia
 * recortada o en minúsculas, y perder una devolución por una mayúscula sería
 * exactamente el fallo que esto viene a arreglar.
 */
export function numeroDeReferencia(referencia: string): number | null {
  const m = /^\s*(?:REC[-_]?)?(\d+)\s*$/i.exec(referencia ?? '')
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/**
 * Fuera los prefijos de espacio de nombres: `<ns2:TxInfAndSts>` y
 * `<TxInfAndSts>` son la misma etiqueta, y cada banco usa el suyo. Sin esto,
 * el fichero de un banco se lee y el del de al lado no.
 */
function sinPrefijos(xml: string): string {
  return xml.replace(/<\/?([A-Za-z0-9_]+:)/g, (t) => t.replace(/[A-Za-z0-9_]+:/, ''))
}

function etiqueta(bloque: string, nombre: string): string {
  const m = new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`).exec(bloque)
  return m ? m[1].trim() : ''
}

/**
 * LEER EL FICHERO QUE MANDA EL BANCO.
 *
 * Devuelve el motivo del rechazo EN CRISTIANO cuando no se puede leer, y no un
 * «formato inválido»: quien lo abre es el tesorero, no un informático, y lo que
 * necesita saber es qué pedirle al banco.
 */
export function leerDevoluciones(contenido: string): LecturaDevoluciones {
  const texto = (contenido ?? '').trim()
  if (!texto) return { ok: false, error: 'El fichero está vacío.' }

  /*
   * EL CUADERNO ANTIGUO SE RECONOCE Y SE RECHAZA CON INSTRUCCIONES.
   *
   * Sus registros son líneas de ancho fijo que empiezan por un código de dos o
   * tres cifras. No se interpreta —ver la cabecera de este archivo— porque
   * adivinar sus columnas es leer el número de recibo del sitio equivocado y
   * marcar como devuelta la cuota de otro hermano.
   */
  if (!texto.includes('<')) {
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim())
    const anchoFijo = lineas.length > 0 && lineas.every((l) => /^\d{2,4}/.test(l) && l.length >= 60)
    if (anchoFijo) {
      return {
        ok: false,
        error: 'Esto parece un fichero del cuaderno antiguo (ancho fijo). Pídele a tu banco el '
          + 'fichero de devoluciones en formato pain.002, que es el que corresponde a las remesas '
          + 'SEPA: en la banca electrónica suele salir como «pain.002» o «Informe de estado».',
      }
    }
    return {
      ok: false,
      error: 'Ese fichero no es un pain.002. Descarga de tu banco el fichero de devoluciones de la '
        + 'remesa (pain.002, un XML) y súbelo aquí.',
    }
  }

  const xml = sinPrefijos(texto)
  if (!/CstmrPmtStsRpt/.test(xml)) {
    return {
      ok: false,
      error: 'Es un XML, pero no un informe de devoluciones (pain.002). Si lo que has subido es la '
        + 'propia remesa que mandaste (pain.008), lo que hace falta es el fichero que el banco '
        + 'devuelve DESPUÉS.',
    }
  }

  const devoluciones: Devolucion[] = []
  for (const m of xml.matchAll(/<TxInfAndSts[^>]*>([\s\S]*?)<\/TxInfAndSts>/g)) {
    const bloque = m[1]
    /*
     * SOLO LO RECHAZADO. Un pain.002 puede traer también las que salieron bien
     * (`ACCP`, `ACSC`) según lo que pida cada banco. Dar por devuelta una que
     * fue bien dejaría al hermano debiendo una cuota que sí pagó.
     */
    const estado = etiqueta(bloque, 'TxSts').toUpperCase()
    if (estado && estado !== 'RJCT' && estado !== 'RJCR') continue

    const referencia = etiqueta(bloque, 'OrgnlEndToEndId')
    const codigo = (etiqueta(bloque, 'Cd') || etiqueta(bloque, 'Prtry')).toUpperCase()
    const importeTexto = etiqueta(bloque, 'InstdAmt') || etiqueta(bloque, 'OrgnlInstdAmt')
    const importe = Number(importeTexto.replace(',', '.'))

    devoluciones.push({
      referencia,
      numeroRecibo: numeroDeReferencia(referencia),
      codigo,
      motivo: motivoEnCristiano(codigo),
      importe: Number.isFinite(importe) ? importe : 0,
    })
  }

  if (devoluciones.length === 0) {
    return {
      ok: false,
      error: 'El fichero se ha leído bien, pero no trae ninguna devolución. Puede ser que esa '
        + 'remesa se haya cobrado entera, que es la buena noticia.',
    }
  }
  return { ok: true, devoluciones }
}

/** Lo que se ha podido casar con un recibo y lo que no. */
export interface Cruce<T> {
  /** Devoluciones con su recibo encontrado. */
  casadas: { devolucion: Devolucion; recibo: T }[]
  /** Devoluciones cuyo recibo no aparece: se enseñan para que no se pierdan. */
  huerfanas: Devolucion[]
}

/**
 * CRUZAR LAS DEVOLUCIONES CON LOS RECIBOS.
 *
 * LAS QUE NO CASAN NO SE TIRAN. Es la parte que importa: un recibo que el banco
 * devuelve y que aquí no aparece significa que algo no cuadra —una remesa de
 * otra hermandad, un recibo ya borrado, una referencia cambiada a mano— y eso
 * hay que verlo, no esconderlo. Tragárselas en silencio dejaría dinero
 * descuadrado sin ninguna pista de dónde.
 *
 * Puro y sin React a propósito: decide sobre dinero y se puede comprobar
 * cifra a cifra sin montar nada.
 */
export function cruzarConRecibos<T extends { numero: number }>(
  devoluciones: readonly Devolucion[],
  recibos: readonly T[],
): Cruce<T> {
  const porNumero = new Map<number, T>()
  for (const r of recibos) porNumero.set(r.numero, r)

  const casadas: { devolucion: Devolucion; recibo: T }[] = []
  const huerfanas: Devolucion[] = []
  for (const d of devoluciones) {
    const recibo = d.numeroRecibo === null ? undefined : porNumero.get(d.numeroRecibo)
    if (recibo) casadas.push({ devolucion: d, recibo })
    else huerfanas.push(d)
  }
  return { casadas, huerfanas }
}

/** La marca que lleva en Tesorería el contra-apunte de una devolución. */
export function origenDeDevolucion(cuotaId: string): string {
  return `devolucion:${cuotaId}`
}

/**
 * Cómo se resume el fichero en una línea, para decirlo antes de aplicar nada.
 *
 * Se dice el IMPORTE además del número: «12 devoluciones» no asusta lo que
 * asusta «12 devoluciones, 360 €», y es la misma información.
 */
export function resumenDeLaLectura(cruce: Cruce<{ numero: number }>): string {
  const cuantas = cruce.casadas.length
  const suma = cruce.casadas.reduce((n, c) => n + Math.round(c.devolucion.importe * 100), 0) / 100
  const base = cuantas === 1
    ? `1 recibo devuelto, ${suma.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
    : `${cuantas} recibos devueltos, ${suma.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
  if (cruce.huerfanas.length === 0) return base
  const h = cruce.huerfanas.length
  return `${base}. Y ${h} ${h === 1 ? 'devolución que no cuadra' : 'devoluciones que no cuadran'} con ningún recibo de aquí.`
}
