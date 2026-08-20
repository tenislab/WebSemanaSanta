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
   1. Leer el archivo
   --------------------------------------------------------------------------- */

/**
 * Con qué se separan las columnas. En España Excel suele soltar **punto y
 * coma**, porque la coma es el separador decimal; pero medio mundo exporta con
 * coma, y algunos programas antiguos con tabulador. Se detecta en vez de
 * obligar a la hermandad a saberlo.
 */
export function detectarSeparador(texto: string): ';' | ',' | '\t' {
  const primera = texto.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  // Se cuenta FUERA de las comillas: un nombre como «Pérez, Ana» tiene comas
  // que no separan nada, y contándolas a pelo ganaba siempre la coma.
  let dentro = false
  const cuenta = { ';': 0, ',': 0, '\t': 0 }
  for (const c of primera) {
    if (c === '"') dentro = !dentro
    else if (!dentro && (c === ';' || c === ',' || c === '\t')) cuenta[c] += 1
  }
  if (cuenta['\t'] > cuenta[';'] && cuenta['\t'] > cuenta[',']) return '\t'
  return cuenta[','] > cuenta[';'] ? ',' : ';'
}

/**
 * Parte un CSV en filas y celdas, respetando las comillas y los saltos de línea
 * que van dentro de una celda entrecomillada (una dirección de dos líneas, por
 * ejemplo). Partir por `\n` a secas rompe justo esos casos.
 */
export function leerCsv(texto: string, separador?: string): string[][] {
  // El BOM que mete Excel se cuela en el nombre de la primera columna y luego
  // no empareja con nada.
  const limpio = texto.replace(/^\uFEFF/, '')
  const sep = separador ?? detectarSeparador(limpio)
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let dentro = false
  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i]
    if (dentro) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { celda += '"'; i += 1 } // comilla escapada
        else dentro = false
      } else celda += c
    } else if (c === '"') {
      dentro = true
    } else if (c === sep) {
      fila.push(celda); celda = ''
    } else if (c === '\n') {
      fila.push(celda); filas.push(fila); fila = []; celda = ''
    } else if (c !== '\r') {
      celda += c
    }
  }
  // Lo que quede sin cerrar al final del archivo también cuenta.
  if (celda !== '' || fila.length > 0) { fila.push(celda); filas.push(fila) }
  // Las filas vacías del final (un salto de línea suelto) no son datos.
  return filas.filter((f) => f.some((x) => x.trim() !== ''))
}

/**
 * ¿Esto es un Excel de verdad (.xlsx) en vez de un CSV? Un .xlsx es un ZIP, y
 * todos los ZIP empiezan por «PK». Sin comprobarlo, quien sube su hoja tal cual
 * se encontraba un error incomprensible sobre columnas raras, en vez de que se
 * le dijera lo único que necesita saber: que hay que guardarlo como CSV.
 */
export function pareceExcel(texto: string): boolean {
  return texto.startsWith('PK\u0003\u0004') || texto.startsWith('PK')
}

/** Un .xls antiguo, que tampoco es texto. */
export function pareceBinario(texto: string): boolean {
  // Un CSV no lleva bytes nulos; un binario, casi siempre.
  return texto.slice(0, 2000).includes('\u0000')
}

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
const SINONIMOS: Record<CampoImportable, string[]> = {
  nombre: ['nombre', 'nombre y apellidos', 'nombreapellidos', 'apellidos y nombre', 'hermano', 'nombre completo', 'titular'],
  dni: ['dni', 'nif', 'nie', 'documento', 'dni/nie', 'd.n.i.', 'identificacion'],
  numero: ['numero', 'n', 'nº', 'num', 'numero de hermano', 'n hermano', 'nhermano', 'orden', 'nº hermano'],
  antiguedad: ['antiguedad', 'ano', 'anio', 'alta', 'fecha de alta', 'ano de alta', 'desde', 'ingreso', 'ano ingreso'],
  email: ['email', 'correo', 'e-mail', 'correo electronico', 'mail'],
  telefono: ['telefono', 'tlf', 'movil', 'tel', 'telefono movil', 'contacto'],
  direccion: ['direccion', 'domicilio', 'calle', 'dir'],
  iban: ['iban', 'cuenta', 'cuenta bancaria', 'ccc', 'banco', 'numero de cuenta'],
  fechaNacimiento: ['fecha de nacimiento', 'nacimiento', 'fnac', 'fecha nacimiento', 'nacido'],
  estado: ['estado', 'situacion', 'activo', 'baja', 'situacion actual'],
}

