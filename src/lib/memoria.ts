/**
 * LA MEMORIA DEL EJERCICIO: el papel que se lee en el cabildo general.
 *
 * Una vez al año la junta se sienta delante de los hermanos y cuenta cómo ha
 * ido: cuántos somos, cuántos entraron y cuántos se fueron, qué se cobró, qué
 * se gastó y con qué saldo se cierra. Hasta ahora eso se armaba a mano
 * abriendo cinco pantallas distintas y copiando números a un documento aparte
 * —que es exactamente como se cuela una cifra que no cuadra con otra que se
 * enseña dos páginas después.
 *
 * Aquí se calcula TODO DE UNA VEZ y de las mismas tablas de las que salen los
 * informes. Es una función pura, sin React ni base de datos, para que las
 * cifras que se leen en voz alta delante de la hermandad se puedan comprobar
 * una a una en el banco de pruebas.
 *
 * ----------------------------------------------------------------------------
 * QUÉ SE PUEDE AFIRMAR DE UN AÑO PASADO Y QUÉ NO
 * ----------------------------------------------------------------------------
 *
 * Esto importa más que la aritmética, porque es donde un documento honrado se
 * convierte en uno que miente sin querer.
 *
 *   · LAS ALTAS del ejercicio son exactas siempre. La antigüedad —el año de
 *     entrada— queda escrita en la ficha y no se toca nunca más.
 *
 *   · LAS BAJAS del ejercicio son exactas desde que existe `fechaBaja`. Las
 *     anteriores no tienen fecha, y no se les inventa: se cuentan aparte y el
 *     documento lo dice.
 *
 *   · EL CENSO, EN CAMBIO, ES EL DE HOY. Un hermano que se dio de baja en
 *     marzo ya no está en la lista, así que contar la lista de hoy no da los
 *     que había a 31 de diciembre del año pasado. Cuando la memoria es de un
 *     ejercicio cerrado, el documento lo advierte en vez de dar por buena una
 *     foto que no es.
 *
 * La tesorería sí es histórica: cada apunte lleva su fecha, y el saldo de
 * arrastre se calcula con todo lo anterior al 1 de enero, igual que en el
 * estado de cuentas.
 */
import type { Hermano } from '../data/hermanos'
import type { Cuota } from '../data/cuotas'
import type { Papeleta } from '../data/papeletas'
import type { Movimiento } from '../data/movimientos'
import type { Enser } from '../data/enseres'
import type { Tramo } from './tramos'
import { sumaEuros, formatCurrency } from './format'
import { anioDelMovimiento } from './perdidasYGanancias'
import { ejercicioDe } from './cuotasEmision'
import { esMiembro } from './hermanoFicha'

/**
 * Una cifra de la memoria.
 *
 * `valor` es como se lee en el papel («3.600,50 €», «55 %», «+2»); `numero` es
 * el número que hay detrás, cuando lo hay; y `esDinero` dice si ese número es
 * un importe o una cuenta de cosas.
 *
 * Los tres, y no solo el texto, porque esto se exporta a una hoja de cálculo:
 * una columna en texto no se puede sumar, que es lo primero que hace quien la
 * abre. Y van dichos aquí en vez de adivinarse luego mirando el texto —«¿lleva
 * el símbolo del euro?»— porque adivinar acierta hasta el día que no, y el día
 * que no sale un número inventado dentro de unas cuentas que se presentan.
 */
export interface CifraMemoria {
  etiqueta: string
  valor: string
  numero?: number
  /** El `numero` es un importe en euros y se exporta con formato de moneda. */
  esDinero?: boolean
  /** Una línea corta que explica de dónde sale, cuando no es evidente. */
  ayuda?: string
}

export interface BloqueMemoria {
  titulo: string
  cifras: CifraMemoria[]
  /** Advertencia que va impresa dentro del bloque, si la hay. */
  nota?: string
}

export interface AltaMemoria {
  numero: number
  nombre: string
  estado: string
}

export interface BajaMemoria {
  nombre: string
  fecha: string
  motivo: string
}

export interface Memoria {
  anio: number
  /** El ejercicio que se resume es el año en curso, y no uno ya cerrado. */
  esElAnioEnCurso: boolean
  bloques: BloqueMemoria[]
  altas: AltaMemoria[]
  bajas: BajaMemoria[]
  /**
   * Bajas que constan sin fecha, de antes de que se guardara. No se pueden
   * repartir por ejercicios y por eso van contadas aparte y dichas.
   */
  bajasSinFecha: number
}

/** El año de una fecha ISO (aaaa-mm-dd). 0 si no se puede leer. */
function anioDe(fecha: string | undefined | null): number {
  const n = Number(String(fecha ?? '').slice(0, 4))
  return Number.isFinite(n) && n > 1000 ? n : 0
}

/** Una cifra de dinero. */
function cifra(etiqueta: string, euros: number, ayuda?: string): CifraMemoria {
  return { etiqueta, valor: formatCurrency(euros), numero: euros, esDinero: true, ayuda }
}

