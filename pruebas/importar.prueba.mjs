/** P1: traer el censo que la hermandad ya tiene. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/importar.ts')

  // --- Detectar el separador ---
  // En España Excel suelta punto y coma; medio mundo exporta con coma.
  caso('punto y coma', ';', m.detectarSeparador('a;b;c\n1;2;3'))
  caso('coma', ',', m.detectarSeparador('a,b,c\n1,2,3'))
  caso('tabulador', '\t', m.detectarSeparador('a\tb\tc'))
  // Las comas de dentro de un nombre entrecomillado no separan nada.
  caso('las comas dentro de comillas no cuentan', ';',
    m.detectarSeparador('nombre;dni\n"Pérez, Ana";123'))

  // --- Leer el CSV ---
  const simple = m.leerCsv('nombre;dni\nAna;111\nLuis;222')
  caso('tres filas con cabecera', 3, simple.length)
  caso('y dos columnas', 2, simple[0].length)
  caso('con su contenido', 'Ana', simple[1][0])
  // Comillas, separadores dentro y saltos de línea dentro de una celda.
  const dificil = m.leerCsv('nombre;direccion\n"Pérez, Ana";"C/ Betis, 21\n2º B"\nLuis;Calle')
  caso('la coma de dentro no parte la celda', 'Pérez, Ana', dificil[1][0])
  caso('el salto de línea de dentro se conserva', 'C/ Betis, 21\n2º B', dificil[1][1])
  caso('y la fila siguiente sigue entera', 'Luis', dificil[2][0])
  caso('las comillas escapadas', 'Dice "hola"', m.leerCsv('a\n"Dice ""hola"""')[1][0])
  // El BOM de Excel se cuela en el nombre de la primera columna.
  caso('el BOM de Excel no se cuela', 'nombre', m.leerCsv('\uFEFFnombre;dni\nAna;1')[0][0])
  caso('las líneas en blanco del final se ignoran', 2, m.leerCsv('a;b\n1;2\n\n').length)

  // --- Emparejar columnas ---
  const emp = m.proponerEmparejado(['Nº Hermano', 'Nombre y Apellidos', 'D.N.I.', 'Correo', 'Teléfono móvil'])
  caso('reconoce el número', 0, emp.numero)
  caso('reconoce el nombre', 1, emp.nombre)
  caso('reconoce el DNI con puntos', 2, emp.dni)
  caso('reconoce el correo', 3, emp.email)
  caso('reconoce el teléfono aunque ponga «móvil»', 4, emp.telefono)
  caso('lo que no viene, queda sin emparejar', null, emp.iban)
  // El fallo clásico: «numero de cuenta» emparejado con «numero».
  const emp2 = m.proponerEmparejado(['Nombre', 'Numero de cuenta', 'DNI'])
  caso('«numero de cuenta» no se confunde con el número de hermano', null, emp2.numero)
  caso('y se reconoce como IBAN', 1, emp2.iban)
  // Una columna no se puede usar para dos campos.
  const emp3 = m.proponerEmparejado(['Nombre', 'Nombre'])
  caso('una columna no se asigna dos veces', true, emp3.nombre === 0)

  // --- Años y estados, de lo que venga escrito ---
  caso('un año suelto', 1998, m.anioDe('1998'))
  caso('de una fecha española', 1998, m.anioDe('12/03/1998'))
  caso('de una fecha ISO', 1998, m.anioDe('1998-03-12'))
  caso('un año imposible, no', null, m.anioDe('12'))
  caso('vacío, no', null, m.anioDe('  '))
  caso('«activo»', 'Activo', m.estadoDe('Activo'))
  caso('«BAJA» en mayúsculas', 'Baja', m.estadoDe('BAJA'))
  caso('«de baja»', 'Baja', m.estadoDe('de baja'))
  caso('con tilde y todo', 'Baja', m.estadoDe('Bája'))
  caso('lo que no se entiende, null', null, m.estadoDe('regular'))

  // --- El ensayo ---
  const censo = [{ id: 'h1', dni: '12345678A', nombre: 'Ana Sánchez', numero: 89 }]
  const cab = ['Nombre', 'DNI', 'Correo', 'Año']
  const empN = m.proponerEmparejado(cab)
  const filas = [
    cab,
    ['Ana Sánchez del Río', '12.345.678-A', 'ana@correo.es', '1991'],  // ya está → actualiza
    ['Luis Torres', '99999999Z', 'luis@correo.es', '2004'],            // nuevo
    ['', '11111111B', '', '2010'],                                      // sin nombre → error
    ['Sin DNI', '', '', '2010'],                                        // sin DNI → error
    ['Correo malo', '22222222C', 'esto-no-es', '2010'],                 // correo mal → error
  ]
  const e = m.ensayar(filas, empN, censo, 2026)
  caso('cuenta los nuevos', 1, e.nuevos)
  caso('cuenta los que actualiza', 1, e.actualizados)
  caso('cuenta los errores', 3, e.errores)
  // El DNI se compara limpio: con puntos y guiones es el mismo hermano.
  caso('empareja el DNI con puntos y guiones', 'h1', e.filas[0].idExistente)
  caso('dice la línea del archivo', 2, e.filas[0].linea)
  caso('avisa de que falta el nombre', true, e.filas[2].problemas.some((p) => /nombre/i.test(p)))
  caso('avisa de que falta el DNI', true, e.filas[3].problemas.some((p) => /DNI/i.test(p)))
  caso('avisa del correo mal', true, e.filas[4].problemas.some((p) => /correo/i.test(p)))
  // Sin año, el que corre; y el estado se deduce. Eso vive en `paraAlta`, no
  // en `datos`: son valores de relleno para poder dar de alta a quien viene
  // nuevo, y a quien YA ESTÁ no se le pueden aplicar nunca.
  const sinAnio = m.ensayar([cab, ['Nuevo Hermano', '33333333D', '', '']], empN, [], 2026)
  caso('sin año, el año en curso', 2026, sinAnio.filas[0].paraAlta.antiguedad)
  caso('y entonces es «Nuevo»', 'Nuevo', sinAnio.filas[0].paraAlta.estado)
  // Y la casilla vacía NO se escribe: no es una orden, es un dato que no tienen.
  caso('la casilla vacía no se escribe', undefined, sinAnio.filas[0].datos.antiguedad)
  const viejo = m.ensayar([cab, ['Antiguo', '44444444E', '', '1990']], empN, [], 2026)
  caso('con año antiguo, es «Activo»', 'Activo', viejo.filas[0].paraAlta.estado)
  caso('y con el año escrito, sí se guarda', 1990, viejo.filas[0].datos.antiguedad)

  // --- Duplicados DENTRO del archivo ---
  const dup = m.ensayar(
    [cab, ['Ana', '55555555F', '', '2000'], ['Ana otra vez', '5555-5555 F', '', '2001']],
    empN, [], 2026,
  )
  caso('caza el duplicado dentro del archivo', 1, dup.duplicadosEnArchivo.length)
  // Se avisa en LAS DOS filas: hay que mirar las dos para saber cuál vale.
  caso('avisa en la segunda fila', true, dup.filas[1].problemas.some((p) => /repetido/.test(p)))
  caso('y también en la primera', true, dup.filas[0].problemas.some((p) => /repetido/.test(p)))
  caso('ninguna de las dos se importa', 2, dup.errores)

  // --- Aplicar ---
  let n = 0
  const id = () => `nuevo-${++n}`
  const censoCompleto = [{
    id: 'h1', numero: 89, nombre: 'Ana Sánchez', estado: 'Activo', antiguedad: 1991,
    email: 'vieja@correo.es', telefono: '600 000 000', direccion: 'C/ Vieja', cuotaAlDia: true,
    iban: null, dni: '12345678A', claveAcceso: 'x', authUserId: null,
  }]
  const r = m.aplicar(e, censoCompleto, { conLosQueYaEstan: 'actualizar', clavePorDefecto: 'cabildo' }, id)
  caso('crea uno', 1, r.creados)
  caso('actualiza uno', 1, r.actualizados)
  caso('el censo queda con dos', 2, r.censo.length)
  caso('al nuevo se le da el número siguiente', 90, r.censo[1].numero)
  caso('con la contraseña por defecto', 'cabildo', r.censo[1].claveAcceso)
  caso('se actualiza el correo del que ya estaba', 'ana@correo.es', r.censo[0].email)
  // Lo que el archivo NO trae no se borra: la hoja no tenía teléfono.
  caso('lo que no trae el archivo no se borra', '600 000 000', r.censo[0].telefono)
  // Renumerar el censo entero por un Excel es un estropicio.
  caso('el número de quien ya estaba no se toca', 89, r.censo[0].numero)

  // --- El destrozo de la hoja de dos columnas (auditoría 2026-08, CRÍTICO) ---
  //
  // Secretaría saca de otro programa una hoja sencilla, «Nombre;DNI», para
  // repasar los nombres. Esa hoja no trae antigüedad, ni situación, ni cuenta
  // bancaria. Antes de esto, al aplicarla:
  //
  //   - Ana, hermana desde 1991, se quedaba con antigüedad 2026.
  //   - Y con estado «Nuevo», porque se deducía de esa antigüedad inventada.
  //   - Y sin IBAN, porque `iban: dato(...) || null` metía null y null pisaba.
  //
  // En una hermandad la antigüedad ordena el cortejo y da la prioridad de
  // papeleta: se perdía el censo histórico de una tacada. Y sin IBAN el
  // siguiente recibo no se puede cobrar. El resumen decía «1 actualizado».
  const conIban = [{
    id: 'h1', numero: 89, nombre: 'Ana Sánchez', estado: 'Activo', antiguedad: 1991,
    email: 'vieja@correo.es', telefono: '600 000 000', direccion: 'C/ Vieja', cuotaAlDia: true,
    iban: 'ES9121000418450200051332', dni: '12345678A', claveAcceso: 'x', authUserId: null,
  }]
  const cabCorta = ['Nombre', 'DNI']
  const hojaCorta = m.ensayar(
    [cabCorta, ['Ana Sánchez del Río', '12.345.678-A']],
    m.proponerEmparejado(cabCorta),
    conIban,
    2026,
  )
  caso('la hoja corta actualiza a Ana', 1, hojaCorta.actualizados)
  const tras = m.aplicar(hojaCorta, conIban, { conLosQueYaEstan: 'actualizar', clavePorDefecto: 'c' }, () => 'x')
  caso('NO le borra la antigüedad', 1991, tras.censo[0].antiguedad)
  caso('NO la convierte en «Nuevo»', 'Activo', tras.censo[0].estado)
  caso('NO le borra el IBAN', 'ES9121000418450200051332', tras.censo[0].iban)
  caso('pero sí actualiza lo que la hoja SÍ trae', 'Ana Sánchez del Río', tras.censo[0].nombre)

  // Y cuando la hoja SÍ trae esas columnas, se escriben: el arreglo no puede
  // ser «no tocar nunca nada», que sería el error contrario.
  const cabLarga = ['Nombre', 'DNI', 'Antigüedad', 'Estado', 'IBAN']
  const hojaLarga = m.ensayar(
    [cabLarga, ['Ana Sánchez', '12345678A', '1985', 'Baja', 'ES7620770024003102575766']],
    m.proponerEmparejado(cabLarga),
    conIban,
    2026,
  )
  const tras2 = m.aplicar(hojaLarga, conIban, { conLosQueYaEstan: 'actualizar', clavePorDefecto: 'c' }, () => 'x')
  caso('con columna de antigüedad, sí se escribe', 1985, tras2.censo[0].antiguedad)
  caso('con columna de estado, sí se escribe', 'Baja', tras2.censo[0].estado)
  caso('con columna de IBAN, sí se escribe', 'ES7620770024003102575766', tras2.censo[0].iban)

  // Un alta que viene en la hoja corta sí necesita valores: hay que poner algo.
  const alta = m.ensayar([cabCorta, ['Luis Nuevo', '99999999Z']], m.proponerEmparejado(cabCorta), [], 2026)
  const trasAlta = m.aplicar(alta, [], { conLosQueYaEstan: 'actualizar', clavePorDefecto: 'c' }, () => 'n1')
  caso('a quien entra nuevo sí se le pone el año en curso', 2026, trasAlta.censo[0].antiguedad)
  caso('y se le deduce «Nuevo»', 'Nuevo', trasAlta.censo[0].estado)

  // Saltar en vez de actualizar.
  const r2 = m.aplicar(e, censoCompleto, { conLosQueYaEstan: 'saltar', clavePorDefecto: 'c' }, () => 'x')
  caso('con «saltar», no se actualiza a nadie', 0, r2.actualizados)
  caso('pero el nuevo sí entra', 1, r2.creados)
  caso('y el que ya estaba se queda igual', 'vieja@correo.es', r2.censo[0].email)

  // Números: no se pisa uno ocupado, y las bajas quedan fuera de la numeración.
  const conNumeros = m.ensayar(
    [['Nombre', 'DNI', 'Nº', 'Estado'],
     ['Pide el 89', '66666666G', '89', 'Activo'],
     ['Pide el 500', '77777777H', '500', 'Activo'],
     ['De baja', '88888888J', '7', 'Baja']],
    m.proponerEmparejado(['Nombre', 'DNI', 'Nº', 'Estado']), [], 2026,
  )
  const r3 = m.aplicar(conNumeros, censoCompleto, { conLosQueYaEstan: 'actualizar', clavePorDefecto: 'c' }, id)
  caso('el 89 ya está cogido, se le da otro', true, r3.censo[1].numero !== 89)
  caso('el 500 estaba libre, se respeta', 500, r3.censo[2].numero)
  caso('quien entra de baja queda fuera de la numeración', 0, r3.censo[3].numero)
  const nums = r3.censo.filter((h) => h.numero > 0).map((h) => h.numero)
  caso('no hay dos hermanos con el mismo número', nums.length, new Set(nums).size)

  // --- Un Excel subido tal cual ---
  // Un .xlsx es un ZIP y todos empiezan por «PK». Sin esto, quien sube su hoja
  // se encontraba un error incomprensible sobre columnas raras.
  caso('un .xlsx se reconoce', true, m.pareceExcel('PK\u0003\u0004algo'))
  caso('un CSV normal no', false, m.pareceExcel('nombre;dni\nAna;1'))
  caso('un binario se reconoce', true, m.pareceBinario('abc\u0000def'))
  caso('un CSV con tildes no es binario', false, m.pareceBinario('nombre;dni\nÑoño;1'))

  // --- El CSV de las filas malas ---
  const csv = m.csvDeErrores(e, cab)
  caso('lleva cabecera con el motivo', true, csv.split('\n')[0].includes('Qué pasa'))
  caso('una línea por fila mala, más la cabecera', 4, csv.split('\n').length)
  caso('y el contenido original', true, csv.includes('11111111B'))

  await numeroEnLaVistaPrevia({ cargar, caso })
}

/**
 * La vista previa tiene que decir la verdad sobre el número de hermano.
 *
 * El caso: la hoja pide el nº 1 para alguien nuevo, pero el 1 ya es de otro.
 * La vista previa enseñaba «nº 1» y al importar le quedaba el 3. En una
 * hermandad el número es lo más delicado que hay, y no avisaba de nada.
 */
