/**
 * LO QUE DICE POSTGRES → LO QUE HAY QUE HACER.
 *
 * Llegó así, tal cual, en la pantalla de un secretario:
 *
 *     crear: new row violates row-level security policy for table "hermanos"
 *
 * Eso es correcto y es inútil. Dice que la base ha dicho que no, y no dice lo
 * único que importa: QUÉ le falta a esa cuenta y a dónde ir a arreglarlo. Con
 * ese mensaje delante, el usuario no puede hacer nada más que llamar.
 *
 * Y detrás de ese aviso había tres cosas que parecían tres fallos distintos:
 * el censo importado del Excel «desaparecía» al recargar, no se podían aceptar
 * altas nuevas, y no se podía crear un hermano a mano. Las tres eran el mismo
 * rechazo: la fila no entraba, pero la pantalla ya la tenía pintada.
 *
 * Aquí se traduce. No se inventa el motivo —eso lo dice el diagnóstico— pero
 * sí se dice de qué familia es el problema y cuál es el siguiente paso.
 */

export interface ErrorTraducido {
  /** Lo que se le enseña a quien está delante. */
  mensaje: string
  /** Qué hacer, en imperativo. */
  queHacer: string
  /** El texto original de Postgres, para copiar y pegar si hay que preguntar. */
  original: string
}

/** Nombre de tabla → cómo lo llama la gente que usa la aplicación. */
const EN_CRISTIANO: Record<string, string> = {
  hermanos: 'el censo de hermanos',
  papeletas: 'las papeletas de sitio',
  cuotas: 'las cuotas',
  tramos: 'los tramos del cortejo',
  movimientos: 'la tesorería',
  personal: 'el personal de la junta',
  solicitudes_alta: 'las solicitudes de alta',
  comunicados: 'los comunicados',
  eventos: 'los eventos',
  enseres: 'el inventario',
  documentos: 'el archivo documental',
  cuentas_sociales: 'las redes sociales',
  web_publica: 'la web pública',
}

function comoSeLlama(tabla: string): string {
  return EN_CRISTIANO[tabla] ?? `«${tabla}»`
}

/**
 * ¿Es un rechazo de la frontera de seguridad?
 *
 * Postgres lo dice de dos maneras según la operación, y hay que mirar las dos:
 * el `insert` da el texto largo, y el código `42501` es el de «no tienes
 * permiso» a secas.
 */
export function esRechazoDePermisos(mensaje: string, codigo?: string): boolean {
  return codigo === '42501' || /row-level security policy/i.test(mensaje)
}

/**
 * Traduce el error de una escritura.
 *
 * `tabla` es la tabla de la base; `operacion` lo que se estaba haciendo, dicho
 * como lo diría quien lo estaba haciendo («crear», «guardar», «borrar»).
 */
export function traducirErrorDeEscritura(
  tabla: string,
  operacion: string,
  mensaje: string,
  codigo?: string,
): ErrorTraducido {
  const cosa = comoSeLlama(tabla)

  if (esRechazoDePermisos(mensaje, codigo)) {
    return {
      mensaje:
        `Tu cuenta no tiene permiso para escribir en ${cosa}, así que no se ha guardado nada. `
        + 'Lo que ves en pantalla no está en la base de datos: al recargar habrá desaparecido.',
      /*
       * El motivo casi siempre es el mismo y es de los que no se adivinan: LEER
       * el censo se permite con cualquiera de siete módulos, pero ESCRIBIR
       * exige el módulo concreto. Un cargo sin «hermanos» ve la lista entera,
       * el botón de crear está ahí, y al guardar rechazo — que se lee como que
       * la aplicación está rota.
       */
      queHacer:
        'Entra con la cuenta titular (la que creó la hermandad), que lo puede todo; o ve a '
        + 'Personal y permisos y dale a tu cargo ese módulo. Para saber exactamente qué falta, '
        + 'ejecuta supabase/POR-QUE-NO-PUEDO.sql en Supabase.',
      original: mensaje,
    }
  }

  /*
   * La otra grande: una columna que la aplicación escribe y la base no tiene.
   * Postgres NO ignora la columna que sobra — rechaza la operación entera—, así
   * que no se pierde un campo: no se guarda la fila. Es lo que hizo que durante
   * semanas no se guardara ni un tramo.
   */
  const columna = mensaje.match(/column "([^"]+)"[^"]*does not exist/i)
  if (columna) {
    return {
      mensaje:
        `Esta base de datos no tiene la columna «${columna[1]}», que la aplicación necesita `
        + `para guardar ${cosa}. No se ha guardado nada.`,
      queHacer: 'Ejecuta supabase/TODO-EN-UNO.sql en Supabase para ponerla al día.',
      original: mensaje,
    }
  }

  // Algo repetido: un DNI, un número de hermano, un correo.
  if (/duplicate key value|already exists/i.test(mensaje)) {
    return {
      mensaje: `Ya existe una ficha con ese dato en ${cosa}, y no puede haber dos.`,
      queHacer: 'Busca la que ya está y edítala, en vez de crear otra.',
      original: mensaje,
    }
  }

  // Lo que no se reconoce se dice tal cual, sin adornarlo: inventarse un motivo
  // es peor que no dar ninguno.
  return {
    mensaje: `No se ha podido ${operacion} en ${cosa}.`,
    queHacer: 'Revisa la conexión y vuelve a intentarlo. Si sigue, copia el texto de abajo.',
    original: mensaje,
  }
}