/** Una cuenta de cosas: hermanos, recibos, enseres. */
function cuenta(etiqueta: string, n: number, ayuda?: string): CifraMemoria {
  return { etiqueta, valor: String(n), numero: n, ayuda }
}

export interface DatosMemoria {
  hermanos: Hermano[]
  cuotas: Cuota[]
  papeletas: Papeleta[]
  movimientos: Movimiento[]
  tramos: Tramo[]
  enseres: Enser[]
}

export function construirMemoria(
  anio: number,
  datos: DatosMemoria,
  /**
   * El año en el que se está. Entra como parámetro y no se lee del reloj aquí
   * para poder probar qué dice la memoria de un ejercicio cerrado.
   */
  anioDeHoy: number = new Date().getFullYear(),
): Memoria {
  const { hermanos, cuotas, papeletas, movimientos, tramos, enseres } = datos
  const esElAnioEnCurso = anio === anioDeHoy

  /* ---------------------------------------------------------------- CENSO */
  const enElCenso = hermanos.filter(esMiembro)
  const altas = hermanos
    .filter((h) => h.antiguedad === anio)
    .sort((a, b) => a.numero - b.numero)
    .map((h) => ({ numero: h.numero, nombre: h.nombre, estado: h.estado }))

  const deBaja = hermanos.filter((h) => h.estado === 'Baja')
  const bajas = deBaja
    .filter((h) => anioDe(h.fechaBaja) === anio)
    .sort((a, b) => String(a.fechaBaja).localeCompare(String(b.fechaBaja)))
    .map((h) => ({
      nombre: h.nombre,
      fecha: h.fechaBaja ?? '',
      motivo: h.motivoBaja?.trim() || '—',
    }))
  const bajasSinFecha = deBaja.filter((h) => !anioDe(h.fechaBaja)).length

  const censo: BloqueMemoria = {
    titulo: 'El censo',
    nota: esElAnioEnCurso
      ? undefined
      : 'Los hermanos que figuran son los del censo de HOY, no los que había al '
        + `cerrar ${anio}: quien se dio de baja después ya no está en la lista. Las `
        + 'altas y las bajas del ejercicio sí son las de ese año.',
    cifras: [
      cuenta('Hermanos en el censo', enElCenso.length, 'Activos y nuevos, sin contar las bajas.'),
      cuenta('Altas del ejercicio', altas.length, `Entraron en ${anio}.`),
      cuenta('Bajas del ejercicio', bajas.length, `Se tramitaron en ${anio}.`),
      {
        etiqueta: 'Variación',
        // Con el signo delante también cuando es positiva: «+2» y «2» se leen
        // igual de una lista, pero en una memoria lo que se quiere ver de un
        // vistazo es si la hermandad creció o menguó.
        valor: `${altas.length - bajas.length >= 0 ? '+' : ''}${altas.length - bajas.length}`,
        numero: altas.length - bajas.length,
      },
    ],
  }
  if (bajasSinFecha > 0) {
    censo.cifras.push(cuenta(
      'Bajas sin fecha',
      bajasSinFecha,
      'De antes de que se guardara la fecha. No se pueden atribuir a un ejercicio.',
    ))
  }

  /* --------------------------------------------------------------- CUOTAS */
  /*
   * DEL EJERCICIO, y por `ejercicioDe()`, que es la misma cuenta que hace el
   * resto de la aplicación: el ejercicio escrito en el recibo o, si es de los
   * antiguos que no lo traen, el año de su emisión. Leer aquí la fecha por mi
   * cuenta sería el clásico segundo criterio para la misma pregunta, y con
   * dinero eso acaba en dos pantallas que se contradicen.
   */
  const cuotasAnio = cuotas.filter((c) => ejercicioDe(c) === anio)
  const cobrado = sumaEuros(cuotasAnio.filter((c) => c.estado === 'Pagada').map((c) => c.importe))
  const pendiente = sumaEuros(cuotasAnio.filter((c) => c.estado === 'Pendiente').map((c) => c.importe))
  const enMora = sumaEuros(cuotasAnio.filter((c) => c.estado === 'En mora').map((c) => c.importe))
  const devuelto = sumaEuros(cuotasAnio.filter((c) => c.estado === 'Devuelta').map((c) => c.importe))
  const emitido = sumaEuros([cobrado, pendiente, enMora, devuelto])
  const bloqueCuotas: BloqueMemoria = {
    titulo: 'Cuotas',
    cifras: [
      cuenta('Recibos emitidos', cuotasAnio.length),
      cifra('Cobrado', cobrado),
      cifra('Pendiente', pendiente),
      cifra('En mora', enMora, 'Deuda que la tesorería ya ha dado por vencida.'),
      cifra('Devuelto', devuelto),
      {
        etiqueta: 'Cobrado sobre lo emitido',
        // Sin recibos no es «0 %», es que no hay nada que medir. Un 0 % en la
        // memoria se lee como que no se cobró nada, que no es lo mismo.
        valor: emitido > 0 ? `${Math.round((cobrado / emitido) * 100)} %` : '—',
      },
    ],
  }

  /* ------------------------------------------------------------ TESORERÍA */
  const delAnio = movimientos.filter((m) => anioDelMovimiento(m.fecha) === anio)
  const ingresos = sumaEuros(delAnio.filter((m) => m.tipo === 'Ingreso').map((m) => m.importe))
  const gastos = sumaEuros(delAnio.filter((m) => m.tipo === 'Gasto').map((m) => m.importe))
  const saldoInicial = sumaEuros(
    movimientos
      // `> 0` a propósito: un apunte con la fecha ilegible no es «de antes de
      // este año», es que no se sabe de cuándo es. Meterlo en el arrastre
      // infla el saldo de partida sin que se note en ninguna suma.
      .filter((m) => anioDelMovimiento(m.fecha) > 0 && anioDelMovimiento(m.fecha) < anio)
      .map((m) => (m.tipo === 'Ingreso' ? Number(m.importe) : -Number(m.importe))),
  )
  const resultado = sumaEuros([ingresos, -gastos])
  const bloqueTesoreria: BloqueMemoria = {
    titulo: 'Tesorería',
    cifras: [
      cifra('Saldo a 1 de enero', saldoInicial, 'Arrastre de todo lo anterior al ejercicio.'),
      cifra('Ingresos del ejercicio', ingresos),
      cifra('Gastos del ejercicio', gastos),
      cifra('Resultado', resultado, 'Ingresos menos gastos del año.'),
      cifra('Saldo al cierre', sumaEuros([saldoInicial, resultado])),
      cuenta('Apuntes sin conciliar', delAnio.filter((m) => m.estado === 'Pendiente').length),
    ],
  }

  /* --------------------------------------------------------------- CORTEJO */
  const papeletasAnio = papeletas.filter((p) => p.anio === anio)
  const vivas = papeletasAnio.filter((p) => p.estado !== 'Anulada')
  const aforo = tramos.reduce((s, t) => s + t.capacidad, 0)
  const bloqueCortejo: BloqueMemoria = {
    titulo: 'Estación de penitencia',
    cifras: [
      cuenta('Papeletas de sitio', vivas.length, 'Sin contar las anuladas.'),
      cifra('Recaudado en papeletas', sumaEuros(vivas.map((p) => p.importe))),
      cuenta('Tramos', tramos.length),
      cuenta('Aforo del cortejo', aforo),
      {
        etiqueta: 'Ocupación',
        valor: aforo > 0 ? `${Math.round((vivas.length / aforo) * 100)} %` : '—',
      },
    ],
  }

  /* ------------------------------------------------------------ PATRIMONIO */
  const asegurados = enseres.filter((e) => e.valorAsegurado !== null)
  const bloquePatrimonio: BloqueMemoria = {
    titulo: 'Patrimonio',
    cifras: [
      cuenta('Enseres inventariados', enseres.length),
      cifra('Valor asegurado', sumaEuros(asegurados.map((e) => e.valorAsegurado ?? 0))),
      cuenta('Sin asegurar', enseres.length - asegurados.length),
      cuenta(
        'Necesitan restauración',
        enseres.filter((e) => e.estadoConservacion === 'Necesita restauración').length,
      ),
      cuenta('En préstamo', enseres.filter((e) => e.prestadoA !== null).length),
    ],
  }

  return {
    anio,
    esElAnioEnCurso,
    bloques: [censo, bloqueCuotas, bloqueTesoreria, bloqueCortejo, bloquePatrimonio],
    altas,
    bajas,
    bajasSinFecha,
  }
}

