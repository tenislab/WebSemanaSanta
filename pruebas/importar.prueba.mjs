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
  // Sin año, el que corre; y el estado se deduce.
  const sinAnio = m.ensayar([cab, ['Nuevo Hermano', '33333333D', '', '']], empN, [], 2026)
  caso('sin año, el año en curso', 2026, sinAnio.filas[0].datos.antiguedad)
  caso('y entonces es «Nuevo»', 'Nuevo', sinAnio.filas[0].datos.estado)
  const viejo = m.ensayar([cab, ['Antiguo', '44444444E', '', '1990']], empN, [], 2026)
  caso('con año antiguo, es «Activo»', 'Activo', viejo.filas[0].datos.estado)

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
}
