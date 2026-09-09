/**
 * «HOLA {nombre}»: QUE CADA COMUNICADO LLEGUE CON EL NOMBRE DE QUIEN LO LEE.
 *
 * ============================================================================
 * QUÉ HABÍA ANTES
 * ============================================================================
 *
 * Nada. Ni un solo sitio del proyecto sustituía nada dentro del texto de un
 * comunicado: se escribía una vez y salía idéntico para los ochocientos.
 *
 * ----------------------------------------------------------------------------
 * LA REGLA QUE MANDA EN TODO ESTE FICHERO
 * ----------------------------------------------------------------------------
 *
 * UN CORREO A OCHOCIENTAS PERSONAS NO SE PUEDE DESHACER.
 *
 * De ahí sale todo lo demás. Si alguien escribe `{nombe}`, lo que NO puede
 * pasar es que salgan ochocientos correos diciendo «Hola {nombe}». Se avisa al
 * escribir y se bloquea el envío, igual que `acreedorIncompleto()` con el
 * fichero SEPA: no dejar generar algo que va a salir mal en casa de otro.
 *
 * Por eso `marcasDesconocidas()` existe y por eso la pantalla la usa antes de
 * dejar mandar nada.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ ESTAS MARCAS Y NO CUARENTA
 * ----------------------------------------------------------------------------
 *
 * Porque cada marca es una forma más de equivocarse, y porque una lista larga
 * no la lee nadie. Están las que se usan de verdad en un comunicado de
 * hermandad y ninguna más. Añadir una es una línea; quitarla, cuando ya hay
 * comunicados guardados que la usan, no.
 */
/**
 * A QUIÉN SE LE PERSONALIZA. No es `Hermano` entero a propósito.
 *
 * A un comunicado no solo le llegan hermanos: también la junta que tiene cuenta
 * pero no ficha en el censo, y los suscriptores de la web —vecinos y devotos
 * que se apuntaron—. Esos tienen nombre y correo, y NO tienen número de
 * hermano, porque no lo son.
 *
 * Pedir aquí un `Hermano` completo obligaría a inventarles uno, y un número
 * inventado acabaría impreso en un correo: «hermano nº 0». Por eso el número es
 * opcional y, cuando falta, `{numero}` se queda vacío en vez de mentir.
 */
export interface AQuienSeLeEscribe {
  nombre: string
  numero?: number | null
}

/**
 * LAS MARCAS, con lo que hace cada una y un ejemplo.
 *
 * El ejemplo NO es decoración: es lo que se enseña en la ayuda del editor, y
 * es lo único que va a leer quien escriba el comunicado.
 */
export const MARCAS = [
  { marca: 'nombre', que: 'El nombre de pila', ejemplo: 'José' },
  { marca: 'nombrecompleto', que: 'El nombre tal como está en la ficha', ejemplo: 'José Antonio Rivas Delgado' },
  { marca: 'numero', que: 'Su número de hermano', ejemplo: '142' },
  { marca: 'hermandad', que: 'El nombre de la hermandad', ejemplo: 'Hermandad de la Vera-Cruz' },
  { marca: 'ejercicio', que: 'El año en curso', ejemplo: '2027' },
] as const

export type NombreDeMarca = typeof MARCAS[number]['marca']

/** Lo que hace falta saber para rellenar las marcas que no salen del hermano. */
export interface ContextoPersonalizacion {
  hermandad?: string
  ejercicio?: number | string
}

/**
 * EL NOMBRE DE PILA, sacado de un campo que trae el nombre entero.
 *
 * En la ficha hay UN campo `nombre` con todo dentro, así que el nombre de pila
 * hay que deducirlo. Y aquí es donde un censo de verdad se venga de quien
 * escribió la función pensando en «Jaime Rivas»:
 *
 *   · «RIVAS DELGADO, JOSÉ ANTONIO» — es como lo exporta media aplicación de
 *     gestión y como llegan la mitad de los Excel que se importan. Con la
 *     primera palabra saldría «Hola RIVAS». Si hay coma, el nombre va DETRÁS.
 *
 *   · «JOSÉ ANTONIO RIVAS DELGADO» — los censos importados vienen en
 *     mayúsculas muy a menudo. «Hola JOSÉ» es un correo que grita. Si el nombre
 *     entero está en mayúsculas, se le baja el tono; si no —«Jaime», «McCarthy»,
 *     «de la Cruz»— no se toca nada, porque quien lo escribió así lo escribió a
 *     propósito.
 *
 * Lo que NO se intenta es adivinar nombres compuestos: «José Antonio» devuelve
 * «José», y está bien. En España a nadie le extraña que le llamen por el
 * primero, y el intento de adivinarlo acierta a veces y falla el resto, que en
 * un correo con nombre propio es peor que no intentarlo.
 */
export function nombreDePila(nombreCompleto: string): string {
  const limpio = (nombreCompleto ?? '').trim().replace(/\s+/g, ' ')
  if (!limpio) return ''
  // Con coma, los apellidos van delante: el nombre es lo de después.
  const trasLaComa = limpio.includes(',') ? limpio.slice(limpio.indexOf(',') + 1).trim() : limpio
  const primera = trasLaComa.split(' ')[0] ?? ''
  return enMayusculasEnteras(primera) ? capitalizar(primera) : primera
}

/** ¿Está TODO en mayúsculas? (Se ignoran los caracteres que no son letras.) */
function enMayusculasEnteras(t: string): boolean {
  const letras = t.replace(/[^\p{L}]/gu, '')
  return letras.length > 1 && letras === letras.toLocaleUpperCase('es')
}

function capitalizar(t: string): string {
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1).toLocaleLowerCase('es')
}

