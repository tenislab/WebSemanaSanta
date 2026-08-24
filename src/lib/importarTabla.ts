import { normalizarCabecera } from './leerTabla'
import type { Hermano } from '../data/hermanos'

/**
 * TRAER CUALQUIER TABLA QUE YA TENGA LA HERMANDAD.
 *
 * El importador del censo (`lib/importar.ts`) resolvió el problema que decide
 * si Gobergo se puede adoptar: nadie teclea mil fichas a mano. Pero el censo no
 * es lo único que una hermandad trae de su programa anterior. Trae, y suele ser
 * en este orden de dolor:
 *
 *   · el HISTORIAL DE CUOTAS — quién ha pagado qué, año por año. Sin él, el día
 *     que se instala Gobergo la hermandad pierde la memoria de su tesorería, y
 *     no se puede reclamar un impago de hace dos años ni justificar nada;
 *   · el LIBRO DE CAJA — ingresos y gastos del ejercicio, que es lo que hay que
 *     presentar en el cabildo de cuentas;
 *   · el INVENTARIO — enseres, orfebrería y textil, con su valor de seguro.
 *
 * Este archivo es el motor común: sabe hacer el ensayo («¿qué pasaría si
 * importo esto?»), reconocer lo que ya está para no duplicarlo, repartir
 * números y aplicar. Lo que NO sabe es qué es una cuota o qué es un enser: eso
 * lo pone cada descriptor en `lib/tablasImportables.ts`.
 *
 * Igual que el del censo, todo es **puro** y nada escribe: se le da un archivo
 * y devuelve qué pasaría. Quien guarda es la pantalla, y solo después de que
 * alguien haya visto el ensayo y lo haya confirmado.
 */

/* ---------------------------------------------------------------------------
   1. Describir una tabla
   --------------------------------------------------------------------------- */

/** Un campo al que se puede traer una columna del archivo. */
export interface CampoDeTabla {
  id: string
  etiqueta: string
  /** Sin esto no se puede crear el registro. */
  obligatorio?: boolean
  ayuda?: string
  /** Cómo se llama esta columna en las hojas que se ven por ahí. */
  sinonimos: string[]
}

/** Qué columna del archivo va a qué campo. `null` = ese campo no viene. */
export type Emparejado = Record<string, number | null>

/** Los catálogos que cada hermandad configura a su gusto, y el censo. */
export interface ContextoDeTabla {
  hermanos: Pick<Hermano, 'id' | 'dni' | 'nombre' | 'numero'>[]
  anioEnCurso: number
  categoriasIngreso: readonly string[]
  categoriasGasto: readonly string[]
  cuentas: readonly string[]
  categoriasEnser: readonly string[]
}

/** Lo que una fila del archivo resulta ser, después de leerla. */
export interface LecturaDeFila<T> {
  problemas: string[]
  /** Cosas que conviene saber, pero que no impiden importar. */
  avisos: string[]
  /** SOLO lo que el archivo trae de verdad, para no borrar nada al actualizar. */
  datos: Partial<T>
  /** Cómo se llama esta fila en la vista previa. */
  titulo: string
  sub: string
  /**
   * Con qué se reconoce si esto ya está guardado. Cadena vacía = no hay forma
   * de saberlo, así que se crea siempre.
   */
  huella: string
}

