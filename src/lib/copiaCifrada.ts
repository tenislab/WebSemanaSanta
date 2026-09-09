/**
 * LA COPIA DE SEGURIDAD, CIFRADA.
 *
 * ============================================================================
 * POR QUÉ AQUÍ IMPORTA MÁS QUE EN NINGÚN OTRO SITIO
 * ============================================================================
 *
 * `backup.ts` descarga UN ARCHIVO CON TODO: las cuatrocientas fichas con su
 * DNI, su dirección, su teléfono, su fecha de nacimiento, sus cuotas y sus
 * IBAN. En claro.
 *
 * Y ese archivo acaba en el escritorio de la secretaria, en un pendrive, en un
 * adjunto de correo o en el WhatsApp de la junta — que es exactamente lo que la
 * gente hace con un archivo que se llama «copia de seguridad».
 *
 * Es el dato más sensible que maneja la aplicación y era el único que salía de
 * ella sin ninguna protección.
 *
 * ----------------------------------------------------------------------------
 * LA DECISIÓN QUE HAY QUE TOMAR CON LOS OJOS ABIERTOS
 * ----------------------------------------------------------------------------
 *
 * UNA COPIA CIFRADA CUYA CONTRASEÑA SE PIERDE ES UNA COPIA QUE YA NO EXISTE.
 *
 * No hay «recuperar contraseña» que valga: si lo hubiera, el cifrado no
 * serviría de nada. Y el censo es justo el dato que no se puede volver a
 * escribir — cuatrocientas fichas con su antigüedad, su cuota y su sitio en el
 * cortejo no se reconstruyen.
 *
 * O sea que esto CAMBIA UNA AMENAZA POR OTRA: antes el riesgo era que la copia
 * acabara donde no debe; ahora es quedarse fuera de la propia copia. Las dos
 * son reales, y la segunda pasa más a menudo.
 *
 * De ahí las tres reglas de este fichero:
 *
 *   1. Se avisa con todas las letras antes de poner la contraseña, y se pide
 *      dos veces (eso lo hace la pantalla).
 *   2. SE COMPRUEBA QUE DESCIFRA ANTES DE DAR EL ARCHIVO POR BUENO. Una copia
 *      que no se puede abrir es peor que ninguna, porque se cree que se tiene.
 *      Es lo mismo que hace `copiaAutomatica.ts` al negarse a subir una copia
 *      coja.
 *   3. La copia automática semanal NO se cifra, y es a propósito: vive en el
 *      cubo de la propia hermandad, protegida por sus permisos, y la lanza sola
 *      la aplicación. No hay nadie a quien pedirle una contraseña a las tres de
 *      la mañana, y guardar la clave al lado de los datos es no cifrar nada con
 *      pasos de más.
 *
 * ----------------------------------------------------------------------------
 * CÓMO ESTÁ CIFRADO, Y POR QUÉ ASÍ
 * ----------------------------------------------------------------------------
 *
 * Con `crypto.subtle`, que ya trae el navegador: ni una dependencia nueva. Lo
 * mismo que usa el webhook de Stripe para comprobar firmas.
 *
 *   · PBKDF2 con SHA-256 para convertir la contraseña en una clave. Una
 *     contraseña de persona («LaVeraCruz2027») es adivinable a base de probar;
 *     las vueltas son lo que hace que probar salga caro. 310.000 es lo que
 *     recomienda OWASP para SHA-256 y lo que tarda como medio segundo en un
 *     ordenador normal — molesta poco al que abre su copia y mucho al que
 *     prueba millones.
 *   · AES-GCM de 256 bits para cifrar. GCM y no CBC porque además de cifrar
 *     AUTENTICA: si alguien cambia un byte del archivo, al abrirlo falla en vez
 *     de devolver basura. En una copia de seguridad, devolver basura sería
 *     restaurarla encima del censo bueno.
 *   · Sal e IV nuevos en cada copia, guardados dentro del propio archivo. La
 *     sal impide que dos hermandades con la misma contraseña tengan la misma
 *     clave; el IV, que dos copias de la misma hermandad se parezcan.
 *
 * Nada de esto es original: es lo que hay que hacer, escrito para que quien lo
 * lea dentro de tres años sepa por qué no se toca.
 */

