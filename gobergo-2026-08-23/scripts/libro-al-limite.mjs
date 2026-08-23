#!/usr/bin/env node
/**
 * UN SOLO LIBRO CON TODO, Y GRANDE: para llevar la aplicación al límite.
 *
 *   node scripts/libro-al-limite.mjs [carpeta]
 *
 * Los cuatro archivos de prueba de al lado —censo, cuotas, caja, inventario—
 * son pequeños y sirven para ver que el importador entiende los líos. Este es
 * lo contrario: UN libro con las cuatro pestañas y con el tamaño de una
 * hermandad grande de verdad.
 *
 * POR QUÉ UN SOLO LIBRO. Porque es lo que sale de un programa de gestión
 * viejo: nadie exporta cuatro ficheros, se exporta el libro entero con una
 * pestaña por cosa y luego se sube cuatro veces, una por pantalla. Hasta ahora
 * el lector se quedaba siempre con la primera hoja, así que al importar cuotas
 * desde un libro así decía «faltan columnas obligatorias» mientras miraba el
 * censo — y el archivo era el bueno.
 *
 * QUÉ SE ESTÁ FORZANDO, aparte del volumen:
 *
 *   · Las pestañas NO van en el orden en que se importan, y sus ficheros
 *     internos no son sheet1, sheet2, sheet3: quien lea el libro tiene que
 *     pasar por `workbook.xml` y por el `.rels`, como en un libro de verdad al
 *     que le han borrado y añadido hojas.
 *   · DOS pestañas de cuotas con las MISMAS columnas (dos ejercicios), que es
 *     donde acertar la hoja por las columnas ya no basta y hace falta poder
 *     cambiarla a mano.
 *   · Una pestaña de notas sin nada que importar, para que no se la lleve
 *     ninguna pantalla.
 *   · Y los mismos líos de siempre, pero a escala: DNI repetidos, filas sin
 *     DNI, recibos duplicados, recibos de gente que no está en el censo,
 *     importes con millares y el euro pegado, fechas de tres maneras.
 *
 * Todo sale de una cuenta, no del azar: el archivo es idéntico cada vez que se
 * genera, y por eso los números que tienen que salir se pueden escribir.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { construirLibro, construirXlsx } from './censo-de-prueba.mjs'

/* ---------------------------------------------------------------------------
   Sin azar
   --------------------------------------------------------------------------- */

/**
 * Un generador de números con semilla fija. `Math.random()` daría un archivo
 * distinto cada vez, y entonces «tienen que salir 1.180 hermanos» no se podría
 * afirmar: cada ejecución sería una prueba diferente.
 */
function dado(semilla) {
  let x = semilla
  return (tope) => {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    return x % tope
  }
}

/* ---------------------------------------------------------------------------
   DNI e IBAN de verdad

   Con la letra y el dígito de control BIEN. Inventados a lo loco, el
   importador los marcaría todos como erróneos y la prueba no enseñaría nada
   más que su propia validación.
   --------------------------------------------------------------------------- */

const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const dni = (n) => `${String(n).padStart(8, '0')}${LETRAS[n % 23]}`

/** Resto de dividir un número larguísimo entre 97, a trozos. Un IBAN no cabe en un `number`. */
function mod97(texto) {
  let resto = 0
  for (const c of texto) resto = (resto * 10 + Number(c)) % 97
  return resto
}

/** Un IBAN español con su dígito de control correcto. */
function iban(banco, sucursal, cuenta) {
  const dc = String(98 - mod97(`${banco}${sucursal}00${cuenta}142800`)).padStart(2, '0')
  return `ES${dc}${banco}${sucursal}00${cuenta}`
}

/* ---------------------------------------------------------------------------
   Los nombres

   Combinando apellidos y nombres se llega a mil doscientas personas sin
   repetir ninguna y sin una lista de mil doscientas líneas.
   --------------------------------------------------------------------------- */

