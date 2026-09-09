/**
 * Qué datos de contacto sale publicados en la web, y de dónde vienen.
 *
 * En el editor de la web los tres campos —dirección, teléfono y correo— se
 * pueden dejar vacíos, y entonces se publica lo que haya en Configuración.
 * Eso estaba escrito en una línea encima de los campos, y el valor heredado se
 * enseñaba como «placeholder».
 *
 * No bastaba. Un placeholder es texto gris: todo el mundo lo lee como un
 * ejemplo de lo que podrías escribir, no como lo que ya está publicado. El
 * resultado fue una web con el correo personal y el móvil personal del
 * secretario a la vista de cualquiera, con los tres campos aparentemente
 * vacíos y sin que nadie hubiera decidido publicar eso.
 *
 * Así que aquí se calcula LO QUE SE VE en la web, para poder enseñarlo tal
 * cual debajo de cada campo, y se avisa cuando lo que se va a publicar tiene
 * pinta de ser de una persona y no de la hermandad.
 */

/** De dónde sale el valor que se publica. */
export type Origen = 'web' | 'hermandad' | 'nada'

export interface DatoPublicado {
  /** Lo que ve quien entra en la web. Cadena vacía si no se publica nada. */
  valor: string
  origen: Origen
}

function elegir(propio: string, heredado: string): DatoPublicado {
  if (propio.trim()) return { valor: propio.trim(), origen: 'web' }
  if (heredado.trim()) return { valor: heredado.trim(), origen: 'hermandad' }
  return { valor: '', origen: 'nada' }
}

/**
 * Lo que se publica en «Contacto», campo por campo.
 *
 * Es la MISMA regla que pinta la web (`web.x || hermandad.x`). Si algún día
 * cambia una, tiene que cambiar la otra: por eso hay una prueba que compara
 * las dos contra los mismos datos en vez de leer el código.
 */
export function contactoQueSePublica(
  web: { direccion: string; telefono: string; email: string },
  hermandad: { direccion: string; telefono: string; email: string },
): { direccion: DatoPublicado; telefono: DatoPublicado; email: DatoPublicado } {
  return {
    direccion: elegir(web.direccion, hermandad.direccion),
    telefono: elegir(web.telefono, hermandad.telefono),
    email: elegir(web.email, hermandad.email),
  }
}

/**
 * Correos de andar por casa. No es una lista de «proveedores malos»: es que un
 * correo en uno de estos dominios casi nunca es el de la secretaría de una
 * hermandad, y publicarlo en la web es publicar el correo personal de alguien.
 */
const DOMINIOS_DE_PERSONA = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com',
  'outlook.es', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.es', 'icloud.com',
  'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'gmx.es',
  'gmx.com', 'terra.es', 'telefonica.net', 'movistar.es', 'ono.com', 'yandex.com',
]

/** ¿Ese correo parece de una persona y no de la hermandad? */
export function correoDePersona(email: string): boolean {
  const dominio = email.trim().toLowerCase().split('@')[1]
  return Boolean(dominio) && DOMINIOS_DE_PERSONA.includes(dominio)
}

/**
 * Un móvil español (empieza por 6 o 7) publicado como teléfono de la hermandad.
 * No es un error —muchas hermandades pequeñas atienden por móvil— pero conviene
 * que sea una decisión y no un descuido.
 */
export function telefonoDeMovil(tel: string): boolean {
  const solo = tel.replace(/[\s.-]/g, '').replace(/^\+34/, '')
  return /^[67]\d{8}$/.test(solo)
}

/**
 * El aviso que se enseña debajo del campo, o null si no hay nada que decir.
 *
 * Solo avisa de lo HEREDADO: si alguien escribe su gmail a propósito en el
 * campo de la web, ya ha decidido. Lo que se quiere cazar es el dato que se
 * publica sin que nadie lo haya mirado.
 */
export function avisoDeDatoPersonal(d: DatoPublicado, campo: 'email' | 'telefono'): string | null {
  if (d.origen !== 'hermandad' || !d.valor) return null
  if (campo === 'email' && correoDePersona(d.valor)) {
    return 'Ese correo parece personal, no de la hermandad. En la web lo ve cualquiera.'
  }
  if (campo === 'telefono' && telefonoDeMovil(d.valor)) {
    return 'Ese número es un móvil. En la web lo ve cualquiera.'
  }
  return null
}

/** Cómo se explica el origen debajo del campo. */
export function comoSeExplica(d: DatoPublicado): string {
  if (d.origen === 'web') return ''
  if (d.origen === 'hermandad') return `Ahora se publica ${d.valor}, que es lo que hay en Configuración.`
  return 'No se publica nada en este campo.'
}
