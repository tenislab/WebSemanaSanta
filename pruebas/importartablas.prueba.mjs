/**
 * TRAER LO QUE LA HERMANDAD YA TIENE: cuotas, caja e inventario.
 *
 * El importador del censo existía desde el principio, porque sin él nadie
 * teclea mil fichas a mano. Pero el censo no es lo único que se pierde al
 * cambiar de programa. Lo que de verdad no se puede reconstruir es:
 *
 *   · el HISTORIAL DE CUOTAS. Es la memoria de la tesorería. Sin él, el día de
 *     la instalación la hermandad no puede reclamar un impago de hace dos años,
 *     ni decirle a nadie desde cuándo está al corriente, ni cuadrar el cabildo
 *     de cuentas con el del año anterior;
 *   · el LIBRO DE CAJA, que es lo que se presenta en ese cabildo;
 *   · el INVENTARIO, con el valor de seguro de cada pieza.
 *
 * Aquí se prueba lo que puede salir mal y no se vería: recibos que se enganchan
 * al hermano equivocado, un extracto bancario que entra con el signo al revés,
 * un histórico ya cobrado que se convierte en deuda, y una segunda importación
 * del mismo archivo que duplica todo.
 */
export default async function ({ cargar, caso }) {
  const motor = await cargar('src/lib/importarTabla.ts')
  const tablas = await cargar('src/lib/tablasImportables.ts')

  const CENSO = [
    { id: 'h1', dni: '11111111A', nombre: 'Ana Sánchez Pérez', numero: 12 },
    { id: 'h2', dni: '22222222B', nombre: 'Luis Gómez Ruiz', numero: 34 },
    { id: 'h3', dni: '33333333C', nombre: 'Luis Gómez Ruiz', numero: 35 },
  ]
  const CTX = {
    hermanos: CENSO,
    anioEnCurso: 2026,
    categoriasIngreso: ['Cuotas Hermanos/as', 'Donativos, Ofrendas y Cepillos', 'Otros ingresos'],
    categoriasGasto: ['Mantenimiento', 'Cultos Internos', 'Gastos varios menores'],
    cuentas: ['Cuenta bancaria', 'Caja'],
    categoriasEnser: ['Orfebrería', 'Textil', 'Otro'],
  }

  /** Monta el ensayo de un archivo ya partido en filas, emparejando por cabecera. */
  function ensayar(tabla, filas, existentes = []) {
    const emparejado = motor.proponerColumnas(tabla.campos, filas[0])
    return { emparejado, ensayo: motor.ensayarTabla(filas, emparejado, existentes, tabla, CTX) }
  }

  let n = 0
  const idFalso = () => `nuevo-${(n += 1)}`

  /* =========================================================================
     1. Historial de cuotas
     ========================================================================= */
  const CUOTAS = tablas.TABLA_CUOTAS

  {
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Ejercicio', 'Concepto', 'Estado'],
      ['11.111.111-A', '60,00 €', '2024', 'Cuota anual', 'Pagada'],
      ['22222222B', '60', '2024', 'Cuota anual', 'Pendiente'],
    ])
    caso('los dos recibos entran', 2, ensayo.nuevos)
    caso('y ninguno falla', 0, ensayo.errores)
    caso('el DNI con puntos encuentra a su hermano', 'h1', ensayo.filas[0].datos.hermanoId)
    caso('el importe se lee con el euro pegado', 60, ensayo.filas[0].datos.importe)
    caso('y el ejercicio es el de la hoja', 2024, ensayo.filas[0].datos.ejercicio)
  }

  {
    // Por número de hermano, cuando la hoja no trae DNI.
    const { ensayo } = ensayar(CUOTAS, [
      ['Nº de hermano', 'Importe', 'Año'],
      ['34', '45,50', '2023'],
    ])
    caso('el número de hermano también engancha', 'h2', ensayo.filas[0].datos.hermanoId)
  }

  {
    /*
     * DOS HERMANOS QUE SE LLAMAN IGUAL. No se elige uno.
     *
     * Enganchar el recibo al Luis Gómez equivocado es cobrarle a quien no toca,
     * y no se nota hasta que llama por teléfono. Prefiere quedarse fuera y que
     * se vea en la vista previa.
     */
    const { ensayo } = ensayar(CUOTAS, [
      ['Nombre', 'Importe', 'Año'],
      ['Luis Gómez Ruiz', '60', '2024'],
      ['Ana Sanchez Perez', '60', '2024'],
    ])
    caso('con dos que se llaman igual, no se adivina', 'error', ensayo.filas[0].queLePasa)
    caso('y se dice por qué', true, ensayo.filas[0].problemas[0].includes('2 hermanos que se llaman'))
    caso('un nombre único sí engancha, aunque venga sin tildes', 'h1', ensayo.filas[1].datos.hermanoId)
  }

  {
    /*
     * SIN AÑO NO ENTRA, y es a propósito.
     *
     * Toda la pantalla de Cuotas habla de UN ejercicio. Un histórico sin año
     * caería entero en el año en curso, y entonces los recibos de 2019 dirían
     * que este año está pagado: la hermandad dejaría de reclamar a quien debe.
     */
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe'],
      ['11111111A', '60'],
    ])
    caso('sin ejercicio ni fecha, la fila no entra', 'error', ensayo.filas[0].queLePasa)
    caso('y se pide la columna que falta', true, ensayo.filas[0].problemas[0].includes('columna con el año'))
  }

  {
    // El ejercicio se puede deducir de la fecha de emisión.
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Fecha de emisión'],
      ['11111111A', '60', '03/02/2021'],
    ])
    caso('el año sale de la fecha de emisión', 2021, ensayo.filas[0].datos.ejercicio)
  }

  {
    /*
     * EL ESTADO SOLO SI EL ARCHIVO LO DICE.
     *
     * Una hoja sin columna de estado no está diciendo «todo pendiente»: está
     * diciendo que ese dato no lo tiene. Rellenarlo por defecto al ACTUALIZAR
     * convertiría un histórico ya cobrado en deuda, y la hermandad se pondría a
     * reclamar recibos pagados.
     */
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Año'],
      ['11111111A', '60', '2024'],
    ])
    caso('sin columna de estado no se toca el estado', undefined, ensayo.filas[0].datos.estado)

    const conFecha = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Año', 'Fecha de pago'],
      ['11111111A', '60', '2024', '05/03/2024'],
    ])
    caso('pero con fecha de pago queda pagada', 'Pagada', conFecha.ensayo.filas[0].datos.estado)
  }

  {
    /*
     * EL MISMO RECIBO DOS VECES EN EL ARCHIVO. Fuera los dos.
     *
     * Dos recibos del mismo hermano, del mismo ejercicio y del mismo concepto
     * son un cobro doble. Hay que mirar las dos filas para saber cuál vale, así
     * que se avisa en las DOS y no solo en la segunda.
     */
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Año', 'Concepto'],
      ['11111111A', '60', '2024', 'Cuota anual'],
      ['11111111A', '60', '2024', 'Cuota anual'],
    ])
    caso('el repetido no entra', 2, ensayo.errores)
    caso('y la primera fila también avisa', true, ensayo.filas[0].problemas[0].includes('fila 3'))
    caso('y la segunda señala a la primera', true, ensayo.filas[1].problemas[0].includes('fila 2'))
  }

  {
    // Distinto concepto no es el mismo recibo.
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Año', 'Concepto'],
      ['11111111A', '60', '2024', 'Cuota anual'],
      ['11111111A', '20', '2024', 'Extraordinaria'],
    ])
    caso('dos conceptos distintos son dos recibos', 2, ensayo.nuevos)
  }

  {
    /*
     * SUBIR EL MISMO ARCHIVO DOS VECES NO DUPLICA NADA.
     *
     * Es lo que pasa de verdad: se importa, se ve que faltaba una columna, se
     * arregla la hoja y se vuelve a subir entera. Sin reconocer lo que ya está,
     * la hermandad se quedaría con el histórico por duplicado y la deuda de
     * todo el mundo multiplicada por dos.
     */
    const filas = [
      ['DNI', 'Importe', 'Año', 'Concepto', 'Estado'],
      ['11111111A', '60', '2024', 'Cuota anual', 'Pagada'],
      ['22222222B', '60', '2024', 'Cuota anual', 'Pendiente'],
    ]
    const primera = ensayar(CUOTAS, filas)
    const puestas = motor.aplicarTabla(primera.ensayo, [], CUOTAS, { conLosQueYaEstan: 'actualizar' }, idFalso)
    caso('la primera vez entran dos', 2, puestas.creados)

    const segunda = ensayar(CUOTAS, filas, puestas.lista)
    caso('la segunda vez no entra ninguno nuevo', 0, segunda.ensayo.nuevos)
    caso('sino que se reconocen los dos', 2, segunda.ensayo.actualizados)
    const otraVez = motor.aplicarTabla(segunda.ensayo, puestas.lista, CUOTAS, { conLosQueYaEstan: 'actualizar' }, idFalso)
    caso('y la lista sigue teniendo dos recibos', 2, otraVez.lista.length)
  }

  {
    // Los recibos creados llevan número correlativo a partir del último.
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Año'],
      ['11111111A', '60', '2024'],
      ['22222222B', '60', '2024'],
    ])
    const yaHabia = [{ id: 'v1', numero: 1041, hermanoId: 'h3', concepto: 'Otra', importe: 10, estado: 'Pagada', ejercicio: 2020, fechaEmision: '01 ene 2020', fechaCobro: '01 ene 2020', domiciliada: false }]
    const r = motor.aplicarTabla(ensayo, yaHabia, CUOTAS, { conLosQueYaEstan: 'actualizar' }, idFalso)
    caso('el primero sigue al último número', 1042, r.lista[1].numero)
    caso('y el segundo detrás', 1043, r.lista[2].numero)
  }

  {
    /*
     * EL AVISO QUE EVITA UN COBRO REAL.
     *
     * Un recibo histórico que entra «pendiente» y «domiciliado» es un recibo
     * que sale en la próxima remesa SEPA: un cargo de verdad en la cuenta de un
     * hermano que ya pagó hace tres años. Se dice ANTES de importar.
     */
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Año', 'Estado', 'Forma de pago'],
      ['11111111A', '60', '2022', 'Pendiente', 'Domiciliación'],
    ])
    caso('avisa de que saldrá en la remesa', true, ensayo.avisos.some((a) => a.includes('remesa al banco')))
  }

  /* =========================================================================
     2. Libro de caja
     ========================================================================= */
  const MOVS = tablas.TABLA_MOVIMIENTOS

  {
    /*
     * EL EXTRACTO DEL BANCO: una columna con el signo. Los negativos son gastos.
     */
    const { ensayo } = ensayar(MOVS, [
      ['Fecha', 'Concepto', 'Importe'],
      ['05/01/2026', 'Cuotas de enero', '1.240,00'],
      ['12/01/2026', 'Recibo de la luz', '-186,40'],
    ])
    caso('lo positivo es ingreso', 'Ingreso', ensayo.filas[0].datos.tipo)
    caso('lo negativo es gasto', 'Gasto', ensayo.filas[1].datos.tipo)
    // Dentro se guarda SIEMPRE positivo y el signo lo lleva `tipo`, como hace
    // la pantalla de Tesorería al crear un apunte a mano. Mezclar las dos
    // convenciones descuadraría el saldo sin que se viera.
    caso('el gasto se guarda en positivo', 186.4, ensayo.filas[1].datos.importe)
  }

  {
    // El libro de caja de toda la vida: entradas y salidas en dos columnas.
    const { ensayo } = ensayar(MOVS, [
      ['Fecha', 'Concepto', 'Entradas', 'Salidas'],
      ['05/01/2026', 'Donativo', '300,00', ''],
      ['12/01/2026', 'Flores del altar', '', '420,00'],
    ])
    caso('la columna de entradas es ingreso', 'Ingreso', ensayo.filas[0].datos.tipo)
    caso('la de salidas es gasto', 'Gasto', ensayo.filas[1].datos.tipo)
    caso('y el importe sale de la columna que toca', 420, ensayo.filas[1].datos.importe)
  }

  {
    // Y la tercera forma: importe sin signo más una columna que dice qué es.
    const { ensayo } = ensayar(MOVS, [
      ['Fecha', 'Concepto', 'Importe', 'Tipo'],
      ['05/01/2026', 'Seguro', '275', 'Gasto'],
    ])
    caso('la columna de tipo manda sobre el signo', 'Gasto', ensayo.filas[0].datos.tipo)
  }

  {
    /*
     * EL CUADRE, ANTES DE IMPORTAR.
     *
     * Es lo primero que mira un tesorero y lo que delata que el signo se ha
     * leído al revés: si el archivo entero entra como ingresos, se ve aquí y no
     * después de haber metido setecientos apuntes.
     */
    const { ensayo } = ensayar(MOVS, [
      ['Fecha', 'Concepto', 'Importe'],
      ['05/01/2026', 'Cuotas', '1.000,00'],
      ['12/01/2026', 'Luz', '-200,00'],
    ])
    // El importe va escrito en español (1.234,56 €), como en toda la aplicación:
    // en la pantalla que existe justo para leer bien el dinero, enseñarlo a la
    // inglesa es la peor forma de perder la confianza de quien lo repasa.
    caso('el cuadre sale en los avisos', true, /Saldo: 800,00/.test(ensayo.avisos[0]))
    caso('y con un ingreso solo, concuerda', true, ensayo.avisos[0].startsWith('Entran 1 ingreso por'))
  }

  {
    // La categoría se empareja con el catálogo de la hermandad, y lo que no
    // cuadra se avisa: del catálogo cuelga el Estado de Cuentas del cabildo.
    const { ensayo } = ensayar(MOVS, [
      ['Fecha', 'Concepto', 'Importe', 'Categoría'],
      ['12/01/2026', 'Luz de la casa', '-186,40', 'mantenimiento'],
      ['15/01/2026', 'Autobús del traslado', '-90,00', 'Traslados'],
    ])
    caso('la categoría conocida se reconoce', 'Mantenimiento', ensayo.filas[0].datos.categoria)
    caso('la desconocida cae en la de otros', 'Gastos varios menores', ensayo.filas[1].datos.categoria)
    caso('y se avisa de que ha caído ahí', true, ensayo.avisos.some((a) => a.includes('«Traslados» no está en vuestro catálogo')))
  }

  {
    /*
     * VOLVER A SUBIR UN EXTRACTO QUE SE SOLAPA.
     *
     * Se descarga el extracto de enero, se importa; en febrero se descarga el
     * del trimestre, que trae enero otra vez. Sin reconocer lo repetido, la caja
     * se duplica. Con él, solo entran los apuntes nuevos.
     */
    const enero = [
      ['Fecha', 'Concepto', 'Importe'],
      ['05/01/2026', 'Cuotas de enero', '1.240,00'],
    ]
    const primera = ensayar(MOVS, enero)
    const puestos = motor.aplicarTabla(primera.ensayo, [], MOVS, { conLosQueYaEstan: 'actualizar' }, idFalso)

    const trimestre = [
      ['Fecha', 'Concepto', 'Importe'],
      ['05/01/2026', 'Cuotas de enero', '1.240,00'],
      ['05/02/2026', 'Cuotas de febrero', '1.180,00'],
    ]
    const segunda = ensayar(MOVS, trimestre, puestos.lista)
    caso('el apunte de enero ya estaba', 1, segunda.ensayo.actualizados)
    caso('y solo entra el de febrero', 1, segunda.ensayo.nuevos)
  }

  {
    // Un libro que se importa es un libro ya cuadrado: entra conciliado, para
    // que «por conciliar» siga significando algo el primer día.
    const { ensayo } = ensayar(MOVS, [
      ['Fecha', 'Concepto', 'Importe'],
      ['05/01/2026', 'Cuotas', '1.000,00'],
    ])
    const r = motor.aplicarTabla(ensayo, [], MOVS, { conLosQueYaEstan: 'actualizar' }, idFalso)
    caso('entra conciliado', 'Conciliado', r.lista[0].estado)
  }

  {
    const { ensayo } = ensayar(MOVS, [
      ['Fecha', 'Concepto', 'Importe'],
      ['no se entiende', 'Algo', '100'],
      ['05/01/2026', '', '100'],
      ['05/01/2026', 'Algo', 'sin cargo'],
    ])
    caso('sin fecha buena no entra', 'error', ensayo.filas[0].queLePasa)
    caso('sin concepto tampoco', 'error', ensayo.filas[1].queLePasa)
    caso('y sin importe menos', 'error', ensayo.filas[2].queLePasa)
  }

  /* =========================================================================
     3. Inventario
     ========================================================================= */
  const ENSERES = tablas.TABLA_ENSERES

  {
    const { ensayo } = ensayar(ENSERES, [
      ['Pieza', 'Categoría', 'Ubicación', 'Estado', 'Valor asegurado'],
      ['Cruz de guía de plata', 'Orfebrería', 'Sala capitular', 'Bueno', '18.000,00'],
      ['Banco de la presidencia', 'Mobiliario', 'Almacén', 'regular', ''],
    ])
    caso('las dos piezas entran', 2, ensayo.nuevos)
    caso('el valor se lee con millares', 18000, ensayo.filas[0].datos.valorAsegurado)
    caso('el estado en minúscula se entiende', 'Regular', ensayo.filas[1].datos.estadoConservacion)
    /*
     * SIN VALOR NO ES CERO EUROS: es que no está asegurada.
     *
     * Guardarlo como 0 la metería en el total asegurado como una pieza de cero
     * euros, y el total del seguro es justo lo que se le enseña a la compañía.
     */
    const r = motor.aplicarTabla(ensayo, [], ENSERES, { conLosQueYaEstan: 'actualizar' }, idFalso)
    caso('sin valor queda sin asegurar, no en cero', null, r.lista[1].valorAsegurado)
    caso('y la categoría de fuera del catálogo se respeta', 'Mobiliario', r.lista[1].categoria)
  }

  {
    // Pero se avisa, porque hasta que no esté en el catálogo no sale en los filtros.
    const { ensayo } = ensayar(ENSERES, [
      ['Pieza', 'Categoría'],
      ['Banco de la presidencia', 'Mobiliario'],
    ])
    caso('avisa de la categoría que falta en el catálogo', true, ensayo.avisos.some((a) => a.includes('Mobiliario')))
  }

  {
    // La misma pieza otra vez se reconoce por el nombre, escrito como se escriba.
    const yaHabia = [{
      id: 'e1', numero: 1, nombre: 'Cruz de guía de plata', categoria: 'Orfebrería', ubicacion: 'Sala capitular',
      estadoConservacion: 'Bueno', valorAsegurado: 18000, prestadoA: null, fechaAlta: '1998', notas: '',
    }]
    const { ensayo } = ensayar(ENSERES, [
      ['Pieza', 'Ubicación'],
      ['CRUZ DE GUIA DE PLATA', 'Camarín'],
    ], yaHabia)
    caso('la pieza que ya estaba se reconoce', 1, ensayo.actualizados)

    const r = motor.aplicarTabla(ensayo, yaHabia, ENSERES, { conLosQueYaEstan: 'actualizar' }, idFalso)
    caso('se le actualiza lo que trae la hoja', 'Camarín', r.lista[0].ubicacion)
    /*
     * Y NO SE LE BORRA LO QUE LA HOJA NO TRAE.
     *
     * Es la regla que aprendió a golpes el importador del censo: una columna
     * que no está no es una orden de vaciar el dato. Aquí sería tirar el valor
     * de seguro de toda la orfebrería por subir una hoja de ubicaciones.
     */
    caso('y no se le borra el valor de seguro', 18000, r.lista[0].valorAsegurado)
    caso('ni su número de inventario', 1, r.lista[0].numero)
  }

  {
    // «Dejarlos como están» no toca lo que ya hay.
    const yaHabia = [{
      id: 'e1', numero: 1, nombre: 'Cruz de guía de plata', categoria: 'Orfebrería', ubicacion: 'Sala capitular',
      estadoConservacion: 'Bueno', valorAsegurado: 18000, prestadoA: null, fechaAlta: '1998', notas: '',
    }]
    const { ensayo } = ensayar(ENSERES, [
      ['Pieza', 'Ubicación'],
      ['Cruz de guía de plata', 'Camarín'],
    ], yaHabia)
    const r = motor.aplicarTabla(ensayo, yaHabia, ENSERES, { conLosQueYaEstan: 'saltar' }, idFalso)
    caso('saltando, la pieza se queda igual', 'Sala capitular', r.lista[0].ubicacion)
    caso('y no se actualiza nada', 0, r.actualizados)
  }

  {
    // Sin nombre no hay pieza.
    const { ensayo } = ensayar(ENSERES, [
      ['Pieza', 'Ubicación'],
      ['', 'Almacén'],
    ])
    caso('sin nombre, la fila no entra', 'error', ensayo.filas[0].queLePasa)
  }

  /* =========================================================================
     4. Lo que la pantalla no deja hacer
     ========================================================================= */
  {
    // Una hoja de cuotas que no dice de qué hermano es no se puede importar, por
    // muchos importes que traiga: los recibos huérfanos no salen en ninguna
    // ficha, no cuentan para la deuda y hacen parecer llena una tesorería vacía.
    const emparejado = motor.proponerColumnas(CUOTAS.campos, ['Importe', 'Año'])
    caso('sin columna de hermano no se deja avanzar', true, (CUOTAS.faltaAlgo(emparejado) ?? '').includes('de qué hermano'))

    const conDni = motor.proponerColumnas(CUOTAS.campos, ['DNI', 'Importe', 'Año'])
    caso('con el DNI ya se puede', null, CUOTAS.faltaAlgo(conDni))
  }

  {
    // Y un libro de caja sin ninguna columna de dinero tampoco.
    const emparejado = motor.proponerColumnas(MOVS.campos, ['Fecha', 'Concepto'])
    caso('sin importe ni entradas/salidas no se deja avanzar', true, (MOVS.faltaAlgo(emparejado) ?? '').includes('importe'))
  }

  {
    // Los campos imprescindibles se comprueban solos.
    const emparejado = motor.proponerColumnas(ENSERES.campos, ['Ubicación'])
    caso('sin el nombre de la pieza falta un campo', 1, motor.faltanColumnas(ENSERES.campos, emparejado).length)
  }

  {
    // Las filas con problemas se pueden descargar para corregirlas.
    const { ensayo } = ensayar(CUOTAS, [
      ['DNI', 'Importe', 'Año'],
      ['99999999Z', '60', '2024'],
    ])
    const csv = motor.csvDeProblemas(ensayo, ['DNI', 'Importe', 'Año'])
    caso('el CSV de problemas lleva la fila y el motivo', true, csv.includes('99999999Z') && csv.includes('No hay ningún hermano'))
  }
}