async function numeroEnLaVistaPrevia({ cargar, caso }) {
  const m = await cargar('src/lib/importar.ts')
  const censo = [
    { id: 'h1', numero: 1, nombre: 'Ana', dni: '12345678A' },
    { id: 'h2', numero: 2, nombre: 'Pepe', dni: '11111111A' },
  ]
  const filas = m.leerCsv('Nombre;DNI;Nº hermano\nNuevo Uno;99999999Z;1\n')
  const emp = m.proponerEmparejado(filas[0])
  const ens = m.ensayar(filas, emp, censo, 2026)

  // Lo que enseña la vista previa tiene que ser lo que va a pasar.
  caso('la vista previa no promete un número cogido', false, ens.filas[0].datos.numero === 1)
  caso('enseña el que de verdad le tocará', 3, ens.filas[0].datos.numero)

  // Y lo dice, en vez de cambiarlo por lo bajini.
  caso('avisa de que el número pedido estaba cogido', true, ens.avisos.length === 1)
  caso('y dice de quién era', true, /Ana/.test(ens.avisos[0]))
  caso('y cuál le toca', true, /3/.test(ens.avisos[0]))

  // Lo que enseña la vista previa y lo que hace la importación coinciden.
  const res = m.aplicar(ens, censo, { conLosQueYaEstan: 'saltar', clavePorDefecto: 'k' }, () => 'n1')
  const creado = res.censo.find((h) => h.id === 'n1')
  caso('la importación da el mismo número que enseñó la previa', ens.filas[0].datos.numero, creado.numero)

  // Si el número pedido está libre, se respeta y no se avisa de nada.
  const filas2 = m.leerCsv('Nombre;DNI;Nº hermano\nOtro;88888888B;7\n')
  const ens2 = m.ensayar(filas2, m.proponerEmparejado(filas2[0]), censo, 2026)
  caso('un número libre se respeta', 7, ens2.filas[0].datos.numero)
  caso('y no genera aviso', 0, ens2.avisos.length)

  // A quien YA está en el censo no se le toca el número: renumerar a un
  // hermano de 1985 por lo que ponga una hoja de cálculo sería grave.
  const filas3 = m.leerCsv('Nombre;DNI;Nº hermano\nAna;12345678A;50\n')
  const ens3 = m.ensayar(filas3, m.proponerEmparejado(filas3[0]), censo, 2026)
  caso('a quien ya está no se le reparte número nuevo', 'actualiza', ens3.filas[0].queLePasa)

  // Dos filas nuevas pidiendo el mismo número: la segunda no puede repetirlo.
  const filas4 = m.leerCsv('Nombre;DNI;Nº hermano\nUno;77777777C;9\nDos;66666666D;9\n')
  const ens4 = m.ensayar(filas4, m.proponerEmparejado(filas4[0]), censo, 2026)
  caso('dos filas no se llevan el mismo número', false,
    ens4.filas[0].datos.numero === ens4.filas[1].datos.numero)
}