export interface TablaImportable<T extends { id: string; numero: number }> {
  /** Para las claves de React y los nombres de archivo. */
  id: string
  /** «Traer el historial de cuotas» */
  titulo: string
  singular: string
  plural: string
  /**
   * Para que los resúmenes concuerden: «1 pieza importada» y no «1 pieza
   * importado». Suena a detalle y no lo es — la pantalla final de una
   * importación es lo último que lee quien acaba de confiarle a un programa
   * tres mil recibos.
   */
  genero: 'm' | 'f'
  /** El párrafo del primer paso: qué es esto y qué se espera del archivo. */
  explicacion: string
  /** Resumen corto de las columnas imprescindibles. */
  imprescindibles: string
  /** El texto largo del desplegable de ayuda del primer paso. */
  ayudaColumnas: string
  campos: CampoDeTabla[]
  /**
   * Un motivo para no dejar pasar del paso de columnas, más allá de los campos
   * marcados como obligatorios. Sirve para los «hace falta una de estas tres»
   * (a una cuota le vale el DNI, el número o el nombre del hermano, pero
   * alguno hay que dar).
   */
  faltaAlgo?: (emparejado: Emparejado) => string | null
  /** Qué hacer cuando la MISMA fila aparece dos veces dentro del archivo. */
  repetidoEnArchivo: 'error' | 'aviso'
  leerFila: (leer: (campo: string) => string, ctx: ContextoDeTabla) => LecturaDeFila<T>
  /** La huella de algo que YA está guardado, para reconocer los repetidos. */
  huellaDe: (item: T, ctx: ContextoDeTabla) => string
  /** Monta el registro completo con lo leído, el número que le toca y su id. */
  crear: (datos: Partial<T>, numero: number, id: string) => T
  /**
   * Avisos que solo se ven mirando el archivo ENTERO, y que repetidos fila a
   * fila serían ilegibles: «120 recibos entran pendientes y domiciliados, así
   * que saldrán en la próxima remesa al banco». Se calculan sobre el ensayo ya
   * hecho.
   */
  avisosDelConjunto?: (filas: FilaDeTabla<T>[], ctx: ContextoDeTabla) => string[]
  /**
   * LO QUE EL ARCHIVO NO PUEDE DESHACER DE LO QUE YA ESTÁ GUARDADO.
   *
   * Hay un caso en que actualizar es peor que no importar: cuando el archivo
   * viene de un programa que NO sabía si algo estaba cobrado y lo trae todo
   * como pendiente. Ahí actualizar «al pie de la letra» borra el trabajo hecho
   * en Gobergo, y en cuotas eso significa volver a cobrarle a un hermano un
   * recibo que ya pagó.
   *
   * Se le da a cada tabla la oportunidad de proteger lo suyo: recibe lo que
   * trae el archivo Y lo que ya hay, y devuelve lo que de verdad se va a
   * escribir. `motivo` es una etiqueta corta para poder contarlos y decirlo una
   * sola vez, en vez de soltar ochocientas líneas iguales.
   */
  alActualizar?: (datos: Partial<T>, existente: T) => { datos: Partial<T>; motivo?: string }
}

/* ---------------------------------------------------------------------------
   2. Emparejar columnas
   --------------------------------------------------------------------------- */

/**
 * Propone qué columna del archivo va a qué campo. Devuelve, para cada campo, el
 * índice de columna propuesto, o `null` si no se ha reconocido ninguna.
 *
 * Es el mismo emparejador que usa el censo desde el principio, sacado a común:
 * primero las coincidencias exactas, que no se equivocan nunca, y solo después
 * las que empiezan igual («teléfono móvil» → teléfono). Nunca «contiene» a
 * secas, que es como el IBAN acababa en la casilla del número de hermano.
 */