const APELLIDOS = [
  'Aguilar', 'Bermúdez', 'Cordero', 'Delgado', 'Espinosa', 'Fernández', 'Gálvez', 'Herrera',
  'Ibáñez', 'Jiménez', 'Lozano', 'Marín', 'Núñez', 'Ochoa', 'Peláez', 'Quintana', 'Rodríguez',
  'Santos', 'Trujillo', 'Utrera', 'Vázquez', 'Zamora', 'Cañete', 'Muñoz', 'Peñalver',
]
const SEGUNDOS = [
  'Ponce', 'Cano', 'Rueda', 'Nieto', 'Gil', 'Ojeda', 'Cruz', 'Pavón', 'Vega', 'Ceballos',
  'Roldán', 'Salas', 'Bravo', 'Toledo', 'Ríos', 'Yuste', 'Ibarra', 'Alcalá',
]
const NOMBRES = [
  'María del Carmen', 'José Antonio', 'Ana Isabel', 'Francisco Javier', 'Rocío', 'Manuel',
  'Inmaculada', 'Álvaro', 'Nuria', 'Sergio', 'Beatriz', 'Juan Luis', 'Lucía', 'Ángel',
  'Macarena', 'Íñigo', 'Esperanza', 'Rafael', 'Consolación', 'Jesús',
]

/* ---------------------------------------------------------------------------
   1. El censo
   --------------------------------------------------------------------------- */

const CAB_CENSO = [
  'Nº Hermano', 'Apellidos y nombre', 'D.N.I.', 'Fecha de alta', 'Fecha nacimiento',
  'Correo', 'Teléfono móvil', 'Domicilio', 'Nº de cuenta', '¿Está de baja?',
]

/** Cuántos hermanos. Una hermandad grande de Sevilla anda por aquí. */
export const CUANTOS_HERMANOS = 1200

function construirCenso() {
  const d = dado(20260823)
  const filas = []
  const dnis = []

  for (let i = 0; i < CUANTOS_HERMANOS; i++) {
    const numero = i + 1
    const nombre = `${APELLIDOS[i % APELLIDOS.length]} ${SEGUNDOS[(i * 7) % SEGUNDOS.length]}, ${NOMBRES[(i * 11) % NOMBRES.length]}`
    const documento = dni(10000000 + i * 37)
    dnis.push(documento)

    // El año de alta reparte a los hermanos por antigüedad: así se ven los seis
    // modelos de carné (bodas de diamante, de oro, de plata, veterano…) y no
    // solo el de siempre.
    const alta = 1948 + ((i * 13) % 78)

    /*
     * LA FECHA DE ALTA, ESCRITA DE TRES MANERAS. En una hoja de verdad
     * conviven: el año a secas de las fichas viejas, la fecha española de las
     * de en medio, y la ISO de lo que salió de un programa.
     */
    const comoSeEscribe = i % 3 === 0 ? String(alta)
      : i % 3 === 1 ? `01/09/${alta}`
      : `${alta}-09-01`

    const nacimiento = `${String(1 + d(28)).padStart(2, '0')}/${String(1 + d(12)).padStart(2, '0')}/${1935 + ((i * 17) % 75)}`

    /*
     * Uno de cada cuatro sin IBAN, y de los que lo tienen, uno de cada cinco
     * CON ESPACIOS, que es como se copia de la libreta. Sin IBAN no se
     * domicilia: es lo que hace que la remesa no salga con el censo entero.
     */
    const conCuenta = i % 4 !== 0
    const bruto = iban('2100', '0418', String(4502000513 + i * 3).padStart(10, '0'))
    const cuenta = !conCuenta ? ''
      : i % 5 === 0 ? bruto.replace(/(.{4})/g, '$1 ').trim()
      : bruto

    // Uno de cada veinticinco de baja. La columna dice «Sí/No» a la pregunta
    // «¿está de baja?», que significa lo contrario que «activo».
    const baja = i % 25 === 24 ? 'Sí' : 'No'

    filas.push([
      String(numero), nombre, documento, comoSeEscribe, nacimiento,
      `${documento.slice(0, 8)}@ejemplo.es`,
      `6${String(10000000 + i * 613).slice(0, 8)}`,
      `C/ ${SEGUNDOS[(i * 5) % SEGUNDOS.length]}, ${1 + (i % 90)}`,
      cuenta, baja,
    ])
  }

  /*
   * --- Y AHORA LOS LÍOS, que son el motivo de la prueba ---
   * Van al final para que se vea que el importador los caza estén donde estén,
   * y que dice EN QUÉ FILA está la otra copia.
   */
  const repetidos = []
  for (let k = 0; k < 12; k++) {
    const origen = filas[k * 83]
    repetidos.push([`${9000 + k}`, origen[1], origen[2], '2020', origen[4], origen[5], origen[6], origen[7], '', 'No'])
  }
  const sinDni = Array.from({ length: 3 }, (_, k) => [
    `${9500 + k}`, `Sin Documento ${k + 1}, Prueba`, '', '2019', '01/01/1970',
    `sindni${k}@ejemplo.es`, '600000000', 'C/ Prueba, 1', '', 'No',
  ])
  const sinNombre = Array.from({ length: 2 }, (_, k) => [
    `${9700 + k}`, '', dni(99000000 + k), '2018', '01/01/1971',
    `sinnombre${k}@ejemplo.es`, '600000001', 'C/ Prueba, 2', '', 'No',
  ])

  return { cabeceras: CAB_CENSO, filas: [...filas, ...repetidos, ...sinDni, ...sinNombre], dnis }
}

