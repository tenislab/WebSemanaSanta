/**
 * UNA FECHA A MEDIO ESCRIBIR NO PUEDE CERRAR LA CAMPAÑA ENTERA.
 *
 * Las fechas de la campaña se guardan AL VUELO: cada tecleo en el
 * `<input type="date">` llama a `guardarCampana` sin pasar por ningún botón
 * de guardar y sin validar nada. Y un campo de fecha vaciado —la equis del
 * navegador, o seleccionar y borrar para reescribirlo— devuelve cadena vacía.
 *
 * `getCampana` hacía `{ ...loDeFábrica, ...loGuardado }`, así que esa cadena
 * vacía machacaba el valor de fábrica. A partir de ahí:
 *
 *   · `diasHasta('')` da NaN,
 *   · `NaN <= 0` es falso, así que `ventanaAbiertaPara` dice que NO para todo
 *     el mundo,
 *   · y ningún hermano puede pedir su papeleta.
 *
 * Sin error, sin aviso y sin nada en pantalla que lo explique: simplemente
 * deja de salir el botón. El Hermano Mayor que abrió los ajustes para cambiar
 * una fecha ha cerrado la campaña sin enterarse.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/campana.ts')
  const CLAVE = 'cabildo-campana'

  // Una campaña abierta de verdad: empezó hace tiempo y acaba dentro de mucho.
  const anio = new Date().getFullYear()
  const buena = {
    anio: anio + 1,
    fechaInicioParticiparon: `${anio - 1}-01-15`,
    fechaInicioNoParticiparon: `${anio - 1}-02-01`,
    fechaLimiteRenovacion: `${anio + 5}-02-28`,
    fechaSalida: `${anio + 5}-03-28`,
  }

  localStorage.setItem(CLAVE, JSON.stringify(buena))
  caso('con las fechas puestas, la ventana está abierta', true,
    m.ventanaAbiertaPara(m.getCampana(), true))

  // Y ahora el Hermano Mayor vacía una para reescribirla.
  localStorage.setItem(CLAVE, JSON.stringify({ ...buena, fechaInicioParticiparon: '' }))
  const c = m.getCampana()
  caso('una fecha vacía no se queda guardada', true, c.fechaInicioParticiparon !== '')
  caso('y la ventana sigue abierta', true, m.ventanaAbiertaPara(c, true))

  // Lo mismo con la fecha límite, que es la que cierra el plazo a todos.
  localStorage.setItem(CLAVE, JSON.stringify({ ...buena, fechaLimiteRenovacion: '' }))
  caso('vaciar el fin del plazo tampoco lo cierra', true, m.ventanaAbierta(m.getCampana()))

  // Y una fecha a medio escribir tampoco («2027-0», «no es fecha»).
  for (const basura of ['2027-0', 'no es una fecha', '31/02/2027']) {
    localStorage.setItem(CLAVE, JSON.stringify({ ...buena, fechaLimiteRenovacion: basura }))
    caso(`«${basura}» no cierra el plazo`, true, m.ventanaAbierta(m.getCampana()))
  }

  // Lo que SÍ tiene que seguir mandando: una fecha buena, aunque cierre.
  localStorage.setItem(CLAVE, JSON.stringify({ ...buena, fechaLimiteRenovacion: `${anio - 3}-02-28` }))
  caso('una fecha pasada de verdad sí cierra el plazo', false, m.ventanaAbierta(m.getCampana()))
  // Y el año, que es un número y no una fecha, se respeta tal cual.
  caso('el año de la campaña se respeta', anio + 1, m.getCampana().anio)
}
