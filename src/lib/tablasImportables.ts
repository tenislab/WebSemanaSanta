import { limpiarDni } from './dni'
import { llano } from './buscar'
import { formatCurrency } from './format'
import {
  anioDe, elegirDeLista, fechaEs, fechaIso, importeDe, normalizarCabecera,
} from './leerTabla'
import type {
  ContextoDeTabla, FilaDeTabla, LecturaDeFila, TablaImportable,
} from './importarTabla'
import type { Cuota, EstadoCuota, MetodoCobro } from '../data/cuotas'
import type { Movimiento, TipoMovimiento } from '../data/movimientos'
import type { Enser, EstadoConservacion } from '../data/enseres'

/**
 * QUÉ SE PUEDE TRAER, ADEMÁS DEL CENSO.
 *
 * Tres tablas, y las tres son lo que una hermandad pierde el día que cambia de
 * programa si no hay forma de traérselas:
 *
 *   · el HISTORIAL DE CUOTAS. Es la memoria de la tesorería. Sin él no se
 *     puede reclamar un impago de hace dos años, ni decirle a un hermano desde
 *     cuándo está al corriente, ni cuadrar un cabildo de cuentas con el
 *     anterior;
 *   · el LIBRO DE CAJA (ingresos y gastos);
 *   · el INVENTARIO de enseres, con su valor de seguro.
 *
 * Cada descriptor dice tres cosas: qué columnas reconoce, cómo se lee una fila
 * y cómo se reconoce que esa fila YA ESTÁ guardada. Lo demás —el ensayo, los
 * números, deshacer— lo pone el motor (`lib/importarTabla.ts`).
 *
 * LA REGLA QUE MANDA EN TODO ESTE ARCHIVO, la misma que aprendió a golpes el
 * importador del censo: **una casilla en blanco no dice nada**. Lo que el
 * archivo no trae escrito no entra en `datos`, y por eso actualizar algo que ya
 * estaba nunca puede borrarle un dato que la hoja no tenía.
 */

/* ---------------------------------------------------------------------------
   Historial de cuotas
   --------------------------------------------------------------------------- */

/**
 * A qué hermano se refiere esta fila. Se prueba por DNI, por número y por
 * nombre, en ese orden, porque es el orden de lo fiable.
 *
 * POR QUÉ IMPORTA TANTO: un recibo que no se engancha a nadie no vale para
 * nada. No sale en la ficha del hermano, no cuenta para su deuda y no aparece
 * en «quién debe». Importar tres mil recibos huérfanos es peor que no
 * importarlos, porque la tesorería parece llena y no lo está.
 */
function buscarHermano(
  dni: string, numero: string, nombre: string, ctx: ContextoDeTabla,
): { id: string; nombre: string } | { problema: string } {
  const d = limpiarDni(dni)
  if (d) {
    const porDni = ctx.hermanos.find((h) => limpiarDni(h.dni) === d)
    if (porDni) return { id: porDni.id, nombre: porDni.nombre }
    return { problema: `No hay ningún hermano con el DNI «${dni.trim()}»` }
  }

  const n = Number(numero.replace(/\D/g, ''))
  if (numero.trim() && Number.isFinite(n) && n > 0) {
    const porNumero = ctx.hermanos.find((h) => h.numero === n)
    if (porNumero) return { id: porNumero.id, nombre: porNumero.nombre }
    return { problema: `No hay ningún hermano con el número ${n}` }
  }

  const buscado = llano(nombre)
  if (buscado) {
    // El nombre es lo último y lo más delicado: si hay dos que se llaman
    // igual, NO se elige uno. Enganchar el recibo al hermano equivocado es
    // cobrarle a quien no toca, y no se nota hasta que llama por teléfono.
    const iguales = ctx.hermanos.filter((h) => llano(h.nombre) === buscado)
    if (iguales.length === 1) return { id: iguales[0].id, nombre: iguales[0].nombre }
    if (iguales.length > 1) {
      return { problema: `Hay ${iguales.length} hermanos que se llaman «${nombre.trim()}»: haría falta el DNI o el número` }
    }
    return { problema: `No hay ningún hermano que se llame «${nombre.trim()}»` }
  }

  return { problema: 'La fila no dice de qué hermano es (ni DNI, ni número, ni nombre)' }
}

/** El estado de un recibo, de lo que ponga la casilla. */
export function estadoDeCuota(v: string): EstadoCuota | null {
  const t = normalizarCabecera(v)
  if (!t) return null
  if (['pagada', 'pagado', 'cobrada', 'cobrado', 'abonada', 'abonado', 'liquidada', 'si', 'x', 'ok', 'al corriente'].includes(t)) return 'Pagada'
  if (['devuelta', 'devuelto', 'retrocedida', 'rechazada', 'rechazado', 'impagada', 'impagado'].includes(t)) return 'Devuelta'
  if (['en mora', 'mora', 'moroso', 'morosa', 'reclamada', 'reclamado'].includes(t)) return 'En mora'
  if (['pendiente', 'no', 'sin pagar', 'debe', 'pendiente de pago'].includes(t)) return 'Pendiente'
  return null
}