/* ---------------------------------------------------------------------------
   2. Las cuotas — dos ejercicios, en dos pestañas con las MISMAS columnas
   --------------------------------------------------------------------------- */

const CAB_CUOTAS = ['D.N.I.', 'Apellidos y nombre', 'Ejercicio', 'Concepto', 'Importe', 'Estado', 'Fecha de pago', 'Forma de pago']

function construirCuotas(censo, ejercicio, semilla, conLios) {
  const d = dado(semilla)
  const filas = []
  // No a todo el censo: en una hermandad real siempre hay altas de mitad de
  // año y bajas, así que el histórico nunca cuadra con el censo de hoy.
  const hasta = Math.floor(CUANTOS_HERMANOS * 0.92)

  for (let i = 0; i < hasta; i++) {
    const fila = censo.filas[i]
    const pagada = d(10) < 8
    /*
     * IMPORTES CON MILLARES Y EL EURO PEGADO. Es donde se equivoca todo el
     * mundo al leer una hoja ajena: «1.234,56 €» leído a la inglesa son
     * 1,23456 euros, y nadie lo nota hasta que no cuadra la caja.
     */
    const importe = i % 50 === 0 ? '1.250,00 €' : i % 7 === 0 ? '45,50 €' : '60,00 €'
    filas.push([
      fila[2], fila[1], String(ejercicio), 'Cuota anual', importe,
      pagada ? 'Pagada' : 'Pendiente',
      pagada ? `15/02/${ejercicio}` : '',
      fila[8] ? 'Domiciliación' : 'Transferencia',
    ])
  }

  if (!conLios) return { cabeceras: CAB_CUOTAS, filas }

  // Recibos repetidos: mismo hermano, mismo año, mismo concepto. Eso es un
  // cobro doble, y es el error más caro de todos los que trae una hoja.
  const repetidos = Array.from({ length: 25 }, (_, k) => [...filas[k * 31]])
  // Recibos de gente que no está en el censo: bajas de hace años que el
  // programa viejo seguía arrastrando.
  const fantasmas = Array.from({ length: 8 }, (_, k) => [
    dni(88000000 + k), `Fantasma ${k + 1}, Recibo`, String(ejercicio), 'Cuota anual',
    '60,00 €', 'Pendiente', '', 'Domiciliación',
  ])
  // Y filas sin ejercicio ni fecha: no se sabe de qué año son.
  const sinAnio = Array.from({ length: 5 }, (_, k) => [
    censo.filas[k * 97][2], censo.filas[k * 97][1], '', 'Cuota anual', '60,00 €', 'Pendiente', '', 'Efectivo',
  ])

  return { cabeceras: CAB_CUOTAS, filas: [...filas, ...repetidos, ...fantasmas, ...sinAnio] }
}

/* ---------------------------------------------------------------------------
   3. El libro de caja
   --------------------------------------------------------------------------- */

const CAB_CAJA = ['Fecha', 'Concepto', 'Partida', 'Entradas', 'Salidas', 'Cuenta']

/*
 * Las partidas SON LAS DEL CATÁLOGO DE FÁBRICA, copiadas de
 * `src/data/movimientos.ts`. Si fueran inventadas, las 1.500 filas saldrían
 * con un aviso de «categoría desconocida» cada una y el aviso dejaría de
 * significar nada: lo que se quiere probar aquí es el volumen, no la
 * traducción de categorías. Para eso está la de abajo, que es la única que
 * está mal a propósito.
 */
