/**
 * FELICITAR EL CUMPLEAÑOS: EL SESGO QUE FALTABA.
 *
 * ============================================================================
 * EL AGUJERO
 * ============================================================================
 *
 * La aplicación sabía perfectamente quién cumple años —`cumpleEsteMes()` y
 * `esSuCumpleHoy()` llevan tiempo en `hermanoFicha.ts`— pero solo lo sabía LA
 * PANTALLA DEL CENSO, con un filtro suyo aparte.
 *
 * El sesgo de comunicados no lo sabía. Sabía de edad, de etiqueta, de cargo y
 * de campos a medida, y no de cumpleaños. Así que un comunicado NO se podía
 * dirigir a quien cumple años. Ni siquiera a mano, eligiendo uno a uno.
 *
 * ----------------------------------------------------------------------------
 * Y EL 29 DE FEBRERO
 * ----------------------------------------------------------------------------
 *
 * Quien nació un 29 de febrero no cumplía NUNCA: tres de cada cuatro años ese
 * día no existe. Con la felicitación a mano pasaba desapercibido —nadie echa de
 * menos un nombre en una lista— pero en cuanto esto dispare un correo
 * automático, esa persona es la única de la hermandad a la que no se felicita
 * jamás.
 *
 * Es el mismo fallo que ya costó caro en el calendario, donde un acto anual el
 * 29 de febrero se quedaba en el 1 de marzo para siempre.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const seg = await cargar('src/lib/segmentacion.ts')
  const ficha = await cargar('src/lib/hermanoFicha.ts')

  /*
   * EL CENSO DE PRUEBA. Fechas elegidas para que cada una diga algo:
   * uno cumple hoy, otro el mismo mes, otro en otro mes, uno el 29 de febrero
   * y uno sin fecha ninguna — que en un censo importado hay muchos.
   */
  const hermanos = [
    { id: 'a', nombre: 'Cumple Hoy', numero: 1, estado: 'Activo', email: 'a@x.es', fechaNacimiento: '1980-03-15' },
    { id: 'b', nombre: 'Cumple Este Mes', numero: 2, estado: 'Activo', email: 'b@x.es', fechaNacimiento: '1975-03-28' },
    { id: 'c', nombre: 'Cumple En Julio', numero: 3, estado: 'Activo', email: 'c@x.es', fechaNacimiento: '1990-07-02' },
    { id: 'd', nombre: 'Bisiesto', numero: 4, estado: 'Activo', email: 'd@x.es', fechaNacimiento: '1996-02-29' },
    { id: 'e', nombre: 'Sin Fecha', numero: 5, estado: 'Activo', email: 'e@x.es', fechaNacimiento: undefined },
  ]
  const nombres = (lista) => lista.map((h) => h.nombre).sort().join(', ')

  /*
   * `filtrarSegmento` mira el reloj por dentro, así que para probarlo hay que
   * mover el reloj. Se hace con un `Date` falso y se devuelve al sitio en
   * cuanto se acaba: una prueba que deja el reloj tocado estropea las que
   * vengan detrás, y el fallo aparece en otro fichero.
   */
  const DateDeVerdad = globalThis.Date
  function conElRelojEn(iso, hacer) {
    class DateFalso extends DateDeVerdad {
      constructor(...args) {
        if (args.length === 0) super(`${iso}T12:00:00`)
        else super(...args)
      }
      static now() { return new DateDeVerdad(`${iso}T12:00:00`).getTime() }
    }
    globalThis.Date = DateFalso
    try { return hacer() } finally { globalThis.Date = DateDeVerdad }
  }

  const base = { ...seg.CRITERIOS_POR_DEFECTO, soloConEmail: false }

  // --- POR DEFECTO NO SE MIRA, que es lo que pasa en todos los comunicados ---
  caso('sin tocar nada, el cumpleaños no filtra', 'Bisiesto, Cumple En Julio, Cumple Este Mes, Cumple Hoy, Sin Fecha',
    conElRelojEn('2027-03-15', () => nombres(seg.filtrarSegmento(hermanos, base))))
  caso('el valor de fábrica es «no se mira»', 'Todos', seg.CRITERIOS_POR_DEFECTO.cumpleanos)

  // --- QUIEN CUMPLE HOY ---
  caso('solo quien cumple hoy', 'Cumple Hoy',
    conElRelojEn('2027-03-15', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }))))
  caso('otro día, otra persona', 'Cumple Este Mes',
    conElRelojEn('2027-03-28', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }))))
  caso('un día que no cumple nadie no saca a nadie', '',
    conElRelojEn('2027-03-16', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }))))

  // --- QUIEN CUMPLE ESTE MES ---
  caso('los del mes', 'Cumple Este Mes, Cumple Hoy',
    conElRelojEn('2027-03-01', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'EsteMes' }))))
  caso('en julio, el de julio', 'Cumple En Julio',
    conElRelojEn('2027-07-20', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'EsteMes' }))))

  /*
   * --- EL 29 DE FEBRERO ---
   */
  caso('en un año bisiesto cumple el 29', 'Bisiesto',
    conElRelojEn('2028-02-29', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }))))
  /*
   * Y EN LOS QUE NO, EL 28. Antes esta persona no cumplía nunca: tres de cada
   * cuatro años el sesgo la dejaba fuera, y era la única de la hermandad a la
   * que no se felicitaba jamás.
   */
  caso('en un año normal cumple el 28', 'Bisiesto',
    conElRelojEn('2027-02-28', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }))))
  // Pero NO se le felicita dos veces en un bisiesto: el 28 no es su día.
  caso('en un bisiesto, el 28 no es su día', '',
    conElRelojEn('2028-02-28', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }))))
  // Y el 1 de marzo tampoco, que es la otra forma de resolverlo mal.
  caso('ni el 1 de marzo', '',
    conElRelojEn('2027-03-01', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }))))
  // El año 2100 no es bisiesto aunque sea múltiplo de 4: se cumple el 28.
  caso('la regla del siglo también', true,
    conElRelojEn('2100-02-28', () => ficha.esSuCumpleHoy('1996-02-29')))
  caso('y la del 400', true, conElRelojEn('2000-02-29', () => ficha.esSuCumpleHoy('1996-02-29')))

  /*
   * --- SIN FECHA DE NACIMIENTO NO ENTRA ---
   *
   * No es que no cumpla hoy: es que NO SE SABE. Y en un censo importado de un
   * Excel hay muchas fichas sin fecha. Felicitar a quien no toca es peor que no
   * felicitar: es un correo que delata que la aplicación no sabe lo que dice.
   */
  caso('sin fecha de nacimiento no se felicita', false,
    conElRelojEn('2027-03-15', () =>
      seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }).some((h) => h.nombre === 'Sin Fecha')))
  caso('ni en el sesgo del mes', false,
    conElRelojEn('2027-03-15', () =>
      seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'EsteMes' }).some((h) => h.nombre === 'Sin Fecha')))

  // --- SE COMBINA CON LO DEMÁS, que es de lo que sirve un sesgo ---
  const conBaja = [...hermanos, { id: 'f', nombre: 'De Baja', numero: 6, estado: 'Baja', email: 'f@x.es', fechaNacimiento: '1980-03-15' }]
  caso('a una baja no se le felicita', 'Cumple Hoy',
    conElRelojEn('2027-03-15', () => nombres(seg.filtrarSegmento(conBaja, { ...base, cumpleanos: 'Hoy' }))))

  // --- Y EL TEXTO QUE SE GUARDA COMO DESTINATARIO LO DICE ---
  caso('la etiqueta del segmento dice que es un cumpleaños', true,
    /cumplen años hoy/.test(seg.etiquetaSegmento({ ...base, cumpleanos: 'Hoy' })))
  caso('y la del mes', true,
    /cumplen años este mes/.test(seg.etiquetaSegmento({ ...base, cumpleanos: 'EsteMes' })))
  caso('sin cumpleaños no se menciona', false,
    /cumplen años/.test(seg.etiquetaSegmento(base)))

  // --- Y LA PANTALLA LO OFRECE ---
  const editor = await readFile('src/components/EditorSegmento.tsx', 'utf8')
  caso('el editor de sesgos lo ofrece', true, /cumpleanos: e\.target\.value/.test(editor))
  caso('con sus tres opciones', true,
    /value="Hoy"/.test(editor) && /value="EsteMes"/.test(editor) && /value="Todos"/.test(editor))
  /*
   * Y AVISA DE LO DE LAS FICHAS SIN FECHA. Es la sorpresa de este sesgo: se
   * elige «los que cumplen hoy», salen tres de ochocientos, y la razón no es
   * que solo cumplan tres — es que el resto no tiene la fecha puesta.
   */
  caso('y avisa de las fichas sin fecha', true, /no es que no cumpla/.test(editor))

  /*
   * --- LA REGLA VIVE EN UN SOLO SITIO ---
   *
   * `filtrarSegmento` no vuelve a escribir la cuenta: llama a las de
   * `hermanoFicha.ts`. Dos versiones de la misma regla es como se acaba
   * felicitando en el censo a quien no recibe la felicitación por correo.
   */
  const src = await readFile('src/lib/segmentacion.ts', 'utf8')
  caso('el sesgo usa las funciones que ya había', true,
    /esSuCumpleHoy\(h\.fechaNacimiento\)/.test(src) && /cumpleEsteMes\(h\.fechaNacimiento\)/.test(src))
  caso('y no se escribe otra cuenta aquí', false, /getMonth\(\) \+ 1/.test(src))


  /*
   * ==========================================================================
   * LOS DÍAS QUE NADIE ABRIÓ LA PANTALLA
   * ==========================================================================
   *
   * Este es el que convertía la función en casi inútil. Las reglas se miran
   * cuando alguien entra en Comunicados, y en una hermandad eso puede ser una
   * vez por semana: sin recuperar el hueco, «felicitar el cumpleaños» solo
   * alcanzaba a quien cumpliera JUSTO el día que alguien abrió esa pantalla.
   * Se perdían casi todos.
   */
  const conHueco = (desde) => ({ ...base, cumpleanos: 'Hoy', cumpleDesde: desde })

  // El 15 cumple uno; el 18 se abre la pantalla por primera vez desde el 14.
  caso('se recupera a quien cumplió mientras nadie miraba', 'Cumple Hoy',
    conElRelojEn('2027-03-18', () => nombres(seg.filtrarSegmento(hermanos, conHueco('2027-03-14')))))

  /*
   * Y EL DÍA `desde` NO SE VUELVE A CONTAR: es el día en que la regla ya se
   * disparó, así que a quien cumpliera ese día ya se le felicitó. Contarlo otra
   * vez sería mandarle dos felicitaciones.
   */
  caso('a quien cumplió el día que ya se miró no se le repite', '',
    conElRelojEn('2027-03-18', () => nombres(seg.filtrarSegmento(hermanos, conHueco('2027-03-15')))))

  // Y quien cumple HOY entra igual, con hueco o sin él.
  caso('quien cumple hoy entra siempre', 'Cumple Hoy',
    conElRelojEn('2027-03-15', () => nombres(seg.filtrarSegmento(hermanos, conHueco('2027-03-12')))))

  // Sin hueco declarado, se comporta como antes: solo hoy.
  caso('sin hueco, solo los de hoy', '',
    conElRelojEn('2027-03-18', () => nombres(seg.filtrarSegmento(hermanos, { ...base, cumpleanos: 'Hoy' }))))

  /*
   * EL CAMBIO DE AÑO. Del 30 de diciembre al 2 de enero el hueco cruza el 31 y
   * el 1, y una cuenta hecha con restas de fechas se equivoca ahí. Se recorre
   * día a día justamente para que esto salga solo.
   */
  const enNavidad = [{ id: 'n', nombre: 'Nochevieja', numero: 9, estado: 'Activo', email: 'n@x.es', fechaNacimiento: '1970-12-31' }]
  caso('el hueco cruza bien el fin de año', 'Nochevieja',
    conElRelojEn('2027-01-02', () => nombres(seg.filtrarSegmento(enNavidad, conHueco('2026-12-30')))))

  /*
   * --- Y EL TOPE: CUATRO DÍAS, NO TODOS ---
   *
   * Una felicitación tiene fecha de caducidad. «¡Felicidades!» un día tarde se
   * agradece; nueve días tarde es peor que no mandar nada, porque se lee como
   * que la hermandad se acordó por casualidad revisando una lista.
   */
  const reglas = await cargar('src/lib/reglasAutomaticas.ts')
  caso('se recuperan cuatro días', 4, reglas.DIAS_QUE_SE_RECUPERAN)
  const srcReglas = await readFile('src/lib/reglasAutomaticas.ts', 'utf8')
  caso('y con un hueco mayor no se recupera nada', true,
    /hueco > 1 && hueco <= DIAS_QUE_SE_RECUPERAN \+ 1/.test(srcReglas))
  /*
   * Y SOLO PARA «cumple hoy». En «cumple este mes» no tiene sentido —el mes
   * entero ya está dentro— y aplicarlo sería felicitar dos veces al mismo.
   */
  caso('solo se recupera en el sesgo de «hoy»', true,
    /regla\.criterios\?\.cumpleanos === 'Hoy' && regla\.ultimaVez/.test(srcReglas))
  // Y la fecha no se guarda en la regla: es del momento, no del sesgo.
  const db = await readFile('src/lib/db/reglasAutomaticas.ts', 'utf8')
  caso('el hueco no se guarda en la regla', false, /cumpleDesde/.test(db))
}