/** La envoltura que se guarda en el archivo. Todo lo que hace falta para abrirla, menos la contraseña. */
export interface CopiaCifrada {
  /**
   * La marca por la que se reconoce el formato.
   *
   * Sin ella, al abrir un archivo cifrado la aplicación intentaría
   * interpretarlo como una copia normal, no lo entendería y diría «este archivo
   * no es una copia de Gobergo» — que es mentira y manda a la hermandad a
   * buscar el problema donde no está. Con esto se dice lo que es: «esta copia
   * está cifrada, hace falta la contraseña».
   */
  formato: 'gobergo-copia-cifrada'
  /** Por si algún día cambia el cifrado y hay que saber abrir las viejas. */
  version: 1
  /** Nombre de la hermandad, EN CLARO y a propósito. Ver abajo. */
  hermandad: string
  /** Día en que se hizo, en claro por lo mismo. */
  fecha: string
  /** Base64. */
  sal: string
  iv: string
  datos: string
}

export const FORMATO = 'gobergo-copia-cifrada'

/**
 * LAS VUELTAS DE PBKDF2. Lo que recomienda OWASP para SHA-256.
 *
 * Se exporta para que la prueba compruebe que no ha bajado. Bajarlo «porque
 * tarda» es la forma silenciosa de dejar la copia sin protección: sigue
 * cifrada, sigue abriéndose, y adivinar la contraseña pasa a costar horas en
 * vez de siglos.
 */
export const VUELTAS = 310_000

/**
 * LO MÍNIMO QUE PUEDE MEDIR UNA CONTRASEÑA.
 *
 * Ocho es poco para un cifrado y mucho para una hermandad: es un número que la
 * gente acepta escribir dos veces. Lo que de verdad protege no es la longitud
 * mínima sino las vueltas de arriba; esto solo evita el «1234».
 */
export const MINIMO_CONTRASENA = 8

/** ¿Este objeto es una copia cifrada nuestra? */
export function esCopiaCifrada(obj: unknown): obj is CopiaCifrada {
  const o = obj as Partial<CopiaCifrada> | null
  return !!o && typeof o === 'object'
    && o.formato === FORMATO
    && typeof o.sal === 'string' && typeof o.iv === 'string' && typeof o.datos === 'string'
}

/**
 * ¿Vale esta contraseña? Y si no, por qué no.
 *
 * Misma forma que `sePuedeConvocar()` y `sePuedePersonalizar()`, por el mismo
 * motivo: un «no» sin explicación se lee como una avería.
 */
export function revisarContrasena(clave: string, repetida: string): { puede: boolean; motivo: string } {
  if (clave.length < MINIMO_CONTRASENA) {
    return {
      puede: false,
      motivo: `La contraseña tiene que tener al menos ${MINIMO_CONTRASENA} caracteres.`,
    }
  }
  /*
   * SE PIDE DOS VECES, y es la comprobación que más veces va a salvar a
   * alguien. Una errata al escribirla no se descubre al descargar —el archivo
   * sale igual de bien— sino el día que hace falta abrirlo, que es el peor día
   * posible y ya sin remedio.
   */
  if (clave !== repetida) {
    return { puede: false, motivo: 'Las dos contraseñas no son iguales. Escríbelas otra vez.' }
  }
  return { puede: true, motivo: '' }
}

/* --------------------------- de bytes a texto y al revés ------------------- */