const PARTIDAS_ENTRADA = [
  'Cuotas Hermanos/as', 'Donativos, Ofrendas y Cepillos', 'Subvenciones', 'Otros ingresos',
]
const PARTIDAS_SALIDA = [
  'Mantenimiento', 'Secretaría', 'Cultos Internos', 'Cultos Externos',
  'Obras Benéficas y Sociales', 'Restauraciones', 'Nuevas Adquisiciones', 'Gastos varios menores',
]

/** Cuántos apuntes. Tres ejercicios de una hermandad que mueve dinero. */
export const CUANTOS_APUNTES = 1500

function construirCaja() {
  const d = dado(31415926)
  const filas = []
  for (let i = 0; i < CUANTOS_APUNTES; i++) {
    const anio = 2024 + Math.floor(i / 500)
    const fecha = `${String(1 + d(28)).padStart(2, '0')}/${String(1 + d(12)).padStart(2, '0')}/${anio}`
    const esEntrada = i % 3 === 0
    /*
     * ENTRADAS Y SALIDAS EN DOS COLUMNAS, que es como se lleva un libro de
     * caja de toda la vida. Si el importador se equivoca de columna, el saldo
     * sale con el signo cambiado — y eso se ve en el aviso del ensayo antes de
     * importar nada.
     */
    const cantidad = `${(50 + d(4000)).toLocaleString('es-ES')},${String(d(100)).padStart(2, '0')} €`
    // Una de cada cuarenta con una partida que no está en el catálogo: no se
    // pierde, va a «otros» y se avisa.
    const partida = i % 40 === 39 ? 'Traslados'
      : esEntrada ? PARTIDAS_ENTRADA[i % PARTIDAS_ENTRADA.length]
      : PARTIDAS_SALIDA[i % PARTIDAS_SALIDA.length]
    filas.push([
      fecha,
      `${esEntrada ? 'Ingreso' : 'Pago'} nº ${i + 1} · ${partida}`,
      partida,
      esEntrada ? cantidad : '',
      esEntrada ? '' : cantidad,
      i % 2 === 0 ? 'Cuenta corriente' : 'Caja',
    ])
  }
  return { cabeceras: CAB_CAJA, filas }
}

/* ---------------------------------------------------------------------------
   4. El inventario
   --------------------------------------------------------------------------- */

const CAB_INVENTARIO = ['Pieza', 'Tipo', 'Ubicación', 'Estado de conservación', 'Valor asegurado', 'Prestado a', 'Año de alta', 'Observaciones']

const PIEZAS = [
  'Candelabro de cola', 'Bambalina', 'Faldón', 'Varal', 'Jarra de metal', 'Insignia', 'Bocina',
  'Túnica de nazareno', 'Cirial', 'Manigueta', 'Respiradero', 'Llamador', 'Canasto', 'Palio',
]
/* Igual que con las partidas: las categorías son las de fábrica
   (`src/data/enseres.ts`), menos «Bordado», que va a propósito para ver el
   aviso de categoría que no está en el catálogo. */
const TIPOS = ['Orfebrería', 'Textil', 'Enser de culto', 'Túnica', 'Mobiliario', 'Bordado']

/** Cuántas piezas de patrimonio. */
export const CUANTAS_PIEZAS = 400

function construirInventario() {
  const d = dado(27182818)
  const filas = []
  for (let i = 0; i < CUANTAS_PIEZAS; i++) {
    /*
     * Una de cada quince SIN VALOR ASEGURADO, y eso NO es una pieza de cero
     * euros: es una pieza que no se ha tasado. Meterla como 0 € la borra de la
     * suma del seguro sin que nadie se entere.
     */
    const sinTasar = i % 15 === 14
    filas.push([
      `${PIEZAS[i % PIEZAS.length]} nº ${i + 1}`,
      TIPOS[(i * 5) % TIPOS.length],
      i % 4 === 0 ? 'Casa de hermandad' : 'Capilla',
      // Los tres estados que la aplicación conoce, más «A restaurar» —que no
      // es ninguno de ellos— para ver que se traduce y se avisa en vez de
      // rechazarse.
      ['Bueno', 'Regular', 'Necesita restauración', i % 40 === 3 ? 'A restaurar' : 'Bueno'][i % 4],
      sinTasar ? '' : `${(200 + d(9000)).toLocaleString('es-ES')},00 €`,
      i % 30 === 29 ? 'Hermandad de la Vera-Cruz' : '',
      String(1960 + ((i * 7) % 66)),
      sinTasar ? 'Pendiente de tasación' : '',
    ])
  }
  return { cabeceras: CAB_INVENTARIO, filas }
}

