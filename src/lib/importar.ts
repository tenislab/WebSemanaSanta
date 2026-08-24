import { limpiarDni } from './dni'
import {
  anioDe, detectarSeparador, fechaIso, leerCsv, normalizarCabecera, pareceBinario,
} from './leerTabla'
import { hojaQueCuadra, proponerColumnas, sinPreambulo, type SinPreambulo } from './importarTabla'
import type { EstadoHermano, Hermano } from '../data/hermanos'

/**
 * Traer el censo que la hermandad YA tiene. Es la pieza que decide si Gobergo
 * se puede adoptar o no: sin ella, empezar significa teclear mil fichas a mano,
 * y ninguna junta va a hacer eso.
 *
 * Lo que tiene una hermandad casi nunca es una base de datos: es un Excel, o un
 * listado exportado de un programa antiguo. Por eso se trabaja con CSV, que es
 * lo que sabe soltar cualquiera de esas cosas.
 *
 * Todo lo de este archivo es **puro**: se le da un texto y devuelve qué pasaría.
 * No escribe nada. Quien decide escribir es la pantalla, y solo después de que
 * la hermandad haya visto el ensayo. Importar mal y no poder deshacerlo es un
 * desastre del que no se sale.
 */

/* ---------------------------------------------------------------------------
   1. Leer el archivo — que ya no se hace aquí
   --------------------------------------------------------------------------- */

/*
 * LEER EL ARCHIVO NO ES COSA DEL CENSO.
 *
 * Partir un CSV, entender una fecha española o normalizar el nombre de una
 * columna hace falta igual para el censo, para el historial de cuotas, para el
 * libro de caja y para el inventario. Vive en `lib/leerTabla.ts`, y se
 * reexporta desde aquí para no romper a quien ya lo importaba de este módulo.
 */
export { anioDe, detectarSeparador, fechaIso, leerCsv, pareceBinario }
const normalizar = normalizarCabecera

/* ---------------------------------------------------------------------------
   2. Emparejar columnas
   --------------------------------------------------------------------------- */

/** Los campos del hermano a los que se puede traer una columna. */
export type CampoImportable =
  | 'numero' | 'nombre' | 'dni' | 'email' | 'telefono' | 'direccion'
  | 'antiguedad' | 'estado' | 'iban' | 'fechaNacimiento'

export const CAMPOS_IMPORTABLES: {
  id: CampoImportable
  etiqueta: string
  /** Sin esto no se puede crear el hermano. */
  obligatorio?: boolean
  ayuda?: string
}[] = [
  { id: 'nombre', etiqueta: 'Nombre y apellidos', obligatorio: true },
  { id: 'dni', etiqueta: 'DNI o NIE', obligatorio: true, ayuda: 'Es lo que identifica a cada hermano y evita duplicados.' },
  { id: 'numero', etiqueta: 'Número de hermano', ayuda: 'Si no viene, se asigna por orden a continuación del último.' },
  { id: 'antiguedad', etiqueta: 'Año de antigüedad', ayuda: 'El año en que entró. Si no viene, el año en curso.' },
  { id: 'email', etiqueta: 'Correo electrónico' },
  { id: 'telefono', etiqueta: 'Teléfono' },
  { id: 'direccion', etiqueta: 'Dirección' },
  { id: 'iban', etiqueta: 'Cuenta bancaria (IBAN)' },
  { id: 'fechaNacimiento', etiqueta: 'Fecha de nacimiento' },
  { id: 'estado', etiqueta: 'Situación (Activo, Nuevo, Baja)' },
]

/**
 * Cómo se llama cada campo en las hojas de cálculo que se ven por ahí. Sirve
 * para **proponer** el emparejamiento, no para decidirlo: la hermandad siempre
 * lo confirma. Adivinar y tirar para adelante es como se importan mil fichas
 * con el teléfono en la casilla del DNI.
 */
/**
 * Cabeceras que preguntan AL REVÉS: «¿está de baja?» en vez de «¿está activo?».
 *
 * Está aquí arriba y no dentro de `cabeceraEsNegativa` porque hacen falta en
 * dos sitios: para emparejar la columna, y para saber que su «Sí» significa
 * baja. Teniéndolas dos veces se despegaban — una hoja con «¿Está de baja?» se
 * reconocía como negativa pero NO se emparejaba con ningún campo, así que
 * había que elegirla a mano o el censo entero entraba sin situación.
 */