export function proponerColumnas(campos: CampoDeTabla[], cabeceras: string[]): Emparejado {
  const norm = cabeceras.map(normalizarCabecera)
  // Los sinónimos también se normalizan: si no, «D.N.I.» de la hoja nunca
  // empareja con «dni» de la lista, porque uno lleva puntos y el otro no.
  const sinonimos = new Map(campos.map((c) => [c.id, c.sinonimos.map(normalizarCabecera)]))

  // Cabeceras que son, ELLAS ENTERAS, el sinónimo de algún campo. Se apartan
  // del emparejado por prefijo de más abajo: «numero de cuenta» es un IBAN, y
  // sin esto se lo llevaba «numero» por empezar igual.
  const reclamadas = new Set(
    norm.filter((h) => [...sinonimos.values()].some((lista) => lista.includes(h))),
  )

  const usadas = new Set<number>()
  const salida: Emparejado = {}

  // Se recorre en el orden de `campos`: los importantes eligen antes, así
  // «nombre» no se queda sin columna porque se la llevó otro campo.
  // Primera vuelta: coincidencia exacta, que es la que no se equivoca nunca.
  for (const { id } of campos) {
    const lista = sinonimos.get(id) ?? []
    const i = norm.findIndex((h, idx) => !usadas.has(idx) && lista.includes(h))
    salida[id] = i === -1 ? null : i
    if (i !== -1) usadas.add(i)
  }

  // Segunda vuelta: la cabecera EMPIEZA por el sinónimo («telefono movil» →
  // telefono). Nunca sobre una cabecera que ya sea el nombre exacto de otro
  // campo.
  for (const { id } of campos) {
    if (salida[id] !== null) continue
    const lista = sinonimos.get(id) ?? []
    const i = norm.findIndex(
      (h, idx) => !usadas.has(idx) && !reclamadas.has(h) && lista.some((n) => h.startsWith(`${n} `)),
    )
    if (i !== -1) { salida[id] = i; usadas.add(i) }
  }
  return salida
}

/**
 * DE QUÉ PESTAÑA DEL LIBRO SALEN ESTOS DATOS.
 *
 * Una hermandad no exporta cuatro archivos: saca UN libro de su programa
 * viejo, con el censo en una pestaña, las cuotas en otra y la caja en la
 * tercera. Y luego lo sube cuatro veces, una por pantalla.
 *
 * Antes se leía siempre la primera hoja, así que al importar cuotas desde ese
 * libro salía «faltan columnas obligatorias» —estaba mirando el censo— y no
 * había forma de saber por qué: el archivo era el bueno.
 *
 * Se elige por las columnas y no por el nombre de la pestaña, que cada
 * programa escribe como quiere («Hoja1», «CUOTAS_2026», «Recibos»). Gana la
 * que empareja más campos OBLIGATORIOS, y a igualdad, la que empareja más en
 * total. Devuelve 0 si no hay nada mejor: la primera hoja, como siempre.
 */
export function hojaQueCuadra(
  hojas: { filas: string[][] }[],
  campos: CampoDeTabla[],
): number {
  let mejor = 0
  let mejorNota = [-1, -1]
  hojas.forEach((hoja, i) => {
    // Una pestaña con solo la cabecera —o vacía— no es la que se busca aunque
    // sus columnas cuadren: no hay nada que importar en ella.
    if (hoja.filas.length < 2) return
    /*
     * SE PUNTÚA LA CABECERA DE VERDAD, no la primera fila.
     *
     * Una pestaña con un título encima («LISTADO DE HERMANOS» en A1) sacaba
     * cero, así que perdía contra cualquier otra — y se acababa importando el
     * censo desde la pestaña de las cuotas, que es de las peores maneras de
     * fallar: hay datos, entran, y están mal.
     */
    const empareja = proponerColumnas(campos, hoja.filas[filaDeCabecera(hoja.filas, campos)])
    const obligatorios = campos.filter((c) => c.obligatorio && empareja[c.id] !== null).length
    const total = campos.filter((c) => empareja[c.id] !== null).length
    if (obligatorios > mejorNota[0] || (obligatorios === mejorNota[0] && total > mejorNota[1])) {
      mejor = i
      mejorNota = [obligatorios, total]
    }
  })
  return mejor
}

