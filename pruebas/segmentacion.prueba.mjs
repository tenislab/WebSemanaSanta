/** Sesgos del censo: a quién le llega un comunicado. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/segmentacion.ts')
  const H = (id, extra = {}) => ({
    id, numero: 1, nombre: id, estado: 'Activo', antiguedad: 2000,
    email: `${id}@ejemplo.com`, telefono: '', direccion: '', cuotaAlDia: true,
    iban: null, dni: '', claveAcceso: '', authUserId: null, ...extra,
  })
  const base = { estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', cargo: '', soloConEmail: false, campos: [] }
  const ids = (hs, c) => m.filtrarSegmento(hs, c).map((h) => h.id)

  const hs = [
    H('activo'),
    H('nuevo', { estado: 'Nuevo' }),
    H('baja', { estado: 'Baja' }),
    H('debe', { cuotaAlDia: false }),
    H('sincorreo', { email: '' }),
    H('nino', { fechaNacimiento: '2015-05-05' }),
    H('costalero', { etiquetas: ['Costalero'] }),
  ]

  caso('«Cualquiera» los coge a todos', 7, ids(hs, base).length)
  caso('«Todos» deja fuera las bajas', false, ids(hs, { ...base, estado: 'Todos' }).includes('baja'))
  caso('solo activos', ['activo', 'debe', 'sincorreo', 'nino', 'costalero'], ids(hs, { ...base, estado: 'Activo' }))
  caso('solo nuevos', ['nuevo'], ids(hs, { ...base, estado: 'Nuevo' }))
  caso('con la cuota pendiente', ['debe'], ids(hs, { ...base, cuota: 'Pendiente' }))
  caso('solo con correo deja fuera al que no tiene', false,
    ids(hs, { ...base, soloConEmail: true }).includes('sincorreo'))
  caso('por etiqueta', ['costalero'], ids(hs, { ...base, etiqueta: 'Costalero' }))
  caso('menores de edad', ['nino'], ids(hs, { ...base, edad: 'Menores' }))
  caso('sin fecha de nacimiento no cuenta como mayor', [], ids(hs, { ...base, edad: 'Mayores' }))

  const conCampos = [H('conllave', { campos: { llave: 'sí' } }), H('sinllave', { campos: { llave: 'no' } }), H('vacio')]
  caso('por campo propio', ['conllave'], ids(conCampos, { ...base, campos: [{ campoId: 'llave', valor: 'sí' }] }))
  caso('condición de campo vacía no filtra', 3, ids(conCampos, { ...base, campos: [{ campoId: 'llave', valor: '' }] }).length)

  const hoy = new Date(2026, 7, 18)
  caso('edad justo el día del cumpleaños', 18, m.edadDe('2008-08-18', hoy))
  caso('edad el día antes', 17, m.edadDe('2008-08-19', hoy))
  caso('sin fecha, null', null, m.edadDe(undefined, hoy))
  caso('fecha inválida, null', null, m.edadDe('no-es-fecha', hoy))

  await sesgarPorCargo({ cargar, caso })
}

/**
 * SESGAR POR CARGO: «solo a la junta».
 *
 * Faltaba, y era el sesgo que más se pide: una hermandad convoca a su junta
 * cada mes. Sin esto había que ir marcando a mano quién es de la junta cada
 * vez, o mandárselo a los 800 — lo primero se abandona y lo segundo no se hace.
 */
