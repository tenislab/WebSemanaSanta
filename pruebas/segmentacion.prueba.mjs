/** Sesgos del censo: a quién le llega un comunicado. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/segmentacion.ts')
  const H = (id, extra = {}) => ({
    id, numero: 1, nombre: id, estado: 'Activo', antiguedad: 2000,
    email: `${id}@ejemplo.com`, telefono: '', direccion: '', cuotaAlDia: true,
    iban: null, dni: '', claveAcceso: '', authUserId: null, ...extra,
  })
  const base = { estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', soloConEmail: false, campos: [] }
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
}
