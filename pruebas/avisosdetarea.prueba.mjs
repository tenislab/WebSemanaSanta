/**
 * A QUIEN SE LE ENCARGA ALGO, SE LE AVISA.
 *
 * Dos fallos del mismo lote, y los dos son lo mismo visto de dos maneras: una
 * tarea repartida que no llega a la persona que la tiene que hacer.
 *
 *   · «asigno tarea a hermano y no llega notificacion a hermano»
 *   · «no deja asignar hermanos en tareas de redes»
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')

  /*
   * 1. LAS TAREAS DE UN EVENTO AVISAN AL HERMANO.
   *
   * No avisaban a nadie: la tarea se guardaba con su nombre al lado y ahí se
   * quedaba. La única forma de enterarse era que se lo dijeran por WhatsApp o
   * entrar en el panel — y quien no gestiona no entra al panel. O sea que el
   * reparto de tareas de un culto no llegaba a quien lo tenía que hacer, que
   * es todo lo que hace esa pantalla.
   */
  {
    const src = await readFile('src/pages/app/Eventos.tsx', 'utf8')
    caso('Eventos sabe avisar', true, /agregarAvisoHermano/.test(src))

    const fn = src.slice(src.indexOf('function asignarTarea'), src.indexOf('function abrirEvento'))
    caso('y avisa al asignar', true, /agregarAvisoHermano\(/.test(fn))
    caso('con el aviso de encargo', true, /'encargo'/.test(fn))

    /*
     * SOLO A LOS HERMANOS. El personal de la junta y los roles no tienen área
     * de hermano donde recibirlo: avisarles sería escribir en un buzón que no
     * existe.
     */
    caso('solo si es hermano', true, /esRol\(trabajador\.id\)/.test(fn))
    caso('y no del personal', true, /personal\.some/.test(fn))

    /*
     * Y SOLO CUANDO CAMBIA DE PERSONA. Sin esto, corregir el título de una
     * tarea volvería a avisar a quien ya lo sabía — y un aviso repetido se
     * aprende a ignorar, que es como se pierde el que sí importaba.
     */
    caso('solo si cambia de persona', true, /trabajador\.id !== tareaAntes\?\.trabajadorId/.test(fn))
  }

  /*
   * 2. LAS TAREAS DE REDES SE PUEDEN REPARTIR A CUALQUIER HERMANO.
   *
   * Solo se ofrecía a quien tuviera cargo, y la razón escrita era que un
   * hermano de a pie «no podría verlo, porque quien no lleva nada no entra al
   * panel». Eso es FALSO y es lo contrario de para lo que se hizo el módulo:
   * la tarea le sale en SU ÁREA, sin pisar el panel.
   *
   * Con esa restricción, una hermandad que aún no ha repartido cargos se
   * encontraba las dos listas vacías y sin explicación.
   */
  {
    const src = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
    caso('hay una lista de los que no llevan cargo', true, /const otrosHermanos/.test(src))
    caso('y se ofrecen en el desplegable', true, /otrosHermanos\.map/.test(src))
    caso('la junta va aparte y primero', true, /optgroup label="Junta de gobierno"/.test(src))
    caso('y el resto, agrupado', true, /optgroup label="Otros hermanos"/.test(src))
    // Y si de verdad no hay nadie, se dice: un desplegable vacío sin
    // explicación se lee como una avería, no como «te falta un dato».
    caso('si no hay nadie, se explica', true, /hayAQuienEncargar/.test(src))

    // Y que el módulo sigue diciendo que la tarea se ve en el área del hermano,
    // que es lo que hace correcto quitar la restricción.
    const lib = await readFile('src/lib/tareasRedes.ts', 'utf8')
    // El texto va partido en dos líneas y con el asterisco del comentario en
    // medio: se aplasta antes de buscarlo, que si no la prueba falla por cómo
    // está envuelto el párrafo y no por lo que dice.
    const seguido = lib.replace(/\s*\n\s*\*?\s*/g, ' ')
    caso('la tarea se ve en su área, sin entrar al panel', true,
      /la ve en SU área sin entrar al panel/.test(seguido))
    const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
    caso('y el área del hermano las carga de verdad', true, /useTareasRedes/.test(portal))
  }
}
