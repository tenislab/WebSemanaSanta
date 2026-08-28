/**
 * CAMPAÑAS Y PROYECTOS.
 *
 * Lo que se pidió: «hay que crear una parte de campañas y proyectos, en la que
 * las campañas sean recolecciones de dinero con una barra hasta que se llegue
 * al objetivo, y los proyectos que sean como tareas pero a largo plazo».
 *
 * LO QUE MÁS SE COMPRUEBA AQUÍ es que lo recaudado SE CUENTA DESDE TESORERÍA y
 * no se guarda en la campaña. Es la decisión que sostiene todo lo demás, y la
 * que responde a la otra queja del mismo mensaje —«el concepto de cuota no se
 * pasa a tesorería»—: si la barra sube, el tesorero lo tiene, porque son el
 * mismo dato.
 */
export default async function ({ cargar, caso }) {
  const r = await cargar('src/lib/recaudaciones.ts')
  const p = await cargar('src/lib/proyectos.ts')

  const mov = (importe, tipo, origen) => ({ importe, tipo, origen })

  /*
   * 1. LO RECAUDADO SALE DE LOS APUNTES, Y SOLO DE LOS QUE LLEVAN SU MARCA.
   */
  {
    const libro = [
      mov(100, 'Ingreso', 'campana:A:1'),
      mov(50, 'Ingreso', 'campana:A:2'),
      mov(999, 'Ingreso', 'campana:B:1'),   // de otra campaña
      mov(999, 'Ingreso', undefined),        // apuntado a mano, sin campaña
      mov(999, 'Ingreso', 'cuota:x'),        // una cuota
    ]
    caso('suma solo lo suyo', 150, r.loRecaudado(libro, 'A'))
    caso('y lo de la otra, lo suyo', 999, r.loRecaudado(libro, 'B'))
    caso('una campaña sin nada da cero', 0, r.loRecaudado(libro, 'C'))
    caso('cuenta las aportaciones', 2, r.cuantasAportaciones(libro, 'A'))
  }

  /*
   * 2. LOS GASTOS DE LA CAMPAÑA SE RESTAN.
   *
   * Una campaña tiene gastos —la imprenta de las huchas, el transporte— y
   * enseñar lo bruto como si fuera lo disponible es mentir sobre cuánto falta:
   * el paso se paga con el dinero que queda, no con el que pasó por caja.
   */
  {
    const libro = [mov(1000, 'Ingreso', 'campana:A:1'), mov(145, 'Gasto', 'campana:A:g1')]
    caso('el gasto se resta', 855, r.loRecaudado(libro, 'A'))
    caso('pero no cuenta como aportación', 1, r.cuantasAportaciones(libro, 'A'))
  }

  /*
   * 3. LOS CÉNTIMOS. Sumando euros con decimales, treinta donativos dan
   * 1.999,9999999997 — y eso sale en pantalla tal cual.
   */
  {
    const libro = Array.from({ length: 30 }, (_, i) => mov(0.1, 'Ingreso', `campana:A:${i}`))
    caso('treinta veces diez céntimos son tres euros exactos', 3, r.loRecaudado(libro, 'A'))
    caso('y no 2,9999999999999996', true, String(r.loRecaudado(libro, 'A')).length <= 3)
    // Y el «-0», que se imprime «-0,00 €» y asusta a quien lo ve.
    const soloGasto = [mov(0, 'Gasto', 'campana:A:g')]
    caso('cero no sale en negativo', false, Object.is(r.loRecaudado(soloGasto, 'A'), -0))
  }

  /*
   * 4. LA BARRA. SE PASA DE 100 SIN RECORTARSE: que una campaña haya superado
   * el objetivo es la mejor noticia que puede dar esta pantalla, y recortarlo
   * aquí la escondería. La barra se para en el 100 %; el número, no.
   */
  {
    caso('a medias', 50, r.comoVa(500, 1000))
    caso('justo', 100, r.comoVa(1000, 1000))
    caso('pasado, NO se recorta', 124, r.comoVa(1240, 1000))
    caso('sin objetivo no hay barra', 0, r.comoVa(500, 0))
    caso('ni con un objetivo negativo', 0, r.comoVa(500, -100))
  }

  /* 5. Lo que falta nunca es negativo: pasado el objetivo, no falta nada. */
  {
    caso('falta la mitad', 500, r.loQueFalta(500, 1000))
    caso('pasado el objetivo no falta nada', 0, r.loQueFalta(1240, 1000))
    caso('sin objetivo, nada', 0, r.loQueFalta(500, 0))
    caso('con céntimos, sin decimales de más', 0.5, r.loQueFalta(999.5, 1000))
  }

  /* 6. La frase de estado, que cambia según tres cosas a la vez. */
  {
    const base = { id: 'A', nombre: 'X', descripcion: '', objetivo: 1000, fechaInicio: '2026-01-01', estado: 'abierta', enLaWeb: false, creadaEn: '' }
    caso('a medias dice el porcentaje', '50 % del objetivo', r.comoSeLee(base, 500))
    caso('alcanzado se celebra', true, /Objetivo alcanzado/.test(r.comoSeLee(base, 1000)))
    caso('cerrada y cumplida', 'Objetivo cumplido (100 %)', r.comoSeLee({ ...base, estado: 'cerrada' }, 1000))
    caso('cerrada sin llegar', 'Cerrada al 50 % del objetivo', r.comoSeLee({ ...base, estado: 'cerrada' }, 500))
    caso('sin objetivo se dice así', 'Abierta, sin objetivo fijado', r.comoSeLee({ ...base, objetivo: 0 }, 500))
    caso('y sin objetivo y cerrada', 'Cerrada', r.comoSeLee({ ...base, objetivo: 0, estado: 'cerrada' }, 500))
  }

  /*
   * 7. UNA CAMPAÑA CERRADA NO ADMITE DINERO. El donativo que llega tarde —el
   * sobre que aparece dos semanas después— descuadraría un total que ya se dio
   * por bueno y probablemente ya se publicó.
   */
  {
    const base = { id: 'A', nombre: 'X', descripcion: '', objetivo: 1000, fechaInicio: '2026-01-01', estado: 'abierta', enLaWeb: true, creadaEn: '' }
    caso('abierta sí', true, r.admiteAportaciones(base))
    caso('cerrada no', false, r.admiteAportaciones({ ...base, estado: 'cerrada' }))
    // Y en la web solo salen las abiertas que estén marcadas.
    const lista = [base, { ...base, id: 'B', estado: 'cerrada' }, { ...base, id: 'C', enLaWeb: false }]
    caso('a la web va una sola', 'A', r.lasQueSalenEnLaWeb(lista).map((x) => x.id).join(','))
  }

  /* 8. La marca que se escribe en el libro, y que se reconozca luego. */
  {
    caso('la marca lleva las dos partes', 'campana:A:xyz', r.origenDeRecaudacion('A', 'xyz'))
    caso('y se reconoce', true, r.esDeLaRecaudacion({ origen: 'campana:A:xyz' }, 'A'))
    caso('sin confundir una campaña con otra', false, r.esDeLaRecaudacion({ origen: 'campana:AB:1' }, 'A'))
    caso('ni con una cuota', false, r.esDeLaRecaudacion({ origen: 'cuota:A' }, 'A'))
    caso('un apunte a mano no es de ninguna', false, r.esDeLaRecaudacion({}, 'A'))
  }

  /*
   * 9. PROYECTOS: ¿VA TARDE?
   *
   * Las fechas se comparan COMO TEXTO, no como `Date`: en ISO el orden
   * alfabético es el cronológico y no entra en juego ninguna zona horaria.
   * Con objetos `Date`, un proyecto para hoy sale «tarde» desde la medianoche
   * de Canarias.
   */
  {
    const hoy = '2026-08-27'
    caso('la fecha pasada va tarde', true, p.vaTarde({ estado: 'en marcha', fechaObjetivo: '2026-06-30' }, hoy))
    caso('la de hoy NO va tarde', false, p.vaTarde({ estado: 'en marcha', fechaObjetivo: hoy }, hoy))
    caso('la futura tampoco', false, p.vaTarde({ estado: 'en marcha', fechaObjetivo: '2027-01-01' }, hoy))
    caso('sin fecha no va tarde', false, p.vaTarde({ estado: 'parado' }, hoy))
    // Terminado es terminado: pintarlo en rojo para siempre castiga a quien lo sacó.
    caso('lo hecho nunca va tarde', false, p.vaTarde({ estado: 'hecho', fechaObjetivo: '2020-01-01' }, hoy))
    caso('y lo mismo con una tarea', true, p.tareaVaTarde({ hecha: false, fechaLimite: '2026-01-01' }, hoy))
    caso('una tarea hecha no va tarde', false, p.tareaVaTarde({ hecha: true, fechaLimite: '2026-01-01' }, hoy))
  }

  /*
   * 10. CÓMO VA UN PROYECTO. Sin tareas devuelve 0, NO 100: es la diferencia
   * entre «no hay nada que hacer» y «no se ha desglosado todavía», y son casos
   * opuestos. Devolver 100 pinta la barra llena en el proyecto que nadie ha
   * tocado, que es justo el que hay que mirar.
   */
  {
    caso('sin tareas, cero', 0, p.comoVaElProyecto([]).pct)
    caso('y el total también', 0, p.comoVaElProyecto([]).total)
    caso('la mitad', 50, p.comoVaElProyecto([{ hecha: true }, { hecha: false }]).pct)
    caso('todas', 100, p.comoVaElProyecto([{ hecha: true }]).pct)
    caso('cuenta las hechas', 2, p.comoVaElProyecto([{ hecha: true }, { hecha: true }, { hecha: false }]).hechas)
  }

  /* 11. El orden: lo hecho al final, lo que va tarde primero. */
  {
    const hoy = '2026-08-27'
    const lista = [
      { id: 'hecho', nombre: 'C', estado: 'hecho' },
      { id: 'idea', nombre: 'D', estado: 'idea' },
      { id: 'tarde', nombre: 'A', estado: 'en marcha', fechaObjetivo: '2026-01-01' },
      { id: 'marcha', nombre: 'B', estado: 'en marcha', fechaObjetivo: '2027-01-01' },
    ]
    caso('primero lo que se ha atascado', 'tarde,marcha,idea,hecho',
      p.ordenDeProyectos(lista, hoy).map((x) => x.id).join(','))
    caso('no toca la lista de origen', 'hecho', lista[0].id)
  }

  /* 12. Las tareas de un proyecto: las suyas, sin plazo detrás, hechas al final. */
  {
    const todas = [
      { id: '1', proyectoId: 'X', titulo: 'a', hecha: true, creadaEn: '1' },
      { id: '2', proyectoId: 'X', titulo: 'b', hecha: false, creadaEn: '2' },
      { id: '3', proyectoId: 'X', titulo: 'c', hecha: false, fechaLimite: '2026-01-01', creadaEn: '3' },
      { id: '4', proyectoId: 'OTRO', titulo: 'd', hecha: false, creadaEn: '4' },
    ]
    caso('solo las suyas, y en su orden', '3,2,1',
      p.tareasDelProyecto(todas, 'X').map((t) => t.id).join(','))
  }

  /*
   * 13. LA DEMO CUADRA CONSIGO MISMA.
   *
   * Esta es la que importa de verdad. Lo recaudado no se guarda en la campaña:
   * se cuenta desde `data/movimientos.ts`. Así que si alguien toca una de las
   * dos mitades —renombra un identificador, borra un apunte— la demo enseña
   * las barras a cero y nadie se entera hasta que la abre un cliente.
   */
  {
    const objetivos = await cargar('src/data/objetivos.ts')
    const movs = await cargar('src/data/movimientos.ts')
    const libro = movs.MOVIMIENTOS_INICIALES
    const campanas = objetivos.RECAUDACIONES_INICIALES

    caso('hay campañas de ejemplo', true, campanas.length >= 3)

    // TODA campaña de ejemplo tiene dinero apuntado en el libro.
    const secas = campanas.filter((c) => r.cuantasAportaciones(libro, c.id) === 0)
    caso('ninguna campaña de la demo sale a cero', '', secas.map((c) => c.nombre).join(', '))

    // Y NINGÚN apunte marcado apunta a una campaña que no existe.
    const ids = new Set(campanas.map((c) => c.id))
    const huerfanos = libro
      .filter((m) => (m.origen ?? '').startsWith('campana:'))
      .map((m) => m.origen.split(':')[1])
      .filter((id) => !ids.has(id))
    caso('ningún apunte apunta a una campaña que no existe', '', [...new Set(huerfanos)].join(', '))

    // La del palio va a medias: es la que enseña la barra a medio llenar, que
    // es literalmente lo que se pidió.
    const palio = campanas.find((c) => c.id === objetivos.CAMPANA_PALIO)
    const llevaPalio = r.loRecaudado(libro, palio.id)
    caso('la del palio ha recogido algo', true, llevaPalio > 0)
    caso('pero no ha llegado al objetivo', true, llevaPalio < palio.objetivo)
    // 5000 + 1340,50 + 2870 − 145 de gasto.
    caso('y la cifra es la que sale de sumar el libro', 9065.5, llevaPalio)

    // Una sin objetivo, para que la demo enseñe también ese caso.
    caso('hay una campaña sin objetivo', true, campanas.some((c) => c.objetivo === 0))
    // Y una cerrada que llegó, que es lo que se mira al año siguiente.
    const cerrada = campanas.find((c) => c.estado === 'cerrada')
    caso('hay una cerrada', true, Boolean(cerrada))
    caso('y llegó a su objetivo', true, r.loRecaudado(libro, cerrada.id) >= cerrada.objetivo)

    // Los proyectos: sus tareas son suyas, y la campaña que enlazan existe.
    const proyectos = objetivos.PROYECTOS_INICIALES
    const tareas = objetivos.TAREAS_PROYECTO_INICIALES
    const idsProy = new Set(proyectos.map((x) => x.id))
    caso('ninguna tarea cuelga de un proyecto que no existe', '',
      tareas.filter((t) => !idsProy.has(t.proyectoId)).map((t) => t.titulo).join(', '))
    caso('ningún proyecto enlaza una campaña que no existe', '',
      proyectos.filter((x) => x.recaudacionId && !ids.has(x.recaudacionId)).map((x) => x.nombre).join(', '))
    caso('hay un proyecto en «idea»', true, proyectos.some((x) => x.estado === 'idea'))
  }

  /*
   * 14. Y QUE NO SE HAYA CONFUNDIDO CON LA OTRA CAMPAÑA.
   *
   * `lib/campana.ts` ya existía y es LA CAMPAÑA DE PAPELETAS DE SITIO, con sus
   * plazos de renovación. Dos cosas distintas con el mismo nombre en el mismo
   * proyecto es cómo se acaba tocando la que no era.
   */
  {
    const { readFile } = await import('node:fs/promises')
    const vieja = await readFile('src/lib/campana.ts', 'utf8')
    caso('la campaña de papeletas sigue siendo la de papeletas',
      true, /papeletas de sitio/i.test(vieja))
    caso('y no ha crecido con lo de recaudar', false, /objetivo_cent|loRecaudado/.test(vieja))
    const nueva = await readFile('src/lib/recaudaciones.ts', 'utf8')
    caso('y la nueva avisa de la confusión', true, /lib\/campana\.ts/.test(nueva))
  }

  /*
   * 15. LA PANTALLA ESCRIBE EN TESORERÍA, que es el punto de todo esto.
   *
   * Si apuntar una aportación no pasara por `conApunteDeCobro`, el dinero
   * viviría en una lista aparte y no saldría ni en el libro ni en el Estado de
   * Cuentas: la avería que se vino a arreglar, otra vez.
   */
  {
    const { readFile } = await import('node:fs/promises')
    const pantalla = await readFile('src/pages/app/Campanas.tsx', 'utf8')
    caso('la aportación se apunta en el libro', true, /conApunteDeCobro/.test(pantalla))
    caso('con la marca de la campaña', true, /origenDeRecaudacion/.test(pantalla))
    // Y NO guarda un total propio en ninguna parte.
    caso('la campaña no guarda un «recaudado»', false, /recaudado:/.test(pantalla))
    const db = await readFile('src/lib/db/recaudaciones.ts', 'utf8')
    caso('ni la fila que va a la base', false, /recaudado/.test(db))
    /*
     * Y LA TABLA TAMPOCO. Se mira DENTRO del `create table`, no en el fichero
     * entero: `recaudado_cent` sí aparece más abajo, pero como columna que
     * DEVUELVE la función de la web —calculada ahí mismo desde los apuntes—, y
     * esa es justamente la forma correcta. Buscándolo en todo el fichero, esta
     * prueba fallaba por lo contrario de lo que quiere comprobar.
     */
    const sql = await readFile('supabase/campanas-y-proyectos.sql', 'utf8')
    const tabla = sql.slice(sql.indexOf('create table if not exists campanas_recaudacion'))
      .slice(0, sql.slice(sql.indexOf('create table if not exists campanas_recaudacion')).indexOf(');'))
    caso('la tabla no guarda ningún total', false, /recaudado/.test(tabla))
    caso('pero sí guarda el objetivo, que ese no se calcula', true, /objetivo_cent/.test(tabla))
  }
}
