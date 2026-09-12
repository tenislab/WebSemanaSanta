/**
 * Qué datos de contacto salen publicados en la web.
 *
 * LA REGLA, Y POR QUÉ CAMBIÓ.
 *
 * Antes, un campo vacío en el editor de la web publicaba lo que hubiera en
 * Configuración. Llegó dicho así: «el contacto de la web pone mis datos, no
 * los de la hermandad» — y era verdad: su dirección, su móvil y su gmail, a la
 * vista de cualquiera. Se intentó arreglar avisando (enseñar debajo del campo
 * lo que se estaba publicando, en vez de como placeholder gris), y aun así
 * volvió: «sigue apareciendo mi ubicación por defecto». El aviso lo cuenta,
 * pero no lo quita.
 *
 * Así que ya no se hereda. Configuración es INTERNO —identifica legalmente a
 * la hermandad en los recibos— y la web es PÚBLICA; que lo público herede lo
 * interno sin que nadie lo elija es exactamente lo que publica un móvil
 * personal. Ahora la web publica SOLO lo que se escribe en su pestaña de
 * Contacto, y vacío no publica nada.
 *
 * Lo cómodo no se pierde: el editor ofrece copiar el dato de Configuración de
 * un clic (`loQueHayEnConfiguracion`), y entonces queda escrito en el campo de
 * la web —a la vista, y decidido por alguien.
 */

/** De dónde sale el valor que se publica. Ya no hay herencia: o se escribió, o no hay. */
export type Origen = 'web' | 'nada'

export interface DatoPublicado {
  /** Lo que ve quien entra en la web. Cadena vacía si no se publica nada. */
  valor: string
  origen: Origen
}

function elegir(propio: string): DatoPublicado {
  if (propio.trim()) return { valor: propio.trim(), origen: 'web' }
  return { valor: '', origen: 'nada' }
}

/**
 * Lo que se publica en «Contacto», campo por campo.
 *
 * Es la MISMA regla que pinta la web (`web.x`, sin herencia). Si algún día
 * cambia una, tiene que cambiar la otra: por eso hay una prueba que compara
 * las dos contra los mismos datos en vez de leer el código.
 */
export function contactoQueSePublica(
  web: { direccion: string; telefono: string; email: string },
): { direccion: DatoPublicado; telefono: DatoPublicado; email: DatoPublicado } {
  return {
    direccion: elegir(web.direccion),
    telefono: elegir(web.telefono),
    email: elegir(web.email),
  }
}

/**
 * El dato de Configuración, para OFRECERLO en el editor —no para publicarlo.
 *
 * Devuelve cadena vacía si no hay nada que ofrecer. El editor lo enseña detrás
 * de un botón: copiarlo lo escribe en el campo de la web, y a partir de ahí se
 * publica porque alguien lo ha decidido.
 */
export function loQueHayEnConfiguracion(
  hermandad: { direccion: string; telefono: string; email: string },
  campo: 'direccion' | 'telefono' | 'email',
): string {
  return hermandad[campo].trim()
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
 * Avisa de lo que SE VA A PUBLICAR, escrito a mano o copiado de Configuración
 * de un clic. Antes solo avisaba de lo heredado —«si lo escribe, ya lo ha
 * decidido»—, pero desde que copiar es un botón, «decidido» puede ser un clic
 * despistado, y el dato termina igual de público.
 */
export function avisoDeDatoPersonal(d: DatoPublicado, campo: 'email' | 'telefono'): string | null {
  if (!d.valor) return null
  if (campo === 'email' && correoDePersona(d.valor)) {
    return 'Ese correo parece personal, no de la hermandad. En la web lo ve cualquiera.'
  }
  if (campo === 'telefono' && telefonoDeMovil(d.valor)) {
    return 'Ese número es un móvil. En la web lo ve cualquiera.'
  }
  return null
}

/** Cómo se explica debajo del campo lo que se publica. */
export function comoSeExplica(d: DatoPublicado): string {
  if (d.origen === 'web') return ''
  return 'Vacío: en la web no aparece nada aquí.'
}
