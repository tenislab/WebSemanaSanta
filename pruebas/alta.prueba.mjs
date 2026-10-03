/** P4: cuándo sale el asistente de alta de la hermandad. */
import { antesQue } from './fuentes.mjs'
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/altaHermandad.ts')
  const vacia = { cif: '', direccion: '', iban: '' }

  // Recién creada: no tiene nada, hay que preguntárselo.
  caso('una hermandad vacía tiene el alta pendiente', true, m.altaPendiente(vacia))
  // Con CUALQUIERA de los tres puestos ya no es nueva: alguien pasó por
  // Configuración y el asistente sería un estorbo.
  caso('con CIF, ya no', false, m.altaPendiente({ ...vacia, cif: 'G41000000' }))
  caso('con dirección, ya no', false, m.altaPendiente({ ...vacia, direccion: 'C/ Pureza 53' }))
  caso('con IBAN, ya no', false, m.altaPendiente({ ...vacia, iban: 'ES47 2100' }))
  // Espacios en blanco no son un dato.
  caso('espacios en blanco no cuentan', true, m.altaPendiente({ cif: '  ', direccion: ' ', iban: '   ' }))

  // Una vez hecho (o saltado), no vuelve a salir: si no, se cerraría sin leer
  // en cada entrada.
  localStorage.setItem(m.CLAVE_ALTA_HECHA, 'si')
  caso('hecho una vez, no vuelve a salir', false, m.altaPendiente(vacia))
  localStorage.removeItem(m.CLAVE_ALTA_HECHA)
  caso('y al limpiar la marca vuelve a estar pendiente', true, m.altaPendiente(vacia))

  // ---------------------------------------------------------------------
  // El alta que parece que fue bien y no fue
  // ---------------------------------------------------------------------
  /*
   * EL FALLO: al dar de alta a un hermano con Supabase conectado se le crea
   * además su cuenta de acceso. Si esa creación fallaba, se escribía en la
   * consola del navegador y se seguía como si nada: la ficha quedaba guardada,
   * la pantalla decía que todo bien, y esa persona NO PODÍA ENTRAR NUNCA.
   *
   * Nadie se enteraba hasta que llamaba preguntando por qué no le funciona. Y
   * la causa más común no es rara: el correo ya está usado por otra cuenta —el
   * padre que da de alta a su hijo con su propio correo, la pareja que comparte
   * dirección—.
   */
  const { readFile } = await import('node:fs/promises')
  const hermanos = await (await import('./fuentes.mjs')).fuenteDelCenso()
  /*
   * La creación de cuentas y su mensaje de fallo viven ahora en un módulo
   * compartido, porque hacen falta en DOS pantallas: Hermanos y Personal.
   * Duplicarlos dejaría dos versiones del mismo texto, y la que no se toca se
   * queda vieja.
   */
  const accesos = await readFile('src/lib/accesos.ts', 'utf8')

  /*
   * Ya no se traga el fallo: se devuelve. Se mira que el tipo LO LLEVE, no cómo
   * está escrito: comprobando el texto exacto, esta prueba se ponía roja el día
   * que al tipo se le añadió un campo más —y lo que venía a proteger seguía
   * estando—, que es ruido y no una red de seguridad.
   */
  caso('crear el acceso devuelve también el fallo', true,
    /ResultadoDeAcceso = \{[\s\S]{0,600}?error: string \| null/.test(accesos))
  /*
   * Y LA PANTALLA LO RECOGE — SIN PINCHAR EL NOMBRE DEL RECOGEDOR.
   *
   * Esta línea pinchaba `setAvisoAcceso(acceso.error)` tal cual, justo debajo
   * del comentario de arriba que avisa de no hacer eso. Y pasó lo que avisaba:
   * al sacar el alta de `Hermanos.tsx` a su propio componente, el aviso dejó
   * de ser un `setState` de la pantalla y pasó a ser una prop (`onAviso`), que
   * es lo correcto — el formulario cuenta lo que ha pasado y la pantalla
   * decide qué hacer con ello—. La guarda se puso roja contra un código que
   * sigue sin tragarse el fallo.
   *
   * Lo que hay que vigilar es que el fallo NO SE QUEDE AHÍ: que la rama exista
   * y que lo que lleve dentro no sea un comentario ni un `console.log`.
   */
  const recoge = hermanos.match(/if \(acceso\.error\)\s*(\w+)\(acceso\.error\)/)
  caso('y la pantalla lo recoge', true, recoge !== null)
  caso('y no se lo traga en la consola', true, recoge !== null && !/^console/.test(recoge[1]))
  /*
   * En los DOS sitios que dan de alta: la solicitud aceptada y el alta a mano.
   *
   * Se busca por lo que HACE y no por cómo se llama la función. Al partir el
   * censo, uno de los dos se mudó a `censo/solicitudesDeAlta.ts` y allí el
   * aviso llega por un prop, que se llama `onAvisoDeAcceso` y no
   * `setAvisoAcceso`: con el nombre exacto, este guardia contaba uno y daba
   * rojo por un cambio que no rompía nada. Lo que no puede perderse es que el
   * error de crear la cuenta SE CUENTE, se llame como se llame quien lo cuenta.
   */
  caso('en los dos sitios que dan de alta', 2,
    (hermanos.match(/if \(acceso\.error\) \w+\(acceso\.error\)/g) || []).length)
  caso('y se pinta donde se ve', true, /avisoAcceso && \(/.test(hermanos))

  // El mensaje dice las dos cosas que hacen falta: que la ficha SÍ se guardó, y
  // que el acceso NO. Decir solo «error» dejaría a secretaría sin saber si
  // tiene que volver a darlo de alta.
  caso('dice que la ficha sí se guardó', true, /La ficha se ha guardado, pero NO se ha creado su acceso/.test(accesos))
  // Y la causa más común, en cristiano y con la salida.
  caso('explica el correo repetido', true, /ya lo usa otra cuenta/.test(accesos))
  caso('y dice qué hacer', true, /Ponle un correo suyo y vuelve a intentarlo/.test(accesos))

  /*
   * Y EL MISMO FALLO EN PERSONAL Y PERMISOS.
   *
   * Ahí estaba igual de crudo: `console.error` y a seguir. La persona quedaba
   * en la lista con `authUserId` en null, y eso no es solo que no pueda
   * entrar: el cargo se reconoce cruzando ESE identificador, así que aunque
   * luego se le creara la cuenta a mano, sus permisos no se le aplicarían
   * nunca. Entraría, si entraba, sin ver ningún módulo.
   */
  const personal = await readFile('src/pages/app/Personal.tsx', 'utf8')
  caso('Personal también usa el módulo compartido', true,
    /from '\.\.\/\.\.\/lib\/accesos'/.test(personal))
  caso('Personal ya no se traga el fallo', false, /console\.error\('No se pudo crear el acceso real/.test(personal))
  caso('y lo pinta fuera del cajón', true, /avisoAcceso && \(/.test(personal))
  // Fuera del cajón no es un detalle: el cajón se cierra al guardar y se
  // llevaría el aviso con él.
  caso('el aviso va antes del primer cajón', true,
    antesQue(personal, 'avisoAcceso && (', '<Drawer'))
  // Y hay forma de recuperarse: hasta ahora, si la cuenta no se creaba, no
  // había NINGUNA manera de arreglarlo desde la pantalla.
  caso('se puede reintentar crear la cuenta', true, /Reintentar crear su acceso/.test(personal))
  caso('y se ve quién no puede entrar', true, /Sin acceso/.test(personal))
}