async function sesgarPorCargo({ cargar, caso }) {
  const m = await cargar('src/lib/segmentacion.ts')
  const H = (id, extra = {}) => ({
    id, numero: 1, nombre: id, estado: 'Activo', antiguedad: 2000,
    email: `${id}@ejemplo.com`, telefono: '', direccion: '', cuotaAlDia: true,
    iban: null, dni: '', claveAcceso: '', authUserId: null, ...extra,
  })
  const base = { estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', cargo: '', soloConEmail: false, campos: [] }
  const ids = (hs, c) => m.filtrarSegmento(hs, c).map((h) => h.id)

  const censo = [
    H('mayor', { cargo: 'Hermano Mayor' }),
    H('tesorero', { cargo: 'Tesorero/a' }),
    H('vocal', { cargo: 'Vocal' }),
    H('depie', { cargo: 'Hermano de a pie' }),
    H('sincargo'),
    H('vacio', { cargo: '   ' }),
  ]

  caso('sin pedir cargo salen todos', 6, ids(censo, base).length)
  caso('«toda la junta» son los que llevan cargo',
    ['mayor', 'tesorero', 'vocal'], ids(censo, { ...base, cargo: '__junta' }))
  /*
   * «Hermano de a pie» está en el catálogo pero NO es junta: es lo que se le
   * pone a quien no lleva ninguno. Si contara, «solo a la junta» acabaría
   * siendo «a todo el censo», que es exactamente lo contrario de lo que se
   * pide — y nadie lo notaría hasta que 800 personas recibieran la convocatoria
   * de una reunión a la que no van.
   */
  caso('«Hermano de a pie» no es junta', false, ids(censo, { ...base, cargo: '__junta' }).includes('depie'))
  caso('ni quien no tiene cargo', false, ids(censo, { ...base, cargo: '__junta' }).includes('sincargo'))
  caso('ni un cargo en blanco', false, ids(censo, { ...base, cargo: '__junta' }).includes('vacio'))

  // Y un cargo concreto, para cuando se escribe solo a quien toca.
  caso('un cargo concreto', ['tesorero'], ids(censo, { ...base, cargo: 'Tesorero/a' }))
  caso('uno que no lleva nadie', 0, ids(censo, { ...base, cargo: 'Fiscal' }).length)

  // Se combina con lo demás: «la junta que está al día de cuota».
  const conDeuda = [...censo, H('mayordebe', { cargo: 'Mayordomo/Prioste', cuotaAlDia: false })]
  caso('se combina con la cuota', false,
    ids(conDeuda, { ...base, cargo: '__junta', cuota: 'AlDia' }).includes('mayordebe'))

  // Y el nombre del sesgo lo dice, que es lo que se guarda en el comunicado.
  caso('la etiqueta dice que es la junta', true,
    /de la junta/.test(m.etiquetaSegmento({ ...base, cargo: '__junta' })))
  caso('y con un cargo concreto, cuál', true,
    /Tesorero/.test(m.etiquetaSegmento({ ...base, cargo: 'Tesorero/a' })))

  await elFormularioHabla({ caso })
}

/**
 * QUE EL FORMULARIO DIGA POR QUÉ NO GUARDA.
 *
 * Había tres `return` mudos: sin título, sin cuerpo, o con «redes sociales»
 * elegido y ninguna red marcada. Se pulsaba Guardar, NO PASABA NADA, y no
 * había forma de saber qué faltaba. Eso no se lee como «me falta un dato», se
 * lee como «la aplicación está rota».
 */
async function elFormularioHabla({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/pages/app/Comunicados.tsx', 'utf8')

  // Ningún `return` a secas dentro del guardado.
  const guardar = src.slice(src.indexOf('const data = new FormData(form)'))
  const mudos = (guardar.slice(0, 2600).match(/^\s*if \([^)]*\) return$/gm) ?? []).length
  caso('no queda ningún return mudo', 0, mudos)

  caso('dice si falta el título', true, /Ponle un título al comunicado/.test(src))
  caso('dice si está vacío', true, /El comunicado está vacío/.test(src))
  caso('dice si falta el canal', true, /Elige al menos un canal/.test(src))
  caso('dice si faltan las redes', true, /marca en cuáles se publica/.test(src))
  caso('dice si falta la fecha', true, /dile para qué día/.test(src))
  // Y el que ya hablaba, ahora dice qué hacer y no solo qué pasa.
  caso('y con un sesgo vacío, qué hacer', true, /guárdalo como borrador y ajústalo luego/.test(src))
}