const CABECERAS_AL_REVES = [
  'baja', 'bajas', 'de baja', 'es baja', 'esta de baja', 'esta dado de baja',
  'dado de baja', 'fallecido', 'fallecida', 'borrado', 'inactivo',
]

const SINONIMOS: Record<CampoImportable, string[]> = {
  nombre: ['nombre', 'nombre y apellidos', 'nombreapellidos', 'apellidos y nombre', 'hermano', 'nombre completo', 'titular'],
  dni: ['dni', 'nif', 'nie', 'documento', 'dni/nie', 'd.n.i.', 'identificacion'],
  numero: ['numero', 'n', 'nº', 'num', 'numero de hermano', 'n hermano', 'nhermano', 'orden', 'nº hermano'],
  antiguedad: ['antiguedad', 'ano', 'anio', 'alta', 'fecha de alta', 'ano de alta', 'desde', 'ingreso', 'ano ingreso'],
  email: ['email', 'correo', 'e-mail', 'correo electronico', 'mail'],
  telefono: ['telefono', 'tlf', 'movil', 'tel', 'telefono movil', 'contacto'],
  direccion: ['direccion', 'domicilio', 'calle', 'dir'],
  // «Nº de cuenta» queda en «n de cuenta» al normalizar, y tiene que estar en
  // la lista SÍ O SÍ: si no, la segunda vuelta se la lleva «numero» —porque
  // «n de cuenta» empieza por «n »— y los IBAN acabarían en la casilla del
  // número de hermano.
  iban: ['iban', 'cuenta', 'cuenta bancaria', 'cuenta corriente', 'ccc', 'banco',
    'numero de cuenta', 'n de cuenta', 'no de cuenta', 'domiciliacion'],
  fechaNacimiento: ['fecha de nacimiento', 'nacimiento', 'fnac', 'fecha nacimiento', 'nacido'],
  // Las de «al revés» también emparejan: la columna es la de la situación
  // igualmente, solo que su «Sí» quiere decir lo contrario.
  estado: ['estado', 'situacion', 'activo', 'situacion actual', 'alta baja', ...CABECERAS_AL_REVES],
}

/**
 * Propone qué columna del archivo va a qué campo. Devuelve, para cada campo, el
 * índice de columna propuesto, o `null` si no se ha reconocido ninguna.
 *
 * El emparejador es el común (`lib/importarTabla.ts`): lo comparten el censo,
 * el historial de cuotas, el libro de caja y el inventario. Tenerlo dos veces
 * era tenerlo arreglado en uno y roto en el otro — y sus dos vueltas (primero
 * lo exacto, después lo que empieza igual) son justo lo que evita que un IBAN
 * acabe en la casilla del número de hermano.
 */
export function proponerEmparejado(cabeceras: string[]): Record<CampoImportable, number | null> {
  return proponerColumnas(
    CAMPOS_IMPORTABLES.map((c) => ({ ...c, sinonimos: SINONIMOS[c.id] })),
    cabeceras,
  ) as Record<CampoImportable, number | null>
}

/**
 * De qué pestaña del libro sale el CENSO. Ver `hojaQueCuadra` en
 * `importarTabla.ts`: es el mismo problema y la misma respuesta, con los
 * campos del censo en vez de los de una tabla.
 */
export function hojaDelCenso(hojas: { filas: string[][] }[]): number {
  return hojaQueCuadra(hojas, camposDelCenso())
}

/**
 * Dónde empieza la tabla del censo, que casi nunca es la primera fila.
 *
 * La hoja de una hermandad suele traer encima el nombre de la hermandad, la
 * fecha del listado y alguna línea en blanco. Suponiendo que la cabecera es la
 * primera fila, la pantalla decía «— no está en el archivo —» EN TODAS LAS
 * COLUMNAS con el archivo bueno delante. Ver `sinPreambulo`.
 */
export function censoSinPreambulo(filas: string[][]): SinPreambulo {
  return sinPreambulo(filas, camposDelCenso())
}

/** Los campos del censo con la forma que espera el emparejador común. */
function camposDelCenso() {
  return CAMPOS_IMPORTABLES.map((c) => ({
    ...c, sinonimos: SINONIMOS[c.id], obligatorio: c.obligatorio ?? false,
  }))
}

/* ---------------------------------------------------------------------------
   3. El ensayo: qué pasaría si se importa
   --------------------------------------------------------------------------- */