function aBase64(b: ArrayBuffer | Uint8Array): string {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  // De mil en mil: `String.fromCharCode(...bytes)` con un censo entero revienta
  // la pila de llamadas del navegador. Con cuatrocientas fichas son megas.
  for (let i = 0; i < bytes.length; i += 1000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 1000))
  }
  return btoa(s)
}

function deBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** La contraseña, convertida en clave de cifrado. Es la parte lenta, a propósito. */
async function claveDesde(contrasena: string, sal: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal as unknown as BufferSource, iterations: VUELTAS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * CIFRA UNA COPIA.
 *
 * `hermandad` y `fecha` se guardan EN CLARO, y es deliberado: quien tenga tres
 * archivos en un pendrive tiene que poder saber cuál es cuál sin abrirlos. Y no
 * revelan nada que no diga ya el nombre del fichero.
 */
export async function cifrarCopia(
  contenido: string,
  contrasena: string,
  datos: { hermandad: string; fecha: string },
): Promise<CopiaCifrada> {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const clave = await claveDesde(contrasena, sal)
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    clave,
    new TextEncoder().encode(contenido),
  )
  return {
    formato: FORMATO,
    version: 1,
    hermandad: datos.hermandad,
    fecha: datos.fecha,
    sal: aBase64(sal),
    iv: aBase64(iv),
    datos: aBase64(cifrado),
  }
}

/**
 * ABRE UNA COPIA CIFRADA. Devuelve `null` si la contraseña no es.
 *
 * `null` y no una excepción porque la contraseña equivocada NO ES UN ERROR DEL
 * PROGRAMA: es lo que pasa cuando alguien se equivoca al teclear, que es a
 * diario. Quien llama tiene que poder decir «esa no es» sin envolverlo en un
 * `try`.
 *
 * Y por AES-GCM, un archivo tocado por el camino también da `null` en vez de
 * devolver basura. En una copia de seguridad eso importa: la basura se
 * restauraría encima del censo bueno.
 */
export async function abrirCopiaCifrada(copia: CopiaCifrada, contrasena: string): Promise<string | null> {
  try {
    const clave = await claveDesde(contrasena, deBase64(copia.sal))
    const claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: deBase64(copia.iv) as unknown as BufferSource },
      clave,
      deBase64(copia.datos) as unknown as BufferSource,
    )
    return new TextDecoder().decode(claro)
  } catch {
    return null
  }
}

/**
 * CIFRA Y COMPRUEBA QUE SE PUEDE ABRIR. Es la que hay que usar.
 *
 * ============================================================================
 * POR QUÉ SE VUELVE A ABRIR LO QUE SE ACABA DE CERRAR
 * ============================================================================
 *
 * Porque una copia que no se puede abrir es peor que no tener copia: la
 * hermandad cree que la tiene. Se descubre el día que hace falta, que por
 * definición es el peor día.
 *
 * Cuesta otro medio segundo y descarta de golpe toda una familia de fallos —un
 * navegador con `crypto.subtle` a medias, un fallo de memoria a mitad de un
 * censo grande, una futura equivocación mía cambiando el formato— sin tener que
 * haberlos previsto uno a uno.
 *
 * Es la misma idea que ya está en `copiaAutomatica.ts`, que se niega a subir
 * una copia a la que le falta una tabla.
 */
export async function cifrarYComprobar(
  contenido: string,
  contrasena: string,
  datos: { hermandad: string; fecha: string },
): Promise<{ copia: CopiaCifrada } | { error: string }> {
  const copia = await cifrarCopia(contenido, contrasena, datos)
  const devuelta = await abrirCopiaCifrada(copia, contrasena)
  if (devuelta !== contenido) {
    return {
      error:
        'La copia se ha cifrado pero NO se ha podido volver a abrir, así que no se descarga: '
        + 'una copia que no se abre es peor que no tener ninguna. '
        + 'Prueba en otro navegador, o descárgala sin cifrar y guárdala en sitio seguro.',
    }
  }
  return { copia }
}