/**
 * Los años de los que tiene sentido sacar memoria, de mayor a menor.
 *
 * Salen de donde hay rastro de un EJERCICIO: apuntes de tesorería, recibos de
 * cuota, papeletas de sitio y bajas tramitadas. Y el año en curso siempre, aunque todavía no
 * haya nada apuntado, porque la memoria se empieza a mirar mucho antes de
 * cerrar el año.
 *
 * La antigüedad de los hermanos NO cuenta, y es a propósito: un censo normal
 * arranca en los años cuarenta, y meterla llenaría la lista de ochenta años
 * de los que esta aplicación no tiene ni un apunte. Las altas de un año
 * antiguo siguen saliendo si se pide ese año a mano; lo que no se hace es
 * ofrecer una memoria de 1948 como si hubiera algo que contar.
 */
export function aniosConMemoria(datos: DatosMemoria, anioDeHoy: number = new Date().getFullYear()): number[] {
  const anios = new Set<number>([anioDeHoy])
  datos.movimientos.forEach((m) => {
    const a = anioDelMovimiento(m.fecha)
    if (a > 0) anios.add(a)
  })
  datos.papeletas.forEach((p) => { if (p.anio > 0) anios.add(p.anio) })
  datos.cuotas.forEach((c) => {
    const e = ejercicioDe(c)
    if (e != null && e > 0) anios.add(e)
  })
  datos.hermanos.forEach((h) => {
    const b = anioDe(h.fechaBaja)
    if (b > 0) anios.add(b)
  })
  return [...anios].sort((a, b) => b - a)
}
