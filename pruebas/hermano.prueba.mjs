/** H1: el histórico del hermano, año por año. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/hermanoFicha.ts')

  // --- Cuántas veces ha salido de verdad ---
  const p = (estado, extra = {}) => ({ estado, ...extra })
  caso('una entregada cuenta', 1, m.salidasDe([p('Entregada')]))
  caso('una pagada cuenta', 1, m.salidasDe([p('Pagada')]))
  caso('una asignada cuenta', 1, m.salidasDe([p('Asignada')]))
  caso('una solicitud pendiente no', 0, m.salidasDe([p('Solicitada')]))
  caso('una renuncia tampoco', 0, m.salidasDe([p('Renuncia')]))
  caso('una anulada tampoco', 0, m.salidasDe([p('Anulada')]))
  caso('sin papeletas, cero', 0, m.salidasDe([]))
  caso('cuenta las buenas de una mezcla', 3,
    m.salidasDe([p('Entregada'), p('Renuncia'), p('Pagada'), p('Anulada'), p('Asignada'), p('Solicitada')]))
  // Sin tramo también cuenta: hay hermandades que reparten por opciones.
  caso('sin tramo también cuenta', 1, m.salidasDe([p('Pagada', { tramoId: null, opcion: 'Cirio' })]))

  // --- Agrupar por año ---
  const cuotas = [
    { id: 'a', anio: 2024 }, { id: 'b', anio: 2026 }, { id: 'c', anio: 2024 }, { id: 'd', anio: 2025 },
  ]
  const g = m.porAnio(cuotas, (x) => x.anio)
  caso('de lo nuevo a lo viejo', '2026,2025,2024', g.map(([a]) => a).join(','))
  caso('con lo de cada año junto', 2, g.find(([a]) => a === 2024)[1].length)
  caso('sin nada, ningún grupo', 0, m.porAnio([], (x) => x.anio).length)
  // Lo que no tiene año no se pierde: va al 0 y se pinta como «Sin ejercicio».
  const conHuerfana = m.porAnio([{ id: 'x', anio: null }, { id: 'y', anio: 2026 }], (x) => x.anio)
  caso('lo que no tiene año no se pierde', 2, conHuerfana.length)
  caso('y queda el último', 0, conHuerfana[conHuerfana.length - 1][0])

  // --- H4: qué avisos quiere recibir ---
  const av = await cargar('src/lib/avisosHermano.ts')
  caso('por defecto se recibe todo', true, av.quiereAviso({}, 'comunicado'))
  caso('lo apagado no', false, av.quiereAviso({ comunicado: false }, 'comunicado'))
  caso('apagar uno no apaga los demás', true, av.quiereAviso({ comunicado: false }, 'cuota'))
  caso('lo encendido a mano, sí', true, av.quiereAviso({ cuota: true }, 'cuota'))
  // Los avisos de antes no llevaban tipo: se tratan como cambios de ficha.
  caso('un aviso sin tipo es de ficha', false, av.quiereAviso({ ficha: false }, undefined))
  caso('y se recibe si la ficha está encendida', true, av.quiereAviso({ ficha: true }, undefined))
  // Cinco desde que la junta se reparte los posts: el encargo tiene su
  // propio interruptor porque no es lo mismo que un comunicado —lo recibe
  // quien lleva un cargo, y es trabajo, no información.
  caso('hay cinco tipos de aviso', 5, av.TIPOS_AVISO.length)
  caso('y uno es el encargo de la junta', true, av.TIPOS_AVISO.some((t) => t.id === 'encargo'))
  caso('cada uno con su icono', true, av.TIPOS_AVISO.every((t) => t.icono && t.nombre && t.explica))

  // --- H6: el carné digital ---
  const v = await cargar('src/lib/verificacion.ts')
  const hermano = { nombre: 'Ana Sánchez del Río', numero: 89, antiguedad: 1991, estado: 'Activo' }
  const carne = v.datosCarneDe(hermano, 'Hdad. de la Vera-Cruz')
  caso('el carné se marca como carné', 'c', carne.k)
  caso('con su nombre', 'Ana Sánchez del Río', carne.h)
  caso('su número', 89, carne.nh)
  caso('y su hermandad', 'Hdad. de la Vera-Cruz', carne.hd)
  caso('sin nombre de hermandad, uno de respaldo', 'Tu hermandad', v.datosCarneDe(hermano, '').hd)

  // Ida y vuelta por el enlace del QR.
  const url = v.urlCarne(carne)
  const param = url.slice(url.indexOf('d=') + 2)
  const leido = v.decodificarQr(param)
  caso('se reconoce como carné', 'carne', leido.tipo)
  caso('y vuelve entero', 'Ana Sánchez del Río', leido.datos.h)
  // Los acentos y la eñe tienen que sobrevivir al viaje.
  caso('los acentos sobreviven', 'Ñoño Muñoz Añón',
    v.decodificarQr(v.urlCarne(v.datosCarneDe({ ...hermano, nombre: 'Ñoño Muñoz Añón' }, 'X')).split('d=')[1]).datos.h)

  // Un QR de papeleta de antes sigue leyéndose: no llevaban la marca `k`.
  const pap = v.datosVerificacionDe(
    { numero: 312, anio: 2026, opcion: null }, hermano, 'Cirio 1º tramo', 'Hdad.')
  const leidoPap = v.decodificarQr(v.urlVerificacion(pap).split('d=')[1])
  caso('una papeleta antigua sigue valiendo', 'papeleta', leidoPap.tipo)
  caso('con su número', 312, leidoPap.datos.n)

  caso('un código roto no revienta', null, v.decodificarQr('xxxx'))
  caso('sin código tampoco', null, v.decodificarQr(null))
  caso('un JSON que no es ni carné ni papeleta, tampoco', null,
    v.decodificarQr(btoa(JSON.stringify({ cualquiera: 1 }))))

  // --- H3: el hermano avisa de que ha pagado, tesorería lo confirma ---

  const c = await cargar('src/data/cuotas.ts')
  const aviso = { metodo: 'Bizum', fecha: '19 ago 2026' }

  caso('un recibo sin avisar, no está avisado', false,
    c.esAvisado({ estado: 'Pendiente' }))
  caso('avisado y pendiente, sí', true,
    c.esAvisado({ estado: 'Pendiente', pagoComunicado: aviso }))
  caso('avisado y en mora, también', true,
    c.esAvisado({ estado: 'En mora', pagoComunicado: aviso }))
  caso('avisado y devuelto, también', true,
    c.esAvisado({ estado: 'Devuelta', pagoComunicado: aviso }))
  // En cuanto tesorería lo da por cobrado, el aviso deja de pedir atención:
  // si no, el banner del panel no bajaría nunca de N.
  caso('ya cobrado, deja de estar avisado', false,
    c.esAvisado({ estado: 'Pagada', pagoComunicado: aviso }))
  // El hermano puede rectificar: al quitar el aviso, vuelve a la nada.
  caso('aviso retirado, ya no está avisado', false,
    c.esAvisado({ estado: 'Pendiente', pagoComunicado: null }))
  caso('los recibos de antes no llevan el campo', false,
    c.esAvisado({ estado: 'Pendiente', pagoComunicado: undefined }))
}