/** Quita tildes, signos y mayúsculas para poder comparar nombres de columna. */
function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[._·/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Propone qué columna del archivo va a qué campo. Devuelve, para cada campo, el
 * índice de columna propuesto, o `null` si no se ha reconocido ninguna.
 */
export function proponerEmparejado(cabeceras: string[]): Record<CampoImportable, number | null> {
  const norm = cabeceras.map(normalizar)
  // Los sinónimos también se normalizan: si no, «D.N.I.» de la hoja nunca
  // empareja con «dni» de la lista, porque uno lleva puntos y el otro no.
  const sinonimos = Object.fromEntries(
    Object.entries(SINONIMOS).map(([k, v]) => [k, v.map(normalizar)]),
  ) as Record<CampoImportable, string[]>

  // Cabeceras que son, ELLAS ENTERAS, el sinónimo de algún campo. Se apartan
  // del emparejado por prefijo de más abajo: «numero de cuenta» es un IBAN, y
  // sin esto se lo llevaba «numero» por empezar igual.
  const reclamadas = new Set(
    norm.filter((h) => Object.values(sinonimos).some((lista) => lista.includes(h))),
  )

  const usadas = new Set<number>()
  const salida = {} as Record<CampoImportable, number | null>

  // Se recorre en el orden de CAMPOS_IMPORTABLES: los importantes eligen antes,
  // así «nombre» no se queda sin columna porque se la llevó otro campo.
  // Primera vuelta: coincidencia exacta, que es la que no se equivoca nunca.
  for (const { id } of CAMPOS_IMPORTABLES) {
    const i = norm.findIndex((h, idx) => !usadas.has(idx) && sinonimos[id].includes(h))
    salida[id] = i === -1 ? null : i
    if (i !== -1) usadas.add(i)
  }

  // Segunda vuelta: la cabecera EMPIEZA por el sinónimo («telefono movil» →
  // telefono). Nunca «contiene» a secas, y nunca sobre una cabecera que ya sea
  // el nombre exacto de otro campo.
  for (const { id } of CAMPOS_IMPORTABLES) {
    if (salida[id] !== null) continue
    const i = norm.findIndex(
      (h, idx) => !usadas.has(idx) && !reclamadas.has(h) && sinonimos[id].some((n) => h.startsWith(`${n} `)),
    )
    if (i !== -1) { salida[id] = i; usadas.add(i) }
  }
  return salida
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
  /** Lo que se crearía o se cambiaría. */
  datos: Partial<Hermano>
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

/** Un DNI/NIE español bien formado. No se comprueba la letra: hay censos antiguos con erratas y rechazarlos entero sería peor. */
function limpiarDni(v: string): string {
  return v.replace(/[\s.-]/g, '').toUpperCase()
}

function pareceEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
}

/**
 * El año de antigüedad, de lo que sea que venga: «1998», «12/03/1998»,
 * «1998-03-12». Devuelve null si no hay forma de sacar un año creíble.
 */
export function anioDe(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const soloAnio = /^\d{4}$/.exec(t)
  if (soloAnio) {
    const n = Number(t)
    return n >= 1400 && n <= 2200 ? n : null
  }
  const conFecha = /(\d{4})/.exec(t)
  if (conFecha) {
    const n = Number(conFecha[1])
    return n >= 1400 && n <= 2200 ? n : null
  }
  return null
}

/** La situación, de lo que venga escrito en la hoja. */
export function estadoDe(v: string): EstadoHermano | null {
  const t = normalizar(v)
  if (!t) return null
  if (['baja', 'bajas', 'de baja', 'no activo', 'inactivo'].includes(t)) return 'Baja'
  if (['nuevo', 'nueva', 'alta', 'pendiente'].includes(t)) return 'Nuevo'
  if (['activo', 'activa', 'si', 'x', 'alta activa', 'ok'].includes(t)) return 'Activo'
  return null
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

  const dato = (fila: string[], campo: CampoImportable): string => {
    const i = emparejado[campo]
    return i === null || i === undefined ? '' : (fila[i] ?? '').trim()
  }

  // La primera fila es la cabecera, así que los datos empiezan en la 2.
  filas.slice(1).forEach((fila, idx) => {
    const linea = idx + 2
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
    let estado = estadoDe(estadoText)
    if (estadoText && estado === null) problemas.push(`No se entiende la situación «${estadoText}»`)
    if (estado === null) estado = antiguedad >= anioEnCurso ? 'Nuevo' : 'Activo'

    const existente = dni ? porDni.get(dni) : undefined
    const datos: Partial<Hermano> = {
      nombre,
      dni,
      estado,
      antiguedad,
      email,
      telefono: dato(fila, 'telefono'),
      direccion: dato(fila, 'direccion'),
      iban: dato(fila, 'iban') || null,
    }
    const nacimiento = dato(fila, 'fechaNacimiento')
    if (nacimiento) datos.fechaNacimiento = nacimiento

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
  /** Contraseña inicial para el área del hermano de los que entren nuevos. */
  clavePorDefecto: string
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
    const numero = fila.datos.estado === 'Baja' ? 0 : pedir(fila.datos.numero)
    censo.push({
      id: nuevoId(),
      numero,
      nombre: fila.datos.nombre ?? '',
      estado: fila.datos.estado ?? 'Activo',
      antiguedad: fila.datos.antiguedad ?? new Date().getFullYear(),
      email: fila.datos.email ?? '',
      telefono: fila.datos.telefono ?? '',
      direccion: fila.datos.direccion ?? '',
      cuotaAlDia: false,
      iban: fila.datos.iban ?? null,
      dni: fila.datos.dni ?? '',
      claveAcceso: opciones.clavePorDefecto,
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