/* ---------------------------------------------------------------------------
   El libro
   --------------------------------------------------------------------------- */

export function construirTodo() {
  const censo = construirCenso()
  const cuotas2026 = construirCuotas(censo, 2026, 161803398, true)
  const cuotas2025 = construirCuotas(censo, 2025, 141421356, false)
  const caja = construirCaja()
  const inventario = construirInventario()

  /*
   * EL ORDEN DE LAS PESTAÑAS NO ES EL DE IMPORTACIÓN, y es a propósito.
   *
   * El censo va el tercero. Leyendo «la primera hoja», importar el censo desde
   * este libro cogería el inventario y diría que faltan columnas — sin que
   * nada apunte a que el problema es la pestaña.
   *
   * Y la primera es una hoja de notas sin datos, que es lo que suelen dejar
   * los programas viejos delante de todo.
   */
  return [
    { nombre: 'Portada', filas: [['Hermandad de prueba'], ['Exportación completa'], ['Generado para probar Gobergo']] },
    { nombre: 'Bienes', cabeceras: inventario.cabeceras, filas: inventario.filas },
    { nombre: 'Socios', cabeceras: censo.cabeceras, filas: censo.filas },
    { nombre: 'Recibos 2026', cabeceras: cuotas2026.cabeceras, filas: cuotas2026.filas },
    { nombre: 'Recibos 2025', cabeceras: cuotas2025.cabeceras, filas: cuotas2025.filas },
    { nombre: 'Libro de caja', cabeceras: caja.cabeceras, filas: caja.filas },
  ]
}

/**
 * LOS MISMOS DATOS, PERO UN FICHERO POR TABLA Y CON SU HOJA LA PRIMERA.
 *
 * Existe por una razón concreta: el libro de varias pestañas solo lo entiende
 * la versión que sabe elegir hoja, y una hermandad que aún no ha actualizado
 * se queda mirando un cajón con todas las columnas en «no está en el archivo»
 * —que es exactamente lo que parece un programa roto—. Estos cuatro los lee
 * cualquier versión, porque no hay ninguna pestaña que elegir.
 */
const SUELTOS = {
  'censo-al-limite.xlsx': 'Socios',
  'cuotas-al-limite.xlsx': 'Recibos 2026',
  'caja-al-limite.xlsx': 'Libro de caja',
  'inventario-al-limite.xlsx': 'Bienes',
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const carpeta = process.argv[2] || '.'
  mkdirSync(carpeta, { recursive: true })

  const partes = construirTodo()
  const hojas = partes.map((p) => ({
    nombre: p.nombre,
    filas: p.cabeceras ? [p.cabeceras, ...p.filas] : p.filas,
  }))

  const destino = join(carpeta, 'hermandad-al-limite.xlsx')
  const bytes = construirLibro(hojas)
  writeFileSync(destino, bytes)
  console.log(`Escrito ${destino} — ${(bytes.length / 1024).toFixed(0)} KB`)
  for (const h of hojas) {
    console.log(`  · «${h.nombre}»: ${Math.max(0, h.filas.length - 1)} filas`)
  }

  console.log('\nY los mismos datos, uno por tabla, para cualquier versión:')
  for (const [fichero, pestana] of Object.entries(SUELTOS)) {
    const hoja = hojas.find((h) => h.nombre === pestana)
    const solo = construirXlsx(hoja.filas, hoja.nombre)
    writeFileSync(join(carpeta, fichero), solo)
    console.log(`  · ${fichero} — «${hoja.nombre}», ${hoja.filas.length - 1} filas, ${(solo.length / 1024).toFixed(0)} KB`)
  }
}