/** Cómo se cobra, de lo que ponga la casilla. */
export function metodoDeCobro(v: string): MetodoCobro | null {
  const t = normalizarCabecera(v)
  if (!t) return null
  if (['domiciliacion', 'domiciliado', 'domiciliada', 'banco', 'recibo', 'recibo bancario', 'sepa', 'cargo en cuenta'].includes(t)) return 'Domiciliación'
  if (['transferencia', 'transf', 'ingreso', 'ingreso en cuenta'].includes(t)) return 'Transferencia'
  if (['efectivo', 'caja', 'metalico', 'mano', 'en mano'].includes(t)) return 'Efectivo'
  if (['bizum'].includes(t)) return 'Bizum'
  return null
}

export const TABLA_CUOTAS: TablaImportable<Cuota> = {
  id: 'cuotas',
  titulo: 'Traer el historial de cuotas',
  singular: 'recibo',
  plural: 'recibos',
  genero: 'm',
  explicacion:
    'El histórico de recibos que tenéis en el programa anterior o en un Excel: quién pagó qué y '
    + 'cuándo, año por año. Cada fila es un recibo. Se enganchan a la ficha de cada hermano, así '
    + 'que el censo tiene que estar ya importado.',
  imprescindibles: 'a quién, cuánto y de qué año',
  ayudaColumnas:
    'Hacen falta tres cosas: de qué hermano es (su DNI, su número o su nombre completo), el '
    + 'importe, y de qué ejercicio es (una columna con el año, o una fecha de emisión de la que '
    + 'sacarlo). Lo demás —concepto, estado, fecha de pago, forma de cobro— es bienvenido pero '
    + 'opcional.',
  repetidoEnArchivo: 'error',
  campos: [
    {
      id: 'hermanoDni',
      etiqueta: 'DNI del hermano',
      ayuda: 'Es lo que engancha el recibo a su ficha sin equivocarse. Si no lo tenéis, vale el número o el nombre.',
      sinonimos: ['dni', 'nif', 'nie', 'documento', 'dni/nie', 'd.n.i.', 'dni hermano', 'dni del hermano'],
    },
    {
      id: 'hermanoNumero',
      etiqueta: 'Nº de hermano',
      // «Nº de hermano» se queda en «n de hermano» al normalizar, y tiene que
      // estar escrita así SÍ O SÍ. Aquí no vale el emparejado por prefijo que
      // salva a esta columna en el censo —allí «numero» a secas es un sinónimo
      // y «n de hermano» empieza por «n »—, porque en una hoja de cuotas un
      // «Número» a secas es casi siempre el número del RECIBO, no el del
      // hermano, y aceptarlo dejaría el histórico entero sin enganchar.
      sinonimos: [
        'numero de hermano', 'n de hermano', 'no de hermano', 'num de hermano',
        'numero del hermano', 'n del hermano', 'n hermano', 'nhermano',
        'numero hermano', 'num hermano', 'nº hermano', 'hermano n',
      ],
    },
    {
      id: 'hermanoNombre',
      etiqueta: 'Nombre del hermano',
      ayuda: 'Solo se usa si no viene el DNI ni el número, y solo si no hay dos hermanos que se llamen igual.',
      sinonimos: ['nombre', 'hermano', 'nombre y apellidos', 'apellidos y nombre', 'titular', 'nombre completo'],
    },
    {
      id: 'importe',
      etiqueta: 'Importe',
      obligatorio: true,
      ayuda: 'En euros. Da igual «60», «60,00 €» o «1.234,56».',
      sinonimos: ['importe', 'cantidad', 'euros', 'cuota', 'importe cuota', 'total', 'importe euros'],
    },
    {
      id: 'ejercicio',
      etiqueta: 'Ejercicio (año)',
      ayuda: 'El año contable del recibo. Si no viene, se saca de la fecha de emisión.',
      sinonimos: ['ejercicio', 'ano', 'anio', 'year', 'temporada', 'ejercicio contable', 'ano cuota'],
    },
    {
      id: 'concepto',
      etiqueta: 'Concepto',
      ayuda: 'Cuota anual, cuota trimestral, extraordinaria… Si no viene, «Cuota anual».',
      sinonimos: ['concepto', 'descripcion', 'tipo', 'tipo de cuota', 'detalle', 'motivo'],
    },
    {
      id: 'estado',
      etiqueta: 'Estado (pagada, pendiente…)',
      ayuda: 'Si no viene, se deduce: con fecha de pago queda «Pagada», y sin ella «Pendiente».',
      sinonimos: ['estado', 'situacion', 'pagada', 'pagado', 'cobrada', 'cobrado', 'estado del recibo'],
    },
    {
      id: 'fechaEmision',
      etiqueta: 'Fecha de emisión',
      sinonimos: ['fecha', 'fecha de emision', 'fecha emision', 'emitida', 'emision', 'fecha recibo'],
    },
    {
      id: 'fechaPago',
      etiqueta: 'Fecha de pago',
      sinonimos: ['fecha de pago', 'fecha pago', 'pagada el', 'cobrada el', 'fecha de cobro', 'fecha cobro'],
    },
    {
      id: 'metodoCobro',
      etiqueta: 'Forma de cobro',
      sinonimos: ['forma de pago', 'forma de cobro', 'metodo', 'metodo de pago', 'modo de pago', 'via', 'medio de pago'],
    },
  ],

  faltaAlgo(emparejado) {
    const tiene = ['hermanoDni', 'hermanoNumero', 'hermanoNombre'].some((c) => (emparejado[c] ?? null) !== null)
    return tiene
      ? null
      : 'Falta decir de qué hermano es cada recibo: el DNI, el número o el nombre'
  },

  leerFila(leer, ctx): LecturaDeFila<Cuota> {
    const problemas: string[] = []
    const avisos: string[] = []
    const datos: Partial<Cuota> = {}

    const quien = buscarHermano(leer('hermanoDni'), leer('hermanoNumero'), leer('hermanoNombre'), ctx)
    if ('problema' in quien) problemas.push(quien.problema)
    else datos.hermanoId = quien.id

    const importeTexto = leer('importe')
    const importe = importeDe(importeTexto)
    if (!importeTexto) problemas.push('Falta el importe')
    else if (importe === null) problemas.push(`No se entiende el importe «${importeTexto}»`)
    else if (importe < 0) problemas.push(`El importe «${importeTexto}» es negativo: un recibo se cobra, no se paga`)
    else datos.importe = importe

    // El concepto se guarda tal cual lo escribe la hermandad: los conceptos los
    // define cada una en Configuración, y forzarlos a un catálogo cerrado
    // convertiría «Cuota de hermano mayor» en otra cosa.
    const concepto = leer('concepto').trim() || 'Cuota anual'
    datos.concepto = concepto

    const fechaEmisionIso = leer('fechaEmision') ? fechaIso(leer('fechaEmision')) : null
    if (leer('fechaEmision') && fechaEmisionIso === null) {
      problemas.push(`No se entiende la fecha de emisión «${leer('fechaEmision')}»`)
    }
    const fechaPagoIso = leer('fechaPago') ? fechaIso(leer('fechaPago')) : null
    if (leer('fechaPago') && fechaPagoIso === null) {
      problemas.push(`No se entiende la fecha de pago «${leer('fechaPago')}»`)
    }

    /*
     * DE QUÉ AÑO ES. Es obligatorio saberlo, y a propósito.
     *
     * Toda la pantalla de Cuotas habla de UN ejercicio: los recuentos, «quién
     * está al corriente», la emisión anual. Un histórico importado sin año
     * caería entero en el ejercicio en curso, y entonces los recibos de 2019
     * dirían que este año está pagado. Se prefiere pedir una columna con el
     * año a colocar diez años de historia donde no van.
     */
    const ejercicio = anioDe(leer('ejercicio')) ?? (fechaEmisionIso ? Number(fechaEmisionIso.slice(0, 4)) : null)
    if (ejercicio === null) {
      problemas.push('No se sabe de qué ejercicio es: hace falta una columna con el año, o una fecha de emisión')
    } else {
      datos.ejercicio = ejercicio
      if (ejercicio > ctx.anioEnCurso + 1) {
        avisos.push(`el ejercicio ${ejercicio} está en el futuro`)
      }
    }

    // La fecha de emisión que se guarda, escrita como la escribe la aplicación.
    // Si el archivo no la trae, el 1 de enero del ejercicio: es una fecha
    // honesta para un histórico y deja el recibo en su año.
    if (fechaEmisionIso) datos.fechaEmision = fechaEs(fechaEmisionIso)
    else if (ejercicio !== null) datos.fechaEmision = fechaEs(`${ejercicio}-01-01`)
    if (fechaPagoIso) datos.fechaPago = fechaEs(fechaPagoIso)

    /*
     * EL ESTADO, solo si el archivo lo dice de alguna forma.
     *
     * Si no hay columna de estado ni de fecha de pago, no se toca: poner
     * «Pendiente» por defecto al ACTUALIZAR convertiría en deuda un histórico
     * ya cobrado, y la hermandad se pondría a reclamar recibos pagados.
     */
    const estadoTexto = leer('estado')
    if (estadoTexto) {
      const estado = estadoDeCuota(estadoTexto)
      if (estado === null) problemas.push(`No se entiende el estado «${estadoTexto}»`)
      else datos.estado = estado
    } else if (fechaPagoIso) {
      datos.estado = 'Pagada'
    }

    const metodoTexto = leer('metodoCobro')
    if (metodoTexto) {
      const metodo = metodoDeCobro(metodoTexto)
      if (metodo === null) avisos.push(`no se entiende la forma de cobro «${metodoTexto}», se deja sin indicar`)
      else {
        datos.metodoCobro = metodo
        datos.domiciliada = metodo === 'Domiciliación'
      }
    }

    const nombreQuien = 'problema' in quien ? (leer('hermanoNombre').trim() || leer('hermanoDni').trim() || '(sin hermano)') : quien.nombre
    return {
      problemas,
      avisos,
      datos,
      titulo: nombreQuien,
      // El importe, escrito en español (1.234,56 €). En una pantalla que
      // existe justo para leer bien el dinero, enseñarlo a la inglesa es la
      // peor forma de perder la confianza de quien está repasando la vista
      // previa.
      sub: `${concepto}${ejercicio !== null ? ` · ${ejercicio}` : ''}${importe !== null ? ` · ${formatCurrency(importe)}` : ''}`,
      huella: datos.hermanoId && ejercicio !== null
        ? `${datos.hermanoId}|${ejercicio}|${normalizarCabecera(concepto)}`
        : '',
    }
  },

  huellaDe(c) {
    const ejercicio = c.ejercicio ?? anioDe(c.fechaEmision)
    return ejercicio === null ? '' : `${c.hermanoId}|${ejercicio}|${normalizarCabecera(c.concepto)}`
  },

  crear(datos, numero, id) {
    const ejercicio = datos.ejercicio ?? new Date().getFullYear()
    const fechaEmision = datos.fechaEmision ?? fechaEs(`${ejercicio}-01-01`)
    return {
      id,
      numero,
      hermanoId: datos.hermanoId ?? '',
      concepto: datos.concepto ?? 'Cuota anual',
      importe: datos.importe ?? 0,
      estado: datos.estado ?? 'Pendiente',
      ejercicio,
      fechaEmision,
      // Un histórico no tiene fecha de cobro futura: la del propio recibo.
      fechaCobro: datos.fechaPago ?? fechaEmision,
      domiciliada: datos.domiciliada ?? false,
      ...(datos.metodoCobro ? { metodoCobro: datos.metodoCobro } : {}),
      ...(datos.fechaPago ? { fechaPago: datos.fechaPago } : {}),
      /*
       * SIN MARCA DE REMESA, y esto no es un detalle.
       *
       * `remesadaEl` vacío significa «todavía no ha ido al banco». Un recibo
       * histórico pendiente y domiciliado entra en la próxima remesa SEPA por
       * eso mismo, que es lo correcto si de verdad está pendiente — y por eso
       * se avisa en la vista previa antes de importar (ver `avisosDelConjunto`).
       */
    }
  },

  avisosDelConjunto(filas) {
    const avisos: string[] = []
    const remesables = filas.filter(
      (f) => f.queLePasa !== 'error' && f.datos.domiciliada === true && (f.datos.estado ?? 'Pendiente') !== 'Pagada',
    )
    if (remesables.length > 0) {
      avisos.push(
        `${remesables.length} ${remesables.length === 1 ? 'recibo entra pendiente y domiciliado' : 'recibos entran pendientes y domiciliados'}: `
        + 'saldrán en la próxima remesa al banco. Si son históricos ya cobrados, marcadlos como pagados en el archivo antes de importar.',
      )
    }
    const conDeuda = new Set(filas.filter((f) => f.queLePasa !== 'error').map((f) => f.datos.hermanoId))
    conDeuda.delete(undefined)
    if (conDeuda.size > 0) {
      avisos.push(`Los recibos se reparten entre ${conDeuda.size} hermanos del censo.`)
    }
    return avisos
  },
}