export type QueLePasa = 'nuevo' | 'actualiza' | 'error'

export interface FilaImportada {
  /** Número de línea en el archivo, contando la cabecera. Para poder decir «la fila 47». */
  linea: number
  queLePasa: QueLePasa
  /** Los motivos por los que no se puede importar. Vacío si va bien. */
  problemas: string[]
  /**
   * SOLO lo que el archivo trae de verdad. Lo que no venga en una columna no
   * está aquí, y por eso actualizar a alguien no le puede borrar nada.
   */
  datos: Partial<Hermano>
  /**
   * Lo deducido para poder dar de alta a quien viene nuevo: si el archivo no
   * dice desde cuándo es hermano ni en qué situación está, hay que poner algo.
   * A quien YA ESTÁ en el censo no se le aplica nunca.
   */
  paraAlta: { antiguedad: number; estado: Hermano['estado'] }
  /** Si actualiza, a quién. */
  idExistente?: string
  /** La fila tal cual venía, para poder devolvérsela a la hermandad corregible. */
  original: string[]
}

export interface Ensayo {
  filas: FilaImportada[]
  nuevos: number
  actualizados: number
  errores: number
  /** DNI repetidos DENTRO del propio archivo. */
  duplicadosEnArchivo: string[]
  /**
   * Cosas que van a pasar y conviene saber antes de darle a importar, pero que
   * no impiden hacerlo. Hoy: números de hermano pedidos que ya estaban cogidos.
   */
  avisos: string[]
}

/* La regla vive en `lib/dni.ts`: no es cosa del importador, es cosa de todo el
   que escriba o busque un DNI. Se reexporta para no romper lo que ya la
   importaba de aquí. */
export { limpiarDni }

function pareceEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
}

/** La situación, de lo que venga escrito en la hoja. */
/**
 * La situación del hermano, leída de la casilla.
 *
 * `cabeceraNegativa` cambia lo que significan «sí» y «no», y NO es un detalle:
 * hay dos formas de escribir esa columna y significan lo contrario.
 *
 *     Activo      Baja
 *     ------      ----
 *     Sí          Sí     ← «sí» quiere decir cosas opuestas
 *
 * Con una columna titulada «Baja» y valores Sí/No, la lectura de siempre
 * importaba a los que se habían ido como ACTIVOS —«sí» estaba en la lista de
 * activos— y rechazaba a los que seguían, porque «no» no se entendía. El censo
 * entraba justo del revés y no había forma de notarlo hasta que alguien
 * echara cuentas.
 */
export function estadoDe(v: string, cabeceraNegativa = false): EstadoHermano | null {
  const t = normalizar(v)
  if (!t) return null

  if (cabeceraNegativa) {
    // La columna pregunta «¿está de baja?».
    if (['si', 'sí', 'x', 'true', 'verdadero', '1', 'baja'].includes(t)) return 'Baja'
    if (['no', 'false', 'falso', '0'].includes(t)) return 'Activo'
    // Un valor con nombre propio («Activo», «Nuevo») manda sobre el sí/no:
    // quien lo ha escrito así estaba diciendo la situación, no respondiendo.
  }

  if (['baja', 'bajas', 'de baja', 'no activo', 'inactivo'].includes(t)) return 'Baja'
  if (['nuevo', 'nueva', 'alta', 'pendiente'].includes(t)) return 'Nuevo'
  if (['activo', 'activa', 'si', 'x', 'alta activa', 'ok'].includes(t)) return 'Activo'
  return null
}

/**
 * ¿La columna emparejada como «situación» pregunta al revés?
 *
 * Se mira la CABECERA que trae el archivo: si se titula «Baja» o «Fallecido»,
 * un «sí» ahí significa que esa persona ya no está.
 */
export function cabeceraEsNegativa(cabecera: string): boolean {
  const t = normalizar(cabecera)
  return CABECERAS_AL_REVES.includes(t)
}

/**
 * Qué pasaría al importar. No toca nada: devuelve fila a fila si se crearía,
 * se actualizaría o no se puede, y por qué.
 */
