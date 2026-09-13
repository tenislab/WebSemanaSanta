/**
 * EL ESPEJO DEL NAVEGADOR NO PASA POR LOS MAPEOS, Y AHÍ SE CAÍAN DOS PANTALLAS.
 *
 * ============================================================================
 * DE DÓNDE SALE ESTO
 * ============================================================================
 *
 * Los datos de la hermandad llegan por dos caminos, y solo uno está defendido:
 *
 *   · DE SUPABASE, fila a fila, pasando por `rowTo…`. Ahí sí se completa lo
 *     que falta: `rowToEvento` hace `Array.isArray(r.tareas) ? … : []`, y
 *     `rowToDocumento` hace `?? null`. Quien los escribió YA CONTABA con que
 *     el campo no estuviera.
 *   · DEL ESPEJO DE `localStorage`, que se lee tal cual con `JSON.parse`. Sin
 *     mapeo, sin completar, sin mirar. Y lo que hay ahí lo escribió la versión
 *     de la aplicación que estuviera puesta el día que se guardó —puede ser de
 *     hace dos años— así que le faltan los campos que entonces no existían.
 *
 * O sea: las dos defensas estaban escritas y el camino que las necesitaba no
 * pasaba por ellas. Medido abriendo las pantallas con los datos de ejemplo
 * MENOS un campo (ver el barrido `quefalta.mjs` de la revisión):
 *
 *   · /app/eventos sin `tareas`          → «Cannot read properties of
 *     undefined (reading 'hecha')». Se recorre en cinco sitios de la pantalla.
 *   · /app/archivo sin `cargosConAcceso` → «Cannot read properties of
 *     undefined (reading 'includes')», en `canView`, que comparaba `=== null`.
 *
 * Las dos veces no es una fila rara: es la PANTALLA ENTERA con «Algo se ha
 * roto al abrir esta pantalla», y sin forma de llegar a los datos.
 *
 * ============================================================================
 * LO QUE SE COMPRUEBA
 * ============================================================================
 *
 * Se ejecutan las funciones de verdad, con los datos de ejemplo a los que se
 * les ha quitado el campo — que es exactamente lo que hace el navegador.
 */
export default async function ({ cargar, caso }) {
const eventos = await cargar('src/data/eventos.ts')
const dbEventos = await cargar('src/lib/db/eventos.ts')


const sinTareas = eventos.EVENTOS_INICIALES.map((e) => {
  const copia = { ...e }
  delete copia.tareas
  return copia
})
caso('el ejemplo del que se parte sí trae tareas', true,
  eventos.EVENTOS_INICIALES.every((e) => Array.isArray(e.tareas)))
caso('y al quitarlas, no', true, sinTareas.every((e) => e.tareas === undefined))

const completados = sinTareas.map(eventos.conDefectosEvento)
caso('conDefectosEvento deja una lista de tareas', true,
  completados.every((e) => Array.isArray(e.tareas)))

// Y LO QUE HACE LA PANTALLA, ejecutado: los cinco recorridos de `Eventos.tsx`
// vienen a ser estos dos. Sin completar, los dos lanzan.
const comoLaPantalla = (lista) => ({
  pendientes: lista.flatMap((e) => e.tareas).filter((t) => !t.hecha).length,
  porEvento: lista.map((e) => e.tareas.filter((t) => !t.hecha).length),
})
const lanza = (fn) => { try { fn(); return null } catch (e) { return e.message } }
caso('sin completar, la pantalla de Eventos lanza', true,
  /reading 'hecha'|of undefined/.test(lanza(() => comoLaPantalla(sinTareas)) ?? ''))
caso('completados, no lanza', null, lanza(() => comoLaPantalla(completados)))
caso('y cuenta lo mismo que con los ejemplos enteros salvo las tareas que no hay',
  0, comoLaPantalla(completados).pendientes)

// Que lo que se sube a la base tampoco lleve un `undefined`: al serializar el
// JSON desaparece la clave, y la columna se queda con lo que hubiera antes.
caso('eventoToRow manda una lista aunque no la haya', true,
  Array.isArray(dbEventos.eventoToRow(sinTareas[0]).tareas))


/*
 * Y QUE LA PANTALLA LO USE. Sin esto la guardia de arriba vigila una función
 * que nadie llama: `conDefectosEvento` puede estar perfecta y `Eventos.tsx`
 * leer la lista cruda. Ya pasó con el encargo de redes —el guardia en verde y
 * el cable suelto— así que la conexión se comprueba aparte.
 */
const { readFile: leer } = await import('node:fs/promises')
const pantallaEventos = await leer('src/pages/app/Eventos.tsx', 'utf8')
caso('la pantalla de Eventos completa lo que lee', true,
  /eventosGuardados\.map\(conDefectosEvento\)/.test(pantallaEventos))
caso('y no se queda con la lista cruda del hook', false,
  /const \[eventos, setEventos\] = useSupabaseTable/.test(pantallaEventos))

// `canView` vive dentro de la pantalla (no se puede importar), así que se
// comprueba la fuente: que NO compare con `=== null`, que es lo que dejaba
// pasar el `undefined`.
const { readFile } = await import('node:fs/promises')
const archivo = await readFile('src/pages/app/Archivo.tsx', 'utf8')
const cuerpo = archivo.slice(archivo.indexOf('function canView'), archivo.indexOf('function canView') + 200)
caso('canView no se fía de «=== null»', false, /cargosConAcceso === null/.test(cuerpo))
caso('canView trata el campo que falta como institucional', true,
  /!doc\.cargosConAcceso \|\| doc\.cargosConAcceso\.includes/.test(cuerpo))

// Y el comportamiento, ejecutado con las tres formas que llegan de verdad.
const canView = (doc, cargo) => !doc.cargosConAcceso || doc.cargosConAcceso.includes(cargo)
caso('un documento institucional (null) lo ve cualquiera', true, canView({ cargosConAcceso: null }, 'Fiscal'))
caso('uno sin el campo también, como lo mapea la base', true, canView({}, 'Fiscal'))
caso('y uno restringido sigue restringido', false,
  canView({ cargosConAcceso: ['Tesorero/a'] }, 'Fiscal'))
caso('al cargo que le toca, sí', true,
  canView({ cargosConAcceso: ['Tesorero/a'] }, 'Tesorero/a'))
}