/**
 * DÓNDE EMPIEZA LA TABLA DE VERDAD.
 *
 * Se daba por hecho que la cabecera es la primera fila. Y en la hoja de una
 * hermandad casi nunca lo es:
 *
 *     A1:  HERMANDAD DE NUESTRO PADRE JESÚS
 *     A2:  Listado de hermanos — 14/02/2026
 *     A3:  (vacía)
 *     A4:  Nº | Apellidos y nombre | DNI | Teléfono | ...
 *
 * Ese encabezado lo pone el programa viejo del que lo exportan, o lo escribe
 * quien lleva la hoja para saber de qué es. Con él, la cabecera que se leía era
 * «HERMANDAD DE NUESTRO PADRE JESÚS» y no emparejaba con nada: la pantalla
 * decía «— no está en el archivo —» EN TODAS LAS COLUMNAS, con el archivo bueno
 * delante y sin ninguna forma de entender qué pasaba. Lo mismo con un CSV, y
 * ahí encima el separador se detecta de la primera línea —que no tiene ninguno—
 * así que además se partía mal.
 *
 * Se busca la cabecera en vez de suponerla: de las primeras filas, la que
 * empareja más campos. A igualdad gana la de más arriba, que es la de verdad
 * cuando la tabla repite sus títulos.
 *
 * Solo se miran las primeras filas. Más abajo ya no hay encabezado, hay datos,
 * y una fila de datos que por casualidad empareje algo no puede robarle el
 * puesto a la cabecera y tirar a la basura todo lo que tiene encima.
 */
const FILAS_DE_ENCABEZADO = 12

export function filaDeCabecera(filas: string[][], campos: CampoDeTabla[]): number {
  let mejor = 0
  let mejorNota = -1
  const hasta = Math.min(filas.length - 1, FILAS_DE_ENCABEZADO)
  for (let i = 0; i < hasta; i++) {
    const empareja = proponerColumnas(campos, filas[i])
    const nota = campos.filter((c) => empareja[c.id] !== null).length
    if (nota > mejorNota) { mejor = i; mejorNota = nota }
  }
  return mejor
}

/** Lo que hay de la cabecera para abajo, y cuántas filas se han dejado arriba. */
export interface SinPreambulo {
  filas: string[][]
  /**
   * Cuántas se han saltado. Hace falta para seguir diciendo «la línea 47» y que
   * sea la 47 de SU archivo: decirle a alguien que mire una línea que no es la
   * que él ve en Excel es peor que no decirle nada.
   */
  saltadas: number
}

export function sinPreambulo(filas: string[][], campos: CampoDeTabla[]): SinPreambulo {
  const desde = filaDeCabecera(filas, campos)
  return { filas: desde === 0 ? filas : filas.slice(desde), saltadas: desde }
}

/** Qué campos obligatorios se han quedado sin columna. */
export function faltanColumnas(campos: CampoDeTabla[], emparejado: Emparejado): CampoDeTabla[] {
  return campos.filter((c) => c.obligatorio && (emparejado[c.id] ?? null) === null)
}

/* ---------------------------------------------------------------------------
   3. El ensayo: qué pasaría si se importa
   --------------------------------------------------------------------------- */

export type QueLePasa = 'nuevo' | 'actualiza' | 'error'

export interface FilaDeTabla<T> {
  /** Número de línea en el archivo, contando la cabecera. Para decir «la fila 47». */
  linea: number
  queLePasa: QueLePasa
  problemas: string[]
  datos: Partial<T>
  /** Si actualiza, a quién. */
  idExistente?: string
  titulo: string
  sub: string
  /** La fila tal cual venía, para poder devolvérsela a la hermandad corregible. */
  original: string[]
  /** Qué se le ha respetado a lo ya guardado, si `alActualizar` protegió algo. */
  protegido?: string
}

export interface EnsayoDeTabla<T> {
  filas: FilaDeTabla<T>[]
  nuevos: number
  actualizados: number
  errores: number
  /**
   * Lo que va a pasar y conviene saber antes de darle a importar, pero que no
   * impide hacerlo. Aquí se juntan los de cada fila y los del archivo entero.
   */
  avisos: string[]
}

/**
 * Qué pasaría al importar. No toca nada: devuelve fila a fila si se crearía, se
 * actualizaría o no se puede, y por qué.
 */