/* ---------------------------------------------------------------------------
   Libro de caja (tesorería)
   --------------------------------------------------------------------------- */

/** Ingreso o gasto, de lo que ponga la casilla. */
export function tipoDeMovimiento(v: string): TipoMovimiento | null {
  const t = normalizarCabecera(v)
  if (!t) return null
  if (['ingreso', 'ingresos', 'entrada', 'entradas', 'abono', 'haber', 'cobro', 'i', 'e'].includes(t)) return 'Ingreso'
  if (['gasto', 'gastos', 'salida', 'salidas', 'cargo', 'debe', 'pago', 'g', 's'].includes(t)) return 'Gasto'
  return null
}

export const TABLA_MOVIMIENTOS: TablaImportable<Movimiento> = {
  id: 'movimientos',
  titulo: 'Traer el libro de caja',
  singular: 'movimiento',
  plural: 'movimientos',
  genero: 'm',
  explicacion:
    'Los ingresos y gastos que ya tenéis apuntados: el libro de caja del ejercicio, o el extracto '
    + 'que os da el banco. Cada fila es un apunte. Si volvéis a subir un extracto que se solapa '
    + 'con otro anterior, los repetidos se reconocen y no se duplican.',
  imprescindibles: 'fecha, concepto e importe',
  ayudaColumnas:
    'Hacen falta la fecha, el concepto y el importe. El tipo (ingreso o gasto) se puede indicar en '
    + 'su propia columna, con el signo del importe (los negativos son gastos), o con dos columnas '
    + 'separadas de entradas y salidas, como en el libro de caja de toda la vida. La categoría se '
    + 'empareja con vuestro catálogo de Configuración.',
  repetidoEnArchivo: 'aviso',
  campos: [
    {
      id: 'fecha',
      etiqueta: 'Fecha',
      obligatorio: true,
      sinonimos: ['fecha', 'fecha operacion', 'fecha valor', 'fecha contable', 'dia', 'fecha del apunte'],
    },
    {
      id: 'concepto',
      etiqueta: 'Concepto',
      obligatorio: true,
      sinonimos: ['concepto', 'descripcion', 'detalle', 'texto', 'observaciones', 'movimiento'],
    },
    {
      id: 'importe',
      etiqueta: 'Importe',
      ayuda: 'Si los gastos vienen en negativo, se entienden solos. Si tenéis columnas separadas de entradas y salidas, dejad esta vacía.',
      sinonimos: ['importe', 'cantidad', 'euros', 'total', 'importe eur', 'saldo movimiento'],
    },
    {
      id: 'entrada',
      etiqueta: 'Columna de entradas (ingresos)',
      ayuda: 'Solo si vuestra hoja lleva las entradas y las salidas en dos columnas.',
      sinonimos: ['entrada', 'entradas', 'ingreso', 'ingresos', 'haber', 'debe haber', 'abono', 'abonos'],
    },
    {
      id: 'salida',
      etiqueta: 'Columna de salidas (gastos)',
      ayuda: 'Solo si vuestra hoja lleva las entradas y las salidas en dos columnas.',
      sinonimos: ['salida', 'salidas', 'gasto', 'gastos', 'debe', 'cargo', 'cargos', 'pagos'],
    },
    {
      id: 'tipo',
      etiqueta: 'Tipo (ingreso o gasto)',
      sinonimos: ['tipo', 'tipo de movimiento', 'clase', 'signo', 'naturaleza'],
    },
    {
      id: 'categoria',
      etiqueta: 'Categoría',
      ayuda: 'Se empareja con vuestro catálogo. Lo que no cuadre cae en «otros» y se avisa.',
      sinonimos: ['categoria', 'partida', 'concepto contable', 'grupo', 'apartado', 'cuenta contable'],
    },
    {
      id: 'cuenta',
      etiqueta: 'Cuenta',
      sinonimos: ['cuenta', 'caja', 'banco', 'cuenta bancaria', 'origen'],
    },
    {
      id: 'estado',
      etiqueta: 'Estado (conciliado o pendiente)',
      sinonimos: ['estado', 'conciliado', 'conciliada', 'situacion', 'punteado'],
    },
  ],

  faltaAlgo(emparejado) {
    const tieneImporte = ['importe', 'entrada', 'salida'].some((c) => (emparejado[c] ?? null) !== null)
    return tieneImporte
      ? null
      : 'Falta la columna del importe (o las dos de entradas y salidas)'
  },

  leerFila(leer, ctx): LecturaDeFila<Movimiento> {
    const problemas: string[] = []
    const avisos: string[] = []
    const datos: Partial<Movimiento> = {}

    const fechaTexto = leer('fecha')
    const iso = fechaIso(fechaTexto)
    if (!fechaTexto) problemas.push('Falta la fecha')
    else if (iso === null) problemas.push(`No se entiende la fecha «${fechaTexto}»`)
    else datos.fecha = fechaEs(iso)

    const concepto = leer('concepto').trim()
    if (!concepto) problemas.push('Falta el concepto')
    else datos.concepto = concepto

    /*
     * DE DÓNDE SALE EL IMPORTE, Y CON QUÉ SIGNO.
     *
     * Hay tres formas de escribir esto, y las tres se ven en hojas reales:
     *
     *   1. dos columnas, entradas y salidas (el libro de caja de siempre);
     *   2. una columna con el signo (el extracto del banco: los gastos en
     *      negativo);
     *   3. una columna sin signo más otra que dice si es ingreso o gasto.
     *
     * Dentro se guarda SIEMPRE positivo, y el signo lo lleva `tipo`: así lo
     * hace la pantalla de Tesorería al crear un apunte a mano, y mezclar las
     * dos convenciones descuadraría el saldo sin que se viera.
     */
    const entradaTexto = leer('entrada')
    const salidaTexto = leer('salida')
    const importeTexto = leer('importe')
    const tipoDicho = tipoDeMovimiento(leer('tipo'))
    if (leer('tipo') && tipoDicho === null) {
      avisos.push(`no se entiende el tipo «${leer('tipo')}», se deduce del importe`)
    }

    const entrada = entradaTexto ? importeDe(entradaTexto) : null
    const salida = salidaTexto ? importeDe(salidaTexto) : null
    const suelto = importeTexto ? importeDe(importeTexto) : null

    let importe: number | null = null
    let tipo: TipoMovimiento | null = tipoDicho
    if (entrada !== null && entrada !== 0) {
      importe = Math.abs(entrada)
      tipo = tipo ?? 'Ingreso'
    } else if (salida !== null && salida !== 0) {
      importe = Math.abs(salida)
      tipo = tipo ?? 'Gasto'
    } else if (suelto !== null) {
      importe = Math.abs(suelto)
      // Con columna de tipo manda ella; sin ella, el signo.
      tipo = tipo ?? (suelto < 0 ? 'Gasto' : 'Ingreso')
    }

    if (importe === null) {
      const escrito = [importeTexto, entradaTexto, salidaTexto].filter(Boolean).join(' / ')
      problemas.push(escrito ? `No se entiende el importe «${escrito}»` : 'Falta el importe')
    } else if (importe === 0) {
      problemas.push('El importe es cero')
    } else {
      datos.importe = importe
      datos.tipo = tipo ?? 'Ingreso'
    }

    const cuales = datos.tipo === 'Gasto' ? ctx.categoriasGasto : ctx.categoriasIngreso
    const categoriaTexto = leer('categoria')
    if (categoriaTexto) {
      const encontrada = elegirDeLista(categoriaTexto, cuales)
      if (encontrada) datos.categoria = encontrada
      else {
        // No se inventa una partida: se deja la última del catálogo (que es la
        // de «otros») y se avisa, porque de las categorías cuelga el Estado de
        // Cuentas que se presenta en el cabildo.
        datos.categoria = cuales[cuales.length - 1] ?? 'Otros ingresos'
        avisos.push(`la categoría «${categoriaTexto}» no está en vuestro catálogo, va a «${datos.categoria}»`)
      }
    } else if (datos.tipo) {
      datos.categoria = cuales[cuales.length - 1] ?? 'Otros ingresos'
    }

    const cuentaTexto = leer('cuenta')
    if (cuentaTexto) {
      datos.cuenta = elegirDeLista(cuentaTexto, ctx.cuentas) ?? cuentaTexto.trim()
    }

    /*
     * CONCILIADO POR DEFECTO, y es a propósito.
     *
     * Lo que se importa es un libro ya cerrado: son apuntes que la hermandad
     * ya cuadró en su día. Entrando como «pendientes», Tesorería abriría con
     * «1.200 por conciliar» en rojo el primer día, y ese aviso dejaría de
     * significar nada.
     */
    const estadoTexto = leer('estado')
    if (estadoTexto) {
      const t = normalizarCabecera(estadoTexto)
      if (['pendiente', 'no', 'sin conciliar', 'por conciliar', 'pte'].includes(t)) datos.estado = 'Pendiente'
      else if (['conciliado', 'conciliada', 'si', 'x', 'ok', 'punteado', 'cuadrado'].includes(t)) datos.estado = 'Conciliado'
      else avisos.push(`no se entiende el estado «${estadoTexto}», entra como conciliado`)
    }

    return {
      problemas,
      avisos,
      datos,
      titulo: concepto || '(sin concepto)',
      sub: `${datos.fecha ?? (fechaTexto || 'sin fecha')}${importe !== null ? ` · ${datos.tipo === 'Gasto' ? '−' : '+'}${formatCurrency(importe)}` : ''}`,
      huella: datos.fecha && concepto && importe !== null
        ? `${datos.fecha}|${normalizarCabecera(concepto)}|${datos.tipo}|${importe.toFixed(2)}`
        : '',
    }
  },

  huellaDe(m) {
    return `${m.fecha}|${normalizarCabecera(m.concepto)}|${m.tipo}|${Number(m.importe).toFixed(2)}`
  },

  crear(datos, numero, id) {
    return {
      id,
      numero,
      fecha: datos.fecha ?? '',
      concepto: datos.concepto ?? '',
      categoria: datos.categoria ?? 'Otros ingresos',
      tipo: datos.tipo ?? 'Ingreso',
      importe: datos.importe ?? 0,
      cuenta: datos.cuenta ?? 'Cuenta bancaria',
      estado: datos.estado ?? 'Conciliado',
    }
  },

  avisosDelConjunto(filas) {
    const buenas = filas.filter((f) => f.queLePasa !== 'error')
    const ingresos = buenas.filter((f) => f.datos.tipo === 'Ingreso')
    const gastos = buenas.filter((f) => f.datos.tipo === 'Gasto')
    const suma = (lista: FilaDeTabla<Movimiento>[]) =>
      Math.round(lista.reduce((n, f) => n + Math.round((f.datos.importe ?? 0) * 100), 0)) / 100
    if (buenas.length === 0) return []
    /*
     * EL CUADRE, ANTES DE IMPORTAR. Es lo primero que mira un tesorero, y es
     * lo que delata que el signo se ha leído al revés: si el archivo entero
     * entra como ingresos, aquí se ve de un vistazo y no después de haber
     * metido setecientos apuntes.
     */
    const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
    return [
      `Entran ${cuantos(ingresos.length, 'ingreso', 'ingresos')} por ${formatCurrency(suma(ingresos))} `
      + `y ${cuantos(gastos.length, 'gasto', 'gastos')} por ${formatCurrency(suma(gastos))}. `
      + `Saldo: ${formatCurrency(suma(ingresos) - suma(gastos))}. Si el signo está al revés, se ve aquí.`,
    ]
  },
}