export function ensayar(
  filas: string[][],
  emparejado: Record<CampoImportable, number | null>,
  censoActual: Pick<Hermano, 'id' | 'dni' | 'nombre' | 'numero'>[],
  anioEnCurso = new Date().getFullYear(),
  /**
   * Cuántas filas de encabezado se han dejado arriba —el título de la hoja, la
   * fecha del listado, la línea en blanco—. Se suma a la línea para que «la
   * línea 47» sea la 47 DE SU ARCHIVO.
   */
  saltadas = 0,
): Ensayo {
  const porDni = new Map(censoActual.map((h) => [limpiarDni(h.dni), h]))
  const vistosEnArchivo = new Map<string, number>()
  const duplicadosEnArchivo: string[] = []
  const salida: FilaImportada[] = []

  // Los números que ya están cogidos, para poder decir en la vista previa el
  // número REAL que le va a tocar a cada uno.
  //
  // Esto tiene que repartir igual que `aplicar`, y por eso está aquí duplicado
  // con la misma lógica: antes, el ensayo enseñaba el número que venía en la
  // hoja sin mirar si estaba libre. La secretaría veía «Nuevo Uno → nº 1»,
  // importaba, y le quedaba con el 3. En una hermandad el número de hermano es
  // lo más delicado que hay, y encima no avisaba de nada.
  const avisos: string[] = []
  const ocupados = new Set(censoActual.filter((h) => h.numero > 0).map((h) => h.numero))
  let siguienteLibre = Math.max(0, ...ocupados) + 1
  const reservar = (deseado?: number): number => {
    if (deseado !== undefined && deseado > 0 && !ocupados.has(deseado)) {
      ocupados.add(deseado)
      return deseado
    }
    while (ocupados.has(siguienteLibre)) siguienteLibre += 1
    ocupados.add(siguienteLibre)
    return siguienteLibre
  }

  /**
   * ¿La columna de situación pregunta «¿está de baja?» en vez de «¿está
   * activo?»? Se sabe por su título, y cambia el significado de cada «sí».
   */
  const iEstado = emparejado.estado
  const situacionAlReves =
    iEstado !== null && iEstado !== undefined && cabeceraEsNegativa(filas[0]?.[iEstado] ?? '')

  const dato = (fila: string[], campo: CampoImportable): string => {
    const i = emparejado[campo]
    return i === null || i === undefined ? '' : (fila[i] ?? '').trim()
  }

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

    const problemas: string[] = []
    const nombre = dato(fila, 'nombre')
    const dniCrudo = dato(fila, 'dni')
    const dni = limpiarDni(dniCrudo)

    if (!nombre) problemas.push('Falta el nombre')
    if (!dni) problemas.push('Falta el DNI')
    else if (dni.length < 8) problemas.push(`El DNI «${dniCrudo}» está incompleto`)

    // Duplicado dentro del propio archivo: se avisa en las DOS filas, no solo
    // en la segunda, porque hay que mirar las dos para saber cuál vale.
    if (dni) {
      const antes = vistosEnArchivo.get(dni)
      if (antes !== undefined) {
        problemas.push(`El DNI está repetido en el archivo (también en la fila ${antes})`)
        if (!duplicadosEnArchivo.includes(dni)) duplicadosEnArchivo.push(dni)
        const otra = salida.find((f) => f.linea === antes)
        if (otra && !otra.problemas.some((p) => p.startsWith('El DNI está repetido'))) {
          otra.problemas.push(`El DNI está repetido en el archivo (también en la fila ${linea})`)
          otra.queLePasa = 'error'
        }
      } else {
        vistosEnArchivo.set(dni, linea)
      }
    }

    const email = dato(fila, 'email')
    if (email && !pareceEmail(email)) problemas.push(`El correo «${email}» no parece correcto`)

    const numeroTexto = dato(fila, 'numero')
    let numero: number | undefined
    if (numeroTexto) {
      const n = Number(numeroTexto.replace(/\D/g, ''))
      if (!Number.isFinite(n) || n < 0) problemas.push(`El número «${numeroTexto}» no es válido`)
      else numero = n
    }

    const antText = dato(fila, 'antiguedad')
    let antiguedad = anioDe(antText)
    if (antText && antiguedad === null) problemas.push(`No se entiende el año «${antText}»`)
    if (antiguedad === null) antiguedad = anioEnCurso

    const estadoText = dato(fila, 'estado')
    let estado = estadoDe(estadoText, situacionAlReves)
    if (estadoText && estado === null) problemas.push(`No se entiende la situación «${estadoText}»`)
    if (estado === null) estado = antiguedad >= anioEnCurso ? 'Nuevo' : 'Activo'

    const existente = dni ? porDni.get(dni) : undefined

    /**
     * Lo que se le va a escribir a este hermano.
     *
     * LA REGLA, que antes no se cumplía: aquí solo puede entrar lo que el
     * ARCHIVO trae de verdad. Lo de arriba (`antiguedad`, `estado`) lleva
     * valores deducidos para poder dar de alta a los que vienen nuevos, y esos
     * valores no son suyos: son un relleno.
     *
     * EL DESTROZO QUE HACÍA. Secretaría sacaba de otro programa una hoja
     * sencilla, «Nombre;DNI», para repasar los nombres. Como esa hoja no trae
     * columna de antigüedad, `antiguedad` valía el año en curso y `estado` se
     * deducía «Nuevo». Al aplicar, ambos pisaban lo real: Ana Sánchez, hermana
     * desde 1991, se quedaba con antigüedad 2026 y estado «Nuevo». El resumen
     * decía «X actualizados» y nada más. En una hermandad la antigüedad es la
     * que ordena el cortejo y da la prioridad de papeleta: se perdía el censo
     * histórico entero de una tacada, sin un solo aviso.
     *
     * Con el IBAN era todavía más callado: `iban: dato(...) || null` metía
     * `null` cuando la hoja no traía cuenta bancaria, y `null` no es cadena
     * vacía, así que pasaba el filtro de `aplicar` y borraba la domiciliación
     * de todo el censo. El siguiente recibo no se podía cobrar.
     */
    const datos: Partial<Hermano> = {
      nombre,
      dni,
      email,
      telefono: dato(fila, 'telefono'),
      direccion: dato(fila, 'direccion'),
    }
    // LA REGLA: una casilla EN BLANCO no dice nada. No basta con que la
    // columna exista; hace falta que esa fila traiga algo escrito. Media hoja
    // exportada de otro programa tiene la columna «Antigüedad» con la mitad de
    // las celdas vacías, y eso no es una orden de poner a esa gente de alta
    // este año: es que ese dato no lo tienen.
    const ibanText = dato(fila, 'iban')
    if (antText) datos.antiguedad = antiguedad
    if (estadoText) datos.estado = estado
    if (ibanText) datos.iban = ibanText
    const nacimiento = dato(fila, 'fechaNacimiento')
    if (nacimiento) {
      const limpia = fechaIso(nacimiento)
      if (limpia) datos.fechaNacimiento = limpia
      // Se avisa en vez de guardar una cadena que no es una fecha. Si se
      // guardara, la segmentación por edad dejaría de encontrar a esa persona
      // y nadie sabría por qué.
      else problemas.push(`No se entiende la fecha de nacimiento «${nacimiento}»`)
    }

    const esError = problemas.length > 0
    const queLePasa: FilaImportada['queLePasa'] = esError ? 'error' : existente ? 'actualiza' : 'nuevo'

    // El número solo se reparte a los que entran nuevos. A quien ya está no se
    // le toca el suyo —renumerar a un hermano de 1985 por lo que ponga una
    // hoja de cálculo sería grave— y a las bajas les corresponde el 0.
    if (queLePasa === 'nuevo' && estado !== 'Baja') {
      const tocado = reservar(numero)
      datos.numero = tocado
      if (numero !== undefined && numero > 0 && tocado !== numero) {
        const quien = censoActual.find((h) => h.numero === numero)
        avisos.push(
          `Línea ${linea}: el nº ${numero} ya es de ${quien ? quien.nombre : 'otro hermano'}, ` +
            `así que a ${nombre || 'esta persona'} le tocará el ${tocado}.`,
        )
      }
    } else if (numero !== undefined) {
      datos.numero = numero
    }

    salida.push({
      linea,
      queLePasa,
      problemas,
      datos,
      paraAlta: { antiguedad, estado },
      idExistente: existente?.id,
      original: fila,
    })
  })

  return {
    filas: salida,
    nuevos: salida.filter((f) => f.queLePasa === 'nuevo').length,
    actualizados: salida.filter((f) => f.queLePasa === 'actualiza').length,
    errores: salida.filter((f) => f.queLePasa === 'error').length,
    duplicadosEnArchivo,
    avisos,
  }
}