export function ensayarTabla<T extends { id: string; numero: number }>(
  filas: string[][],
  emparejado: Emparejado,
  existentes: T[],
  tabla: TablaImportable<T>,
  ctx: ContextoDeTabla,
  /**
   * Cuántas filas de encabezado se han dejado arriba. Se suma a la línea para
   * que «la línea 47» sea la 47 DE SU ARCHIVO: mandar a alguien a mirar una
   * línea que no es la que ve en Excel es peor que no decirle nada.
   */
  saltadas = 0,
): EnsayoDeTabla<T> {
  const salida: FilaDeTabla<T>[] = []
  const avisos: string[] = []

  // Lo que ya está guardado, por su huella.
  const guardados = new Map<string, T>()
  for (const item of existentes) {
    const h = tabla.huellaDe(item, ctx)
    if (h) guardados.set(h, item)
  }

  // Y lo que ya ha salido antes en el propio archivo.
  const vistas = new Map<string, number>()

  // La primera fila es la cabecera, así que los datos empiezan en la 2.
  filas.slice(1).forEach((fila, idx) => {
    const linea = idx + 2 + saltadas
    /*
     * UNA FILA EN BLANCO NO ES UN ERROR: NO ES NADA.
     *
     * El listado de una hermandad casi nunca es una tabla limpia. Trae líneas
     * en blanco separando bloques —«HERMANOS ACTIVOS», hueco, «BAJAS»— y
     * huecos que dejó quien la montó. En un CSV esas filas se filtran al
     * leerlo (`leerCsv`), pero un `.xlsx` las conserva, así que el MISMO
     * listado guardado de una forma o de otra daba resultados distintos.
     *
     * Y cada hueco salía en la vista previa como una fila roja, «Falta el
     * nombre; Falta el DNI». Con quince bloques son quince errores que no hay
     * forma de corregir —no hay nada que corregir— delante de una secretaría
     * que está importando su censo por primera vez y lee que algo va mal.
     *
     * Se saltan y no cuentan. Las filas que traen ALGO escrito sí siguen
     * revisándose: un subtítulo suelto en mitad de la hoja sigue saliendo como
     * error, y ahí está bien que salga, porque es una línea que alguien tiene
     * que mirar.
     */
    if (fila.every((c) => !(c ?? '').trim())) return

    const leer = (campo: string): string => {
      const i = emparejado[campo]
      return i === null || i === undefined ? '' : (fila[i] ?? '').trim()
    }

    const leida = tabla.leerFila(leer, ctx)
    const problemas = [...leida.problemas]
    for (const a of leida.avisos) avisos.push(`Línea ${linea}: ${a}`)

    /*
     * REPETIDA DENTRO DEL PROPIO ARCHIVO.
     *
     * En un historial de cuotas esto es grave y se rechaza: dos recibos del
     * mismo hermano, del mismo ejercicio y del mismo concepto son un cobro
     * doble, y hay que mirar las dos filas para saber cuál vale. En un libro
     * de caja NO lo es —dos compras iguales el mismo día pasan— así que ahí
     * solo se avisa.
     */
    if (leida.huella) {
      const antes = vistas.get(leida.huella)
      if (antes !== undefined) {
        const dicho = `${leida.titulo} está repetido en el archivo (también en la fila ${antes})`
        if (tabla.repetidoEnArchivo === 'error') {
          problemas.push(dicho)
          const otra = salida.find((f) => f.linea === antes)
          if (otra && !otra.problemas.some((p) => p.endsWith(`(también en la fila ${linea})`))) {
            otra.problemas.push(`${otra.titulo} está repetido en el archivo (también en la fila ${linea})`)
            otra.queLePasa = 'error'
          }
        } else {
          avisos.push(`Línea ${linea}: ${dicho}. Se importan las dos.`)
        }
      } else {
        vistas.set(leida.huella, linea)
      }
    }

    const existente = leida.huella ? guardados.get(leida.huella) : undefined
    const queLePasa: QueLePasa = problemas.length > 0 ? 'error' : existente ? 'actualiza' : 'nuevo'

    /*
     * Lo que el archivo NO puede deshacer de lo que ya hay. Se resuelve AQUÍ,
     * en el ensayo, y no al escribir: así la vista previa enseña exactamente
     * lo que se va a guardar, que es de lo que se fía quien pulsa el botón.
     */
    let datos = leida.datos
    let protegido: string | undefined
    if (queLePasa === 'actualiza' && existente && tabla.alActualizar) {
      const r = tabla.alActualizar(datos, existente)
      datos = r.datos
      protegido = r.motivo
    }

    salida.push({
      linea,
      queLePasa,
      problemas,
      datos,
      idExistente: existente?.id,
      titulo: leida.titulo,
      sub: leida.sub,
      original: fila,
      protegido,
    })
  })

  return {
    filas: salida,
    nuevos: salida.filter((f) => f.queLePasa === 'nuevo').length,
    actualizados: salida.filter((f) => f.queLePasa === 'actualiza').length,
    errores: salida.filter((f) => f.queLePasa === 'error').length,
    // Los del archivo entero van DELANTE: son los que hay que leer sí o sí,
    // y detrás de doscientos «línea 47: …» no los lee nadie.
    avisos: [...(tabla.avisosDelConjunto?.(salida, ctx) ?? []), ...avisos],
  }
}