/**
 * Con qué se reemplaza cada marca para ESTE hermano.
 *
 * Se saca aparte de `personalizar()` para poder enseñarlo en la vista previa y
 * para que la prueba mire el valor y no el texto ya montado.
 */
export function valoresPara(
  hermano: AQuienSeLeEscribe,
  contexto: ContextoPersonalizacion = {},
): Record<NombreDeMarca, string> {
  return {
    nombre: nombreDePila(hermano.nombre),
    nombrecompleto: (hermano.nombre ?? '').trim(),
    numero: hermano.numero != null ? String(hermano.numero) : '',
    hermandad: (contexto.hermandad ?? '').trim(),
    ejercicio: contexto.ejercicio != null ? String(contexto.ejercicio) : '',
  }
}

/** Todas las marcas escritas en un texto, en el orden en que aparecen. */
export function marcasUsadas(texto: string): string[] {
  return [...(texto ?? '').matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1])
}

/**
 * LAS QUE NO EXISTEN. Es la función que evita el desastre.
 *
 * Devuelve, sin repetir, las marcas escritas que no reconocemos. Mientras esta
 * lista no esté vacía, no se manda nada.
 *
 * Se compara en minúsculas porque quien escribe `{Nombre}` quiere `{nombre}`, y
 * plantarse por una mayúscula sería un freno que no protege de nada. Lo que sí
 * se caza es `{nombe}`, que es el error de verdad.
 */
export function marcasDesconocidas(texto: string): string[] {
  const buenas = new Set(MARCAS.map((m) => m.marca as string))
  const fuera = marcasUsadas(texto).filter((m) => !buenas.has(m.toLowerCase()))
  return [...new Set(fuera)]
}

/** ¿Este texto lleva alguna marca? Si no, no hace falta personalizar nada. */
export function llevaMarcas(texto: string): boolean {
  return marcasUsadas(texto).length > 0
}

/**
 * SUSTITUYE LAS MARCAS por los datos de este hermano.
 *
 * DOS DECISIONES QUE PARECEN DETALLES Y NO LO SON:
 *
 * 1. UNA MARCA DESCONOCIDA SE DEJA TAL CUAL, no se borra. Aquí no se puede
 *    fallar —esto corre en mitad de un envío— así que el freno está antes, al
 *    escribir. Y si aun así llegara una: dejar `{nombe}` visible hace que
 *    alguien lo vea y lo arregle; borrarlo deja una frase mutilada que parece
 *    escrita así.
 *
 * 2. UN DATO VACÍO USA SU RESERVA, y por eso `reserva` existe. Hay hermanos sin
 *    número y hermandades sin nombre legal puesto. «Hola ,» es peor que no
 *    personalizar: la reserva de `{nombre}` es «hermano/a», que es exactamente
 *    lo que se escribiría a mano.
 */
const RESERVA: Record<NombreDeMarca, string> = {
  nombre: 'hermano/a',
  nombrecompleto: 'hermano/a',
  numero: '',
  hermandad: 'la hermandad',
  ejercicio: '',
}

export function personalizar(
  texto: string,
  hermano: AQuienSeLeEscribe,
  contexto: ContextoPersonalizacion = {},
): string {
  const valores = valoresPara(hermano, contexto)
  return (texto ?? '').replace(/\{([a-zA-Z]+)\}/g, (entero, nombre: string) => {
    const clave = nombre.toLowerCase() as NombreDeMarca
    if (!(clave in valores)) return entero            // desconocida: se deja ver
    const v = valores[clave]
    return v !== '' ? v : RESERVA[clave]
  })
}

/**
 * LA VISTA PREVIA, con UNA persona de verdad del propio segmento.
 *
 * Una vista previa que enseña `{nombre}` en crudo no es una vista previa: es el
 * mismo texto que ya se está escribiendo. Lo que hay que ver antes de mandar es
 * cómo le va a llegar a alguien, con su nombre puesto — y con las reservas
 * puestas también, que es donde se ve si hay fichas sin datos.
 *
 * Sin nadie a quien enseñárselo se usan los ejemplos de `MARCAS`, para que la
 * ayuda del editor se pueda leer aunque el censo esté vacío.
 */
export function vistaPrevia(
  texto: string,
  hermano: AQuienSeLeEscribe | null,
  contexto: ContextoPersonalizacion = {},
): string {
  if (hermano) return personalizar(texto, hermano, contexto)
  const ejemplos = Object.fromEntries(MARCAS.map((m) => [m.marca, m.ejemplo]))
  return (texto ?? '').replace(/\{([a-zA-Z]+)\}/g, (entero, n: string) =>
    ejemplos[n.toLowerCase()] ?? entero)
}

/**
 * ¿SE PUEDE MANDAR ESTE TEXTO? Y si no, por qué no.
 *
 * Misma forma que `sePuedeConvocar()` en `campana.ts`, y por el mismo motivo:
 * un freno que dice «no» sin decir por qué se lee como una avería.
 */
export function sePuedePersonalizar(texto: string): { puede: boolean; motivo: string } {
  const malas = marcasDesconocidas(texto)
  if (malas.length === 0) return { puede: true, motivo: '' }
  const lista = malas.map((m) => `{${m}}`).join(', ')
  const conocidas = MARCAS.map((m) => `{${m.marca}}`).join(', ')
  return {
    puede: false,
    motivo:
      `${malas.length === 1 ? 'Hay una marca que no existe' : 'Hay marcas que no existen'}: ${lista}. `
      + `Se mandaría tal cual, escrito entre llaves, a todos los destinatarios. `
      + `Las que valen son: ${conocidas}.`,
  }
}