/* ---------------------------------------------------------------------------
   4. Aplicar
   --------------------------------------------------------------------------- */

export interface OpcionesImportacion {
  /** Qué hacer con quien ya está en el censo. */
  conLosQueYaEstan: 'actualizar' | 'saltar'
}

/**
 * Devuelve el censo resultante. **No guarda**: quien guarda es la pantalla, con
 * el mecanismo de siempre, para que la sincronización con Supabase y el aviso
 * de espacio funcionen igual que en el resto de la aplicación.
 *
 * Los números que no vengan en el archivo se asignan a continuación del último
 * ocupado, y nunca se pisa uno que ya esté cogido: dos hermanos con el mismo
 * número rompen el escalafón y no hay quien lo arregle después.
 */
export function aplicar(
  ensayo: Ensayo,
  censoActual: Hermano[],
  opciones: OpcionesImportacion,
  nuevoId: () => string,
): { censo: Hermano[]; creados: number; actualizados: number } {
  const censo = [...censoActual]
  const porId = new Map(censo.map((h, i) => [h.id, i]))
  const ocupados = new Set(censo.filter((h) => h.numero > 0).map((h) => h.numero))
  let siguiente = Math.max(0, ...ocupados) + 1
  const pedir = (deseado?: number): number => {
    if (deseado !== undefined && deseado > 0 && !ocupados.has(deseado)) {
      ocupados.add(deseado)
      return deseado
    }
    while (ocupados.has(siguiente)) siguiente += 1
    ocupados.add(siguiente)
    return siguiente
  }

  let creados = 0
  let actualizados = 0
  for (const fila of ensayo.filas) {
    if (fila.queLePasa === 'error') continue
    if (fila.queLePasa === 'actualiza') {
      if (opciones.conLosQueYaEstan === 'saltar') continue
      const i = porId.get(fila.idExistente as string)
      if (i === undefined) continue
      // Solo se pisa lo que trae el archivo: si la hoja no tiene columna de
      // teléfono, no se borra el teléfono que ya tuviera en Gobergo.
      const cambios: Partial<Hermano> = {}
      for (const [k, v] of Object.entries(fila.datos)) {
        if (v !== '' && v !== undefined) (cambios as Record<string, unknown>)[k] = v
      }
      // El número de un hermano que ya está NO se toca desde una importación:
      // renumerar el censo entero por un Excel es un estropicio.
      delete cambios.numero
      censo[i] = { ...censo[i], ...cambios }
      actualizados += 1
      continue
    }
    // Para un alta sí valen los valores deducidos: si el archivo no dice desde
    // cuándo es hermano hay que poner algo, y ese algo es este año.
    const estadoAlta = fila.datos.estado ?? fila.paraAlta.estado
    const numero = estadoAlta === 'Baja' ? 0 : pedir(fila.datos.numero)
    censo.push({
      id: nuevoId(),
      numero,
      nombre: fila.datos.nombre ?? '',
      estado: estadoAlta,
      antiguedad: fila.datos.antiguedad ?? fila.paraAlta.antiguedad,
      email: fila.datos.email ?? '',
      telefono: fila.datos.telefono ?? '',
      direccion: fila.datos.direccion ?? '',
      cuotaAlDia: false,
      iban: fila.datos.iban ?? null,
      dni: fila.datos.dni ?? '',
      /*
       * SIN CONTRASEÑA, y esto era lo peor de la importación.
       *
       * Antes se le ponía `clavePorDefecto`: LA MISMA para las ochocientas
       * fichas del Excel. Una contraseña que se sabe la hermandad entera no es
       * una contraseña, y encima quedaba escrita en claro en cada ficha.
       *
       * Un hermano importado no tiene cuenta todavía (`authUserId: null`): la
       * crea secretaría desde su ficha cuando haga falta, y entonces se le
       * manda una de un solo uso por correo. Ver src/lib/claves.ts.
       */
      claveAcceso: '',
      authUserId: null,
      ...(fila.datos.fechaNacimiento ? { fechaNacimiento: fila.datos.fechaNacimiento } : {}),
    })
    creados += 1
  }
  return { censo, creados, actualizados }
}

/** Las filas con problemas, en CSV, para corregirlas y volver a subirlas. */
export function csvDeErrores(ensayo: Ensayo, cabeceras: string[]): string {
  const malas = ensayo.filas.filter((f) => f.queLePasa === 'error')
  const cabecera = ['Fila', 'Qué pasa', ...cabeceras]
  const filas = malas.map((f) => [String(f.linea), f.problemas.join('. '), ...f.original])
  const escapar = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [cabecera, ...filas].map((f) => f.map(escapar).join(';')).join('\n')
}
