#!/usr/bin/env node
/**
 * Las otras tres tablas de prueba: historial de cuotas, libro de caja e
 * inventario.
 *
 *   node scripts/tablas-de-prueba.mjs [carpeta]
 *
 * Para qué sirven: igual que el censo de prueba, para que una hermandad ensaye
 * el traspaso ANTES de subir lo suyo de verdad. Y traen a propósito los líos
 * que trae siempre una hoja real, para que se vea que el importador los caza y
 * los dice en cristiano:
 *
 *   · importes con millares y con el euro pegado («1.234,56 €»), que es donde
 *     se equivoca todo el mundo al leer una hoja ajena;
 *   · un recibo repetido (mismo hermano, mismo año, mismo concepto), que es un
 *     cobro doble;
 *   · un recibo de alguien que no está en el censo;
 *   · un libro de caja con las entradas y las salidas en dos columnas, que es
 *     como se lleva de toda la vida;
 *   · una categoría que no está en el catálogo de la hermandad;
 *   · una pieza sin valor de seguro, que NO es una pieza de cero euros.
 *
 * Los DNI son los mismos que los del censo de prueba: así se puede hacer el
 * recorrido entero —censo primero, cuotas después— y los recibos enganchan.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { construirXlsx } from './censo-de-prueba.mjs'

/** El mismo CSV que suelta Excel en España: punto y coma, y con BOM por los acentos. */
function csv(cabeceras, filas) {
  const linea = (f) => f.map((v) => (/[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(';')
  return '\uFEFF' + [linea(cabeceras), ...filas.map(linea)].join('\r\n') + '\r\n'
}

/* ----------------------------- Cuotas ----------------------------------- */

const CAB_CUOTAS = ['D.N.I.', 'Apellidos y nombre', 'Ejercicio', 'Concepto', 'Importe', 'Estado', 'Fecha de pago', 'Forma de pago']

const CUOTAS = [
  ['10111213H', 'Utrera Zamora, Pablo', '2023', 'Cuota anual', '60,00 €', 'Pagada', '12/02/2023', 'Domiciliación'],
  ['10111213H', 'Utrera Zamora, Pablo', '2024', 'Cuota anual', '60,00 €', 'Pagada', '10/02/2024', 'Domiciliación'],
  ['10111213H', 'Utrera Zamora, Pablo', '2025', 'Cuota anual', '65,00 €', 'Pagada', '11/02/2025', 'Domiciliación'],
  ['23456789J', 'Bermúdez Cano, José Antonio', '2024', 'Cuota anual', '60,00 €', 'Pagada', '10/02/2024', 'Transferencia'],
  ['23456789J', 'Bermúdez Cano, José Antonio', '2025', 'Cuota anual', '65,00 €', 'Pendiente', '', 'Transferencia'],
  ['34567890W', 'Cordero Rueda, Ana Isabel', '2025', 'Cuota anual', '65,00 €', 'Devuelta', '', 'Domiciliación'],
  ['45678901A', 'Delgado Nieto, Francisco Javier', '2025', 'Cuota anual', '65,00 €', 'Pagada', '14/02/2025', 'Bizum'],
  // Una extraordinaria del mismo hermano y del mismo año: NO es un repetido,
  // porque el concepto es otro. Sirve para ver que la regla distingue.
  ['45678901A', 'Delgado Nieto, Francisco Javier', '2025', 'Cuota extraordinaria restauración', '25,00 €', 'Pagada', '20/03/2025', 'Efectivo'],
  // Un importe grande escrito con millares, que es donde se equivoca todo el
  // mundo al leer una hoja: son mil doscientos treinta y cuatro con cincuenta y
  // seis, no ciento veintitrés mil.
  ['56789012G', 'Espinosa Gil, Rocío', '2025', 'Donativo extraordinario', '1.234,56 €', 'Pagada', '02/04/2025', 'Transferencia'],
  ['67890123M', 'Fernández Ojeda, Manuel', '2024', 'Cuota anual', '60', 'Pagada', '10/02/2024', 'Domiciliación'],
  ['78901234Y', 'Gálvez Cruz, Inmaculada', '2025', 'Cuota anual', '65,00 €', 'En mora', '', 'Domiciliación'],

  // --- A partir de aquí, los líos ---

  // EL RECIBO REPETIDO: mismo hermano, mismo ejercicio, mismo concepto. Es un
  // cobro doble, y el importador saca las DOS filas para que se mire cuál vale.
  ['10111213H', 'Utrera Zamora, Pablo', '2025', 'Cuota anual', '65,00 €', 'Pagada', '11/02/2025', 'Domiciliación'],
  // Alguien que no está en el censo: un recibo que no se engancha a nadie no
  // vale para nada, así que se queda fuera y se dice de quién es.
  ['99999999R', 'Persona Que No Está, Juan', '2025', 'Cuota anual', '65,00 €', 'Pendiente', '', ''],
  // Sin ejercicio ni fecha: no se sabe de qué año es, y colocarlo en el año en
  // curso haría creer que este año está pagado.
  ['89012345F', 'Herrera Pavón, Álvaro', '', 'Cuota anual', '65,00 €', 'Pagada', '', 'Efectivo'],
]

/* ---------------------------- Libro de caja ------------------------------ */

/**
 * A dos columnas —entradas y salidas—, que es como se lleva un libro de caja de
 * toda la vida y como lo exporta media contabilidad parroquial.
 */
const CAB_CAJA = ['Fecha', 'Concepto', 'Partida', 'Entradas', 'Salidas', 'Cuenta']

const CAJA = [
  ['05/01/2026', 'Cuotas de enero', 'Cuotas Hermanos/as', '1.240,00', '', 'Cuenta bancaria'],
  ['08/01/2026', 'Donativo de un hermano', 'Donativos, Ofrendas y Cepillos', '300,00', '', 'Cuenta bancaria'],
  ['12/01/2026', 'Recibo de la luz de la casa hermandad', 'Mantenimiento', '', '186,40', 'Cuenta bancaria'],
  ['15/01/2026', 'Flores para el altar de cultos', 'Cultos Internos', '', '420,00', 'Caja'],
  ['20/01/2026', 'Restauración de un candelabro', 'Restauraciones', '', '950,00', 'Cuenta bancaria'],
  ['22/01/2026', 'Subvención del ayuntamiento', 'Subvenciones', '800,00', '', 'Cuenta bancaria'],
  ['28/01/2026', 'Seguro de responsabilidad civil', 'Gastos varios menores', '', '275,00', 'Cuenta bancaria'],
  ['03/02/2026', 'Cepillo de la capilla', 'Donativos, Ofrendas y Cepillos', '412,35', '', 'Caja'],
  ['10/02/2026', 'Imprenta de las papeletas de sitio', 'Secretaría', '', '1.180,00', 'Cuenta bancaria'],
  ['14/02/2026', 'Cera para la estación de penitencia', 'Cultos Externos', '', '2.340,50', 'Cuenta bancaria'],
  // Una partida que casi ninguna hermandad tiene en su catálogo: entra en la de
  // «otros» y el importador lo dice, para que la añadan en Configuración si la
  // quieren separada en el estado de cuentas.
  ['18/02/2026', 'Autobuses del traslado a la parroquia', 'Traslados', '', '340,00', 'Caja'],
  ['20/02/2026', 'Lotería de Navidad (liquidación)', 'Otros ingresos', '2.115,00', '', 'Cuenta bancaria'],
]

/* ------------------------------ Inventario -------------------------------- */

const CAB_INVENTARIO = ['Pieza', 'Tipo', 'Ubicación', 'Estado de conservación', 'Valor asegurado', 'Prestado a', 'Año de alta', 'Observaciones']

const INVENTARIO = [
  ['Cruz de guía de plata de ley', 'Orfebrería', 'Casa hermandad — Sala capitular', 'Bueno', '18.000,00 €', '', '1998', 'Restaurada en 2019.'],
  ['Palio de la Virgen (bambalinas bordadas)', 'Textil', 'Camarín', 'Bueno', '42.000,00 €', '', '2004', ''],
  ['Juego de candelabros de cola', 'Orfebrería', 'Casa hermandad — Almacén', 'Regular', '9.500,00 €', '', '1985', 'Falta plateado en dos piezas.'],
  ['Túnicas de nazareno (lote de 40)', 'Túnica', 'Casa hermandad — Ropero', 'Bueno', '6.000,00 €', '', '2015', 'Revisar cíngulos antes de la salida.'],
  ['Senatus romano', 'Enser de culto', 'Casa hermandad — Sala capitular', 'Necesita restauración', '3.200,00 €', '', '1972', 'Grietas en el asta.'],
  ['Estandarte corporativo', 'Textil', 'Cedido a la Agrupación', 'Bueno', '4.100,00 €', 'Agrupación de Cofradías (exposición)', '2010', 'Devolución tras la exposición.'],
  ['Manto de la Virgen (terciopelo bordado en oro)', 'Textil', 'Camarín', 'regular', '65.000,00 €', '', '1955', 'Consolidar bordado.'],
  // Sin valor asegurado: NO es una pieza de cero euros, es una pieza que no
  // está asegurada. Entra sin valor y no suma en el total del seguro.
  ['Banco de la presidencia', 'Mobiliario', 'Casa hermandad — Almacén', 'mal', '', '', '1978', 'Sin asegurar, tasación pendiente.'],
  // Una categoría que no está en el catálogo por defecto: se respeta lo que
  // pone la hoja y se avisa, porque hasta que no la añadan no sale en los
  // filtros de Inventario.
  ['Libro de reglas (edición de 1943)', 'Documentación', 'Archivo', 'Regular', '', '', '1943', 'Consultar antes de manipular.'],
  // El año de alta escrito como fecha entera en vez de como año.
  ['Juego de varas de presidencia', 'Orfebrería', 'Casa hermandad — Almacén', 'Bueno', '5.200,00 €', '', '14/09/1990', ''],
]

/* -------------------------------------------------------------------------- */

const TABLAS = [
  { nombre: 'historial-de-cuotas', cabeceras: CAB_CUOTAS, filas: CUOTAS, que: 'recibos' },
  { nombre: 'libro-de-caja', cabeceras: CAB_CAJA, filas: CAJA, que: 'movimientos' },
  { nombre: 'inventario', cabeceras: CAB_INVENTARIO, filas: INVENTARIO, que: 'piezas' },
]

if (import.meta.url === `file://${process.argv[1]}`) {
  const carpeta = process.argv[2] ?? '.'
  mkdirSync(carpeta, { recursive: true })
  for (const t of TABLAS) {
    writeFileSync(join(carpeta, `${t.nombre}-de-prueba.xlsx`), construirXlsx([t.cabeceras, ...t.filas]))
    writeFileSync(join(carpeta, `${t.nombre}-de-prueba.csv`), csv(t.cabeceras, t.filas), 'utf8')
    console.log(`${t.nombre}-de-prueba.xlsx y .csv — ${t.filas.length} ${t.que}`)
  }
  console.log(`Escritos en ${carpeta}.`)
}

export { CAB_CUOTAS, CUOTAS, CAB_CAJA, CAJA, CAB_INVENTARIO, INVENTARIO, csv }
