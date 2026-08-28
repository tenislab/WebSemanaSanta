/**
 * EL TELÉFONO, EL NIF Y EL CÓDIGO POSTAL, COMPROBADOS.
 *
 * La segunda mitad de «hay que revisar la introducción de datos y caparlo». El
 * DNI ya está; estos tres son los que quedaban, y cada uno rompe una cosa
 * distinta cuando está mal:
 *
 *   · EL TELÉFONO DEL BIZUM sale en la web pública para que la gente pague ahí.
 *     Mal escrito, el donativo no llega y NADIE SE ENTERA. Y Bizum es solo de
 *     móviles: un fijo perfectamente válido ahí no funciona jamás.
 *   · EL NIF va en todas las facturas de la tienda, copiado del mismo sitio.
 *   · EL IDENTIFICADOR DE ACREEDOR va en la cabecera del fichero de adeudos, y
 *     si está mal el banco TUMBA LA REMESA ENTERA, igual que con un IBAN malo.
 *   · EL CÓDIGO POSTAL sale impreso en recibos, facturas y mandatos.
 */
export default async function ({ cargar, caso }) {
  const t = await cargar('src/lib/telefono.ts')
  const n = await cargar('src/lib/nif.ts')

  /*
   * 1. EL TELÉFONO SE GUARDA IGUAL SE ESCRIBA COMO SE ESCRIBA. Si no, el mismo
   * número está dos veces en el censo y la búsqueda por teléfono —la de la
   * tienda, para encontrar una reserva— no encuentra la mitad de las fichas.
   */
  {
    for (const v of ['600123456', '600 12 34 56', '600-12-34-56', '+34600123456',
                     '+34 600 12 34 56', '0034600123456', '(600) 123 456']) {
      caso(`«${v}» se guarda como 600123456`, '600123456', t.normalizarTelefono(v))
    }
    caso('el 00 de salida se pasa a +', '+32470123456', t.limpiarTelefono('0032 470 12 34 56'))
    caso('un número de fuera conserva su prefijo', '+32470123456', t.normalizarTelefono('+32 470 12 34 56'))
    caso('vacío sigue vacío', '', t.normalizarTelefono(''))
  }

  /*
   * 2. QUÉ ES ESPAÑOL Y QUÉ ES UN MÓVIL. La diferencia no es cosmética: de ella
   * depende que el Bizum funcione.
   */
  {
    caso('600 es móvil', true, t.esMovilEspanol('600123456'))
    caso('722 también, desde que se agotaron los 6', true, t.esMovilEspanol('722123456'))
    caso('954 es fijo, no móvil', false, t.esMovilEspanol('954123456'))
    caso('800 es fijo, no móvil', false, t.esMovilEspanol('800123456'))
    caso('pero el fijo sí es un teléfono español', true, t.esTelefonoEspanol('954123456'))
    caso('un 5 no empieza ningún teléfono español', false, t.esTelefonoEspanol('512345678'))
    caso('ocho cifras no son un teléfono de hoy', false, t.esTelefonoEspanol('60012345'))
    caso('el +34 no cambia que sea español', true, t.esMovilEspanol('+34600123456'))
  }

  /*
   * 3. NO SE RECHAZA UN NÚMERO EXTRANJERO. Hay hermanos viviendo fuera, y un
   * +32 de Bruselas es un teléfono perfectamente bueno.
   */
  {
    caso('un belga vale', true, t.telefonoValido('+32470123456'))
    caso('un mexicano vale', true, t.telefonoValido('+525512345678'))
    caso('pero no es «internacional» si es español', false, t.esTelefonoInternacional('+34600123456'))
    caso('siete cifras no son un E.164', false, t.telefonoValido('+3247012'))
    caso('ni dieciséis', false, t.telefonoValido('+3247012345678901'))
  }

  /*
   * 4. LOS MENSAJES DICEN QUÉ HACER. «Teléfono inválido» delante de nueve
   * cifras no ayuda: al que le falta una cifra y al que le sobra el prefijo se
   * les arregla de maneras distintas.
   */
  {
    caso('vacío no es un error', null, t.problemaDeTelefono(''))
    caso('bueno no es un error', null, t.problemaDeTelefono('600 12 34 56'))
    caso('si faltan cifras, lo dice', true, /Faltan cifras/.test(t.problemaDeTelefono('60012345')))
    caso('y cuántas hay', true, /aquí hay 8/.test(t.problemaDeTelefono('60012345')))
    caso('si sobran, propone el «+»', true, /\+34/.test(t.problemaDeTelefono('34600123456')))
    caso('si empieza raro, dice por dónde empiezan', true, /6 o 7/.test(t.problemaDeTelefono('512345678')))
    caso('las letras se rechazan', true, /solo lleva cifras/.test(t.problemaDeTelefono('600ABC456')))
  }

  /*
   * 5. EL BIZUM APARTE, porque el fallo es otro: un fijo bien escrito pasa la
   * comprobación normal sin una queja, y luego los donativos no llegan NUNCA.
   */
  {
    caso('un móvil vale para Bizum', null, t.problemaDeBizum('600123456'))
    caso('un fijo NO vale para Bizum', true, /solo funciona con móviles/.test(t.problemaDeBizum('954123456')))
    caso('y se dice que es un fijo, que es lo accionable', true, /es un fijo/.test(t.problemaDeBizum('954123456')))
    caso('un extranjero tampoco vale', true, /móviles españoles/.test(t.problemaDeBizum('+32470123456')))
    caso('vacío no es un error', null, t.problemaDeBizum(''))
  }

  /* 6. Para enseñarlo por pantalla. */
  {
    caso('se enseña agrupado', '600 12 34 56', t.telefonoBonito('600123456'))
    caso('el de fuera se deja como está', '+32470123456', t.telefonoBonito('+32 470 12 34 56'))
  }

  /*
   * 7. EL NIF DE LA ENTIDAD. Los ejemplos son reales o calculados con la regla
   * oficial: los dígitos impares se doblan y se suman sus CIFRAS, los pares se
   * suman tal cual, y el control es lo que falta para llegar a la decena.
   */
  {
    caso('A58818501 vale', true, n.nifValido('A58818501'))
    caso('Q2826004J vale (control de letra)', true, n.nifValido('Q2826004J'))
    caso('B12345674 vale', true, n.nifValido('B12345674'))
    caso('G41000001 vale', true, n.nifValido('G41000001'))
    caso('B12345678 NO vale: el control es 4', false, n.nifValido('B12345678'))
    caso('G41000000 NO vale: el control es 1', false, n.nifValido('G41000000'))
    caso('con puntos y guiones vale igual', true, n.nifValido('B-12.345.674'))
    caso('en minúscula vale igual', true, n.nifValido('b12345674'))

    // Q lleva LETRA obligatoriamente; B lleva CIFRA obligatoriamente.
    caso('a la Q no le vale la cifra', false, n.nifValido('Q28260040'))
    caso('a la B no le vale la letra', false, n.nifValido('B1234567D'))
    // La G admite las dos, que es lo que hace que muchas hermandades tengan una
    // y muchas otras la otra.
    caso('a la G le vale la cifra', true, n.nifValido('G41000001'))
    caso('y a la G también la letra', true, n.nifValido('G4100000A'))

    caso('un DNI no es el NIF de una entidad', false, n.nifValido('12345678Z'))
    caso('la I no empieza ningún NIF', false, n.nifValido('I12345674'))
  }

  /* 8. Y lo dice en cristiano. */
  {
    caso('vacío no es un error', null, n.problemaDeNif(''))
    caso('bueno no es un error', null, n.problemaDeNif('G41000001'))
    caso('si le meten su DNI, se lo dice', true, /Eso es un DNI/.test(n.problemaDeNif('12345678Z')))
    caso('y le recuerda que suele ser G o R', true, /G \(asociación\)/.test(n.problemaDeNif('12345678Z')))
    caso('si el control no cuadra, dice cuál toca', true, /le toca el «1»/.test(n.problemaDeNif('G41000000')))
    caso('y avisa de que suele ser una cifra mal copiada',
      true, /cifra mal copiada/.test(n.problemaDeNif('G41000000')))
    caso('a la Q le dice que le toca una letra', true, /le toca la «J»/.test(n.problemaDeNif('Q28260041')))
    caso('si faltan cifras, lo dice', true, /aquí hay 5 cifras/.test(n.problemaDeNif('G410000')))
  }

  /*
   * 9. EL IDENTIFICADOR DE ACREEDOR. Lo importante es que EL CÓDIGO DE NEGOCIO
   * NO ENTRA EN EL CONTROL: los dos dígitos se calculan sobre el NIF y el país
   * nada más. Un validador que lo incluya da por malos TODOS los buenos.
   */
  {
    caso('el que le toca a B12345674', 'ES11000B12345674', n.identificadorQueLeToca('B12345674'))
    caso('el que le toca a A58818501', 'ES30000A58818501', n.identificadorQueLeToca('A58818501'))
    caso('el que le toca a G41000001', 'ES67000G41000001', n.identificadorQueLeToca('G41000001'))
    caso('de un NIF malo no sale ninguno', '', n.identificadorQueLeToca('G41000000'))

    caso('y el que sale es válido', true, n.identificadorAcreedorValido(n.identificadorQueLeToca('A58818501')))

    // Aquí está el detalle: cambiar el código de negocio NO cambia el control.
    const conOtroNegocio = n.identificadorQueLeToca('A58818501', 'ZZZ')
    caso('cambiar el código de negocio no invalida nada', true, n.identificadorAcreedorValido(conOtroNegocio))
    caso('y el control es el mismo', 'ES30ZZZA58818501', conOtroNegocio)

    caso('un dígito de control cambiado se pilla', false, n.identificadorAcreedorValido('ES31000A58818501'))
    caso('un NIF malo dentro se pilla', false, n.identificadorAcreedorValido('ES30000A58818500'))
    caso('el ejemplo viejo del código NO valía', false, n.identificadorAcreedorValido('ES23000B12345678'))
    caso('con espacios vale igual', true, n.identificadorAcreedorValido('ES30 000 A58818501'))
  }

  /* 10. Y también lo dice en cristiano. */
  {
    caso('vacío no es un error', null, n.problemaDeIdentificadorAcreedor(''))
    caso('bueno no es un error', null, n.problemaDeIdentificadorAcreedor('ES30000A58818501'))
    caso('si no empieza por ES, lo dice',
      true, /empieza por ES/.test(n.problemaDeIdentificadorAcreedor('FR30000A58818501')))
    caso('si mide otra cosa, dice cuánto mide',
      true, /aquí hay 11/.test(n.problemaDeIdentificadorAcreedor('ES30000A588')))
    caso('si el control no cuadra, DICE EL BUENO',
      true, /Quedaría ES30000A58818501/.test(n.problemaDeIdentificadorAcreedor('ES31000A58818501')))
    caso('y manda comprobarlo con el papel del banco antes de cambiarlo',
      true, /papel que te dio el banco/.test(n.problemaDeIdentificadorAcreedor('ES31000A58818501')))
    caso('si el NIF de dentro está mal, se explica el NIF',
      true, /le toca el «1»/.test(n.problemaDeIdentificadorAcreedor('ES67000G41000000')))
  }

  /*
   * 11. EL CÓDIGO POSTAL. Lo que se rompe de verdad es el CERO DE DELANTE: se
   * teclea bien y se importa de un Excel donde la columna era numérica, y el
   * 08013 de Barcelona llega como 8013.
   */
  {
    caso('41004 de Sevilla vale', true, n.codigoPostalValido('41004'))
    caso('01001 de Álava vale', true, n.codigoPostalValido('01001'))
    caso('52001 de Melilla vale', true, n.codigoPostalValido('52001'))
    caso('00123 no existe: no hay provincia 00', false, n.codigoPostalValido('00123'))
    caso('53001 tampoco: no hay provincia 53', false, n.codigoPostalValido('53001'))
    caso('8013 son cuatro cifras', false, n.codigoPostalValido('8013'))
    caso('vacío no es un error', null, n.problemaDeCodigoPostal(''))
    caso('bueno no es un error', null, n.problemaDeCodigoPostal('41004'))
    caso('a las cuatro cifras se le propone el cero delante',
      true, /se escribe con él: 08013/.test(n.problemaDeCodigoPostal('8013')))
    caso('y si la provincia no existe, se dice',
      true, /de la 01 a la 52/.test(n.problemaDeCodigoPostal('53001')))
    caso('las letras se rechazan', true, /cinco cifras y nada más/.test(n.problemaDeCodigoPostal('41A04')))
  }

  /*
   * 12. Y LO QUE NO SE TOCA. Igual que con el DNI: el importador NO rechaza
   * nada. En un censo viejo hay teléfonos de ocho cifras de antes de 1998, y
   * una hermandad que no puede importar su censo no puede empezar a usar esto.
   */
  {
    const { readFile } = await import('node:fs/promises')
    const importar = await readFile('src/lib/importar.ts', 'utf8')
    caso('el importador NO valida el teléfono',
      false, /telefonoValido|problemaDeTelefono|esMovilEspanol/.test(importar))
  }

  /*
   * 13. Y QUE ESTÉ ENCHUFADO DONDE SE TECLEA. Una regla que no llega a ningún
   * formulario no ha arreglado nada: lo que se pidió es que no se pueda meter
   * mal el dato, no que exista una función que sepa comprobarlo.
   */
  {
    const { readFile } = await import('node:fs/promises')
    const sitios = [
      ['src/pages/app/Configuracion.tsx', ['problemaDeNif', 'problemaDeBizum',
        'problemaDeCodigoPostal', 'problemaDeIdentificadorAcreedor', 'problemaDeTelefono']],
      ['src/components/AltaHermandad.tsx', ['problemaDeNif', 'problemaDeBizum',
        'problemaDeIdentificadorAcreedor']],
      ['src/pages/app/Hermanos.tsx', ['problemaDeTelefono']],
      ['src/pages/HermanoPortal.tsx', ['problemaDeTelefono']],
      ['src/pages/app/WebPublica.tsx', ['problemaDeTelefono']],
    ]
    for (const [fichero, esperados] of sitios) {
      const src = await readFile(fichero, 'utf8')
      for (const fn of esperados) {
        caso(`${fichero.split('/').pop()} usa ${fn}`, true, src.includes(fn))
      }
    }

    // Y EL IBAN, en los tres sitios donde se tecleaba sin comprobarlo. En la
    // ficha del hermano y en la remesa ya se comprobaba; en Configuración, en
    // el alta y en la cuenta de donativos de la web, no.
    for (const f of ['src/pages/app/Configuracion.tsx', 'src/components/AltaHermandad.tsx',
                     'src/pages/app/WebPublica.tsx']) {
      const src = await readFile(f, 'utf8')
      caso(`${f.split('/').pop()} comprueba el IBAN`, true, /ibanValido/.test(src))
    }
  }

  /*
   * 14. LA DEMO PASA SUS PROPIAS COMPROBACIONES.
   *
   * Los tres datos de la hermandad de ejemplo estaban inventados a ojo y NO
   * eran válidos: el CIF llevaba control 0 cuando le toca 1, y ni el IBAN ni el
   * identificador de acreedor cuadraban. Con la validación puesta, quien abría
   * la demo para ver si esto le servía se encontraba tres avisos rojos en
   * Configuración nada más entrar, y concluía, con razón, que viene rota.
   */
  {
    const { ibanValido } = await cargar('src/lib/iban.ts')
    const demo = await cargar('src/lib/demo.ts')
    const { readFile } = await import('node:fs/promises')
    const src = await readFile('src/lib/demo.ts', 'utf8')
    const dato = (clave) => (new RegExp(`${clave}: '([^']*)'`).exec(src) ?? [])[1] ?? ''

    caso('el CIF de la demo vale', true, n.nifValido(dato('cif')))
    caso('su IBAN vale', true, ibanValido(dato('iban')))
    caso('su identificador de acreedor vale', true, n.identificadorAcreedorValido(dato('identificadorAcreedor')))
    caso('su código postal vale', true, n.codigoPostalValido(dato('codigoPostal')))
    caso('su teléfono vale', true, t.telefonoValido(dato('telefono')))
    caso('y su Bizum es un móvil', true, t.esMovilEspanol(dato('bizumTelefono')))
    // Que el módulo carga de verdad, no solo que el fichero se puede leer.
    caso('y el módulo de la demo sigue cargando', true, typeof demo === 'object')
  }

  /*
   * 15. Y LOS EJEMPLOS QUE SE LE ENSEÑAN A LA GENTE TAMBIÉN VALEN.
   *
   * Un `placeholder` es lo que la persona copia cuando no sabe qué forma tiene
   * el dato. Los de antes —G41000000, ES23000B12345678— estaban mal, así que
   * enseñaban justo la forma que la aplicación iba a rechazar.
   */
  {
    const { readFile } = await import('node:fs/promises')
    for (const f of ['src/pages/app/Configuracion.tsx', 'src/components/AltaHermandad.tsx']) {
      const src = await readFile(f, 'utf8')
      const malos = ['G41000000', 'ES23000B12345678', 'G-00000000']
      for (const m of malos) {
        caso(`${f.split('/').pop()} ya no propone ${m}`, false, src.includes(m))
      }
    }
  }

  /*
   * 16. «SIN DATOS» NO PUEDE ACABAR DENTRO DE UN CAMPO PARA RELLENAR.
   *
   * La ficha guarda esa cadena cuando el alta viene sin teléfono. En el área
   * del hermano salía DENTRO del recuadro, así que para poner el suyo tenía
   * que borrarla primero — y muchos escribían detrás. Con la comprobación
   * puesta era además un bloqueo: al guardar sus datos le habría dicho que
   * «Sin datos» no es un teléfono, sin que él hubiera tocado nada.
   */
  {
    const { readFile } = await import('node:fs/promises')
    const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
    caso('el portal filtra el hueco antes de pintarlo', true,
      /defaultValue=\{siNoEsElHueco\(hermanoActivo\.telefono\)\}/.test(portal))
    caso('y también en la dirección', true,
      /defaultValue=\{siNoEsElHueco\(hermanoPrincipal\.direccion\)\}/.test(portal))
    caso('«Sin datos» no es un teléfono, que es por lo que hacía falta',
      true, t.problemaDeTelefono('Sin datos') !== null)
  }

  /*
   * 17. UNA SOLA REGLA PARA EL TELÉFONO. La web pública tenía la suya, más
   * floja: aceptaba «123456789», que no empieza como ningún teléfono español.
   * Dos reglas para el mismo dato significa que la web acepta lo que la ficha
   * rechaza, y secretaría abre una ficha recién llegada con el campo en rojo
   * sin que nadie haya tocado nada.
   */
  {
    const m = await cargar('src/lib/mensajesWeb.ts')
    caso('la web usa la misma regla', t.telefonoValido('123456789'), m.pareceTelefono('123456789'))
    caso('y con un móvil de verdad, las dos dicen que sí', true, m.pareceTelefono('622104558'))
    const { readFile } = await import('node:fs/promises')
    const src = await readFile('src/lib/mensajesWeb.ts', 'utf8')
    caso('ya no tiene su propia expresión regular', false, /\\+\?\\d\{9,15\}/.test(src))
    // Y el error del formulario dice QUÉ pasa, no «no parece correcto».
    const bueno = { nombre: 'Ana Sánchez', email: 'ana@hermandad.es', consiente: true }
    caso('el formulario dice cuántas cifras faltan', true,
      /aquí hay 8/.test(m.erroresFormulario({ ...bueno, telefono: '60012345' }).telefono))
    caso('y ya no dice «Ese teléfono no parece correcto»',
      false, /e\.telefono = 'Ese teléfono no parece correcto\.'/.test(src))
  }
}