/* ---------------------------------------------------------------------------
   4. Aplicar
   --------------------------------------------------------------------------- */

export interface OpcionesDeTabla {
  /** Qué hacer con lo que ya está guardado. */
  conLosQueYaEstan: 'actualizar' | 'saltar'
}

/**
 * Devuelve la lista resultante. **No guarda**: quien guarda es la pantalla, con
 * el mecanismo de siempre, para que la sincronización con Supabase y el aviso
 * de espacio funcionen igual que en el resto de la aplicación.
 */
export function aplicarTabla<T extends { id: string; numero: number }>(
  ensayo: EnsayoDeTabla<T>,
  existentes: T[],
  tabla: TablaImportable<T>,
  opciones: OpcionesDeTabla,
  nuevoId: () => string,
): { lista: T[]; creados: number; actualizados: number } {
  const lista = [...existentes]
  const porId = new Map(lista.map((x, i) => [x.id, i]))
  /*
   * Los números siguen a continuación del último, como los que se crean a mano.
   *
   * Con `reduce` y no con `Math.max(0, ...lista)`: esto se usa justo para
   * traer históricos, y desplegar diez mil recibos como argumentos de una
   * llamada revienta la pila del navegador. Se rompería exactamente en el
   * único caso para el que existe.
   */
  let siguiente = lista.reduce((n, x) => (x.numero > n ? x.numero : n), 0) + 1

  let creados = 0
  let actualizados = 0
  for (const fila of ensayo.filas) {
    if (fila.queLePasa === 'error') continue

    if (fila.queLePasa === 'actualiza') {
      if (opciones.conLosQueYaEstan === 'saltar') continue
      const i = porId.get(fila.idExistente as string)
      if (i === undefined) continue
      // Solo se pisa lo que trae el archivo: una columna que la hoja no tiene
      // no puede borrar lo que ya estuviera guardado en Gobergo.
      const cambios: Partial<T> = {}
      for (const [k, v] of Object.entries(fila.datos)) {
        if (v !== '' && v !== undefined) (cambios as Record<string, unknown>)[k] = v
      }
      // El número no se toca nunca desde una importación: renumerar los
      // recibos o los apuntes de un ejercicio ya cerrado es un estropicio.
      delete cambios.numero
      lista[i] = { ...lista[i], ...cambios }
      actualizados += 1
      continue
    }

    const creado = tabla.crear(fila.datos, siguiente, nuevoId())
    siguiente += 1
    lista.push(creado)
    porId.set(creado.id, lista.length - 1)
    creados += 1
  }
  return { lista, creados, actualizados }
}

/** Las filas con problemas, en CSV, para corregirlas y volver a subirlas. */
export function csvDeProblemas<T>(ensayo: EnsayoDeTabla<T>, cabeceras: string[]): string {
  const malas = ensayo.filas.filter((f) => f.queLePasa === 'error')
  const cabecera = ['Fila', 'Qué pasa', ...cabeceras]
  const filas = malas.map((f) => [String(f.linea), f.problemas.join('. '), ...f.original])
  const escapar = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [cabecera, ...filas].map((f) => f.map(escapar).join(';')).join('\n')
}