/* ---------------------------------------------------------------------------
   Inventario de enseres
   --------------------------------------------------------------------------- */

/** El estado de conservación, de lo que ponga la casilla. */
export function estadoDeConservacion(v: string): EstadoConservacion | null {
  const t = normalizarCabecera(v)
  if (!t) return null
  if (['bueno', 'buena', 'bien', 'ok', 'correcto', 'correcta', 'optimo', 'optima', 'excelente'].includes(t)) return 'Bueno'
  if (['regular', 'aceptable', 'normal', 'medio'].includes(t)) return 'Regular'
  if (['necesita restauracion', 'restaurar', 'malo', 'mala', 'mal', 'deteriorado', 'deteriorada', 'en restauracion', 'pendiente de restaurar'].includes(t)) {
    return 'Necesita restauración'
  }
  return null
}

export const TABLA_ENSERES: TablaImportable<Enser> = {
  id: 'enseres',
  titulo: 'Traer el inventario',
  singular: 'pieza',
  plural: 'piezas',
  genero: 'f',
  explicacion:
    'El inventario de enseres que tenéis en una hoja: orfebrería, textil, túnicas, mobiliario. '
    + 'Cada fila es una pieza. Si vuestra hoja lleva el valor de seguro, entra también y suma '
    + 'directamente en el total asegurado.',
  imprescindibles: 'el nombre de la pieza',
  ayudaColumnas:
    'Solo el nombre de la pieza es imprescindible. Todo lo demás —categoría, ubicación, estado de '
    + 'conservación, valor asegurado, préstamo, año de alta, notas— es opcional. Las categorías se '
    + 'emparejan con vuestro catálogo de Configuración, y las que no estén se avisan para que las '
    + 'añadáis.',
  repetidoEnArchivo: 'aviso',
  campos: [
    {
      id: 'nombre',
      etiqueta: 'Nombre de la pieza',
      obligatorio: true,
      ayuda: 'Es lo que identifica la pieza y evita traerla dos veces.',
      sinonimos: ['nombre', 'pieza', 'enser', 'descripcion', 'denominacion', 'objeto', 'bien'],
    },
    {
      id: 'categoria',
      etiqueta: 'Categoría',
      sinonimos: ['categoria', 'tipo', 'clase', 'grupo', 'familia'],
    },
    {
      id: 'ubicacion',
      etiqueta: 'Ubicación',
      sinonimos: ['ubicacion', 'lugar', 'sitio', 'localizacion', 'donde esta', 'almacen', 'deposito'],
    },
    {
      id: 'estadoConservacion',
      etiqueta: 'Estado de conservación',
      ayuda: 'Bueno, regular o necesita restauración. Si no viene, «Bueno».',
      sinonimos: ['estado', 'conservacion', 'estado de conservacion', 'estado conservacion'],
    },
    {
      id: 'valorAsegurado',
      etiqueta: 'Valor asegurado',
      ayuda: 'En euros. Vacío significa que no está asegurada, y así se guarda.',
      sinonimos: ['valor', 'valor asegurado', 'valoracion', 'tasacion', 'seguro', 'importe asegurado', 'valor de seguro'],
    },
    {
      id: 'prestadoA',
      etiqueta: 'Prestado a',
      sinonimos: ['prestado a', 'prestado', 'cesion', 'cedido a', 'prestamo'],
    },
    {
      id: 'fechaAlta',
      etiqueta: 'Año o fecha de alta',
      sinonimos: ['fecha de alta', 'alta', 'ano', 'anio', 'fecha', 'adquisicion', 'ano de adquisicion'],
    },
    {
      id: 'notas',
      etiqueta: 'Notas',
      sinonimos: ['notas', 'observaciones', 'comentarios', 'detalle'],
    },
  ],

  leerFila(leer, ctx): LecturaDeFila<Enser> {
    const problemas: string[] = []
    const avisos: string[] = []
    const datos: Partial<Enser> = {}

    const nombre = leer('nombre').trim()
    if (!nombre) problemas.push('Falta el nombre de la pieza')
    else datos.nombre = nombre

    const categoriaTexto = leer('categoria')
    if (categoriaTexto) {
      const encontrada = elegirDeLista(categoriaTexto, ctx.categoriasEnser)
      // A diferencia de la tesorería, aquí SÍ se respeta lo que ponga la hoja
      // aunque no esté en el catálogo: las categorías de enseres son etiquetas
      // libres y no cuelga de ellas ningún informe. Se avisa para que la
      // añadan en Configuración y aparezca en los filtros.
      // Las que no están en el catálogo se avisan UNA vez, al final
      // (`avisosDelConjunto`), y no fila a fila: un inventario de trescientas
      // piezas con una categoría nueva soltaría trescientos avisos iguales y
      // taparía los que sí hay que leer.
      datos.categoria = encontrada ?? categoriaTexto.trim()
    }

    const ubicacion = leer('ubicacion').trim()
    if (ubicacion) datos.ubicacion = ubicacion

    const estadoTexto = leer('estadoConservacion')
    if (estadoTexto) {
      const estado = estadoDeConservacion(estadoTexto)
      if (estado === null) avisos.push(`no se entiende el estado «${estadoTexto}», entra como «Bueno»`)
      else datos.estadoConservacion = estado
    }

    const valorTexto = leer('valorAsegurado')
    if (valorTexto) {
      const valor = importeDe(valorTexto)
      if (valor === null) problemas.push(`No se entiende el valor asegurado «${valorTexto}»`)
      else if (valor < 0) problemas.push(`El valor asegurado «${valorTexto}» es negativo`)
      else datos.valorAsegurado = valor
    }

    const prestado = leer('prestadoA').trim()
    if (prestado) datos.prestadoA = prestado

    // El año de alta se guarda como lo escribe la hermandad cuando ya es un
    // año («1998»); si trae una fecha entera, se pone como la escribe la
    // aplicación para que las dos formas no convivan en la misma columna.
    const altaTexto = leer('fechaAlta').trim()
    if (altaTexto) {
      const iso = fechaIso(altaTexto)
      datos.fechaAlta = iso ? fechaEs(iso) : (anioDe(altaTexto) !== null ? String(anioDe(altaTexto)) : altaTexto)
    }

    const notas = leer('notas').trim()
    if (notas) datos.notas = notas

    return {
      problemas,
      avisos,
      datos,
      titulo: nombre || '(sin nombre)',
      sub: [datos.categoria, datos.ubicacion].filter(Boolean).join(' · ') || 'sin categoría',
      huella: nombre ? normalizarCabecera(nombre) : '',
    }
  },

  huellaDe(e) {
    return normalizarCabecera(e.nombre)
  },

  crear(datos, numero, id) {
    return {
      id,
      numero,
      nombre: datos.nombre ?? '',
      categoria: datos.categoria ?? 'Otro',
      ubicacion: datos.ubicacion ?? '',
      estadoConservacion: datos.estadoConservacion ?? 'Bueno',
      // `null` y no 0: una pieza sin valor de seguro NO está asegurada por
      // cero euros, es que no está asegurada, y el total no debe contarla.
      valorAsegurado: datos.valorAsegurado ?? null,
      prestadoA: datos.prestadoA ?? null,
      fechaAlta: datos.fechaAlta ?? '',
      notas: datos.notas ?? '',
    }
  },

  avisosDelConjunto(filas, ctx) {
    const fuera = new Set<string>()
    for (const f of filas) {
      const c = f.datos.categoria
      if (c && !ctx.categoriasEnser.some((x) => normalizarCabecera(x) === normalizarCabecera(c))) fuera.add(c)
    }
    if (fuera.size === 0) return []
    return [
      `Estas categorías no están en vuestro catálogo y no saldrán en los filtros hasta que las `
      + `añadáis en Configuración: ${[...fuera].join(', ')}.`,
    ]
  },
}
