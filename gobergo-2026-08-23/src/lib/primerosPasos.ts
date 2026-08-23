/**
 * EL MAPA DE LOS PRIMEROS PASOS.
 *
 * Para quien acaba de crear su hermandad y se encuentra un panel con trece
 * secciones vacías. El problema no es que falte información: es que hay
 * demasiada y ninguna dice por dónde se empieza. Se abre Cuotas antes de tener
 * censo, no sale nada, y se cierra la pestaña.
 *
 * Esto es el guion: qué hay que hacer, en qué orden, y **cuáles ya están**. Un
 * paso hecho se tacha solo — no hay nada que marcar a mano, porque una lista
 * que hay que ir marcando se queda a medias el primer día y a partir de ahí
 * miente.
 *
 * Dos reglas al añadir un paso:
 *
 *   1. `hecho` se comprueba mirando los datos de verdad, nunca una marca
 *      guardada aparte. Si la hermandad borra su censo, el paso vuelve a estar
 *      pendiente, que es la verdad.
 *   2. Todo paso lleva `donde`: a dónde se va a hacerlo. Un paso que dice qué
 *      falta pero no adónde ir obliga a buscarlo por el menú, y eso es lo que
 *      se estaba intentando evitar.
 */

export interface PasoPuestaEnMarcha {
  id: string
  titulo: string
  /** Para qué sirve, en una frase. Lo que contestaría alguien de la junta, no un manual. */
  porQue: string
  /** A dónde se va a hacerlo. */
  donde: string
  /** El texto del enlace. */
  comoLlegar: string
  hecho: boolean
  /**
   * Sin esto no se puede seguir de verdad. Los imprescindibles se enseñan
   * arriba y se cuentan aparte: «te faltan 2 de 4 para poder empezar» es una
   * frase que se entiende; «te faltan 7 de 11 cosas» solo agobia.
   */
  imprescindible?: boolean
}

/** Lo que hay que mirar para saber qué está hecho. Se pasa de fuera para que esto sea puro. */
export interface EstadoDeLaHermandad {
  /** ¿Tiene nombre puesto la hermandad (no el de fábrica)? */
  tieneNombre: boolean
  /** ¿Ha subido su escudo? */
  tieneEscudo: boolean
  /** Cuántos hermanos hay en el censo. */
  hermanos: number
  /** Cuánta gente lleva algún cargo (por ficha o por cuenta de acceso). */
  conCargo: number
  /** ¿Está el correo conectado y encendido? */
  correoListo: boolean
  /** ¿Hay al menos un concepto de cuota con importe? */
  hayCuotas: boolean
  /** ¿Hay tramos del cortejo dados de alta? */
  tramos: number
  /**
   * ¿Está puesta la cuenta bancaria de la hermandad?
   *
   * Aquí había «¿está puesto el precio de la papeleta?», y era un paso ROTO:
   * el precio viene de fábrica a 18 €, así que la comprobación era `18 > 0` y
   * NUNCA podía salir pendiente. Un paso que siempre está tachado no es un
   * paso, es un adorno — y encima daba la sensación de haber avanzado sin
   * haber hecho nada.
   *
   * El IBAN sí es una decisión de la hermandad, empieza vacío, y sin él no se
   * cobra ni una cuota ni una papeleta.
   */
  tieneIban: boolean
  /** ¿Está publicada la web? */
  webPublicada: boolean
  /** ¿Hay alguna red social con su cuenta puesta? */
  redesConectadas: number
  /** ¿Cuántos hermanos tienen ya su acceso al área? */
  conAcceso: number
}

/**
 * El guion completo, con lo hecho ya tachado.
 *
 * El ORDEN no es decorativo: es el orden en que hay que hacerlo. El censo va
 * antes que las cuotas porque no se le puede cobrar a nadie que no existe, y
 * los cargos van antes que el correo porque quien configura el correo suele
 * ser la secretaría, no quien creó la hermandad.
 */
export function pasosPuestaEnMarcha(e: EstadoDeLaHermandad): PasoPuestaEnMarcha[] {
  return [
    {
      id: 'identidad',
      titulo: 'Poner el nombre y el escudo',
      porQue: 'Sale en los recibos, en las papeletas y en los correos que reciben los hermanos.',
      donde: '/app/configuracion',
      comoLlegar: 'Configuración → La hermandad',
      hecho: e.tieneNombre && e.tieneEscudo,
      imprescindible: true,
    },
    {
      id: 'censo',
      titulo: 'Traer el censo de hermanos',
      porQue: 'Es la base de todo lo demás: sin hermanos no hay cuotas, ni papeletas, ni comunicados.',
      donde: '/app/hermanos',
      comoLlegar: 'Hermanos → Exportar → Traer vuestro censo',
      // Se sube el Excel tal cual; no hace falta convertirlo a nada.
      hecho: e.hermanos > 0,
      imprescindible: true,
    },
    {
      id: 'cargos',
      titulo: 'Repartir los cargos de la junta',
      porQue: 'Cada uno entra con su cuenta y ve solo lo suyo. El tesorero no tiene por qué ver el archivo.',
      donde: '/app/personal',
      comoLlegar: 'Personal y permisos',
      hecho: e.conCargo > 0,
      imprescindible: true,
    },
    {
      id: 'correo',
      titulo: 'Conectar el correo',
      porQue: 'Sin esto no sale ni un aviso: ni las claves de acceso, ni los recibos, ni los comunicados.',
      donde: '/app/configuracion',
      comoLlegar: 'Configuración → Correo',
      hecho: e.correoListo,
      imprescindible: true,
    },
    {
      id: 'cobros',
      titulo: 'Poner la cuenta bancaria de la hermandad',
      porQue: 'Sin ella no se cobra: ni cuotas, ni papeletas, ni remesas al banco.',
      donde: '/app/configuracion',
      comoLlegar: 'Configuración → La hermandad',
      hecho: e.tieneIban,
    },
    {
      id: 'cuotas',
      titulo: 'Decir cuánto se paga de cuota',
      porQue: 'Hasta que no haya un concepto con su importe no se puede emitir ni un recibo.',
      donde: '/app/cuotas',
      comoLlegar: 'Cuotas → Conceptos',
      hecho: e.hayCuotas,
    },
    {
      id: 'tramos',
      titulo: 'Montar los tramos del cortejo',
      porQue: 'Es lo que reparte los sitios —cruz de guía, insignias, cirios, costaleros— y donde se pone el precio de cada uno.',
      donde: '/app/cortejo',
      comoLlegar: 'Cortejo → Tramos',
      hecho: e.tramos > 0,
    },
    {
      id: 'accesos',
      titulo: 'Dar acceso a los hermanos',
      porQue: 'Cada hermano ve su ficha, su recibo y su sitio en el cortejo sin llamar a secretaría.',
      donde: '/app/hermanos',
      comoLlegar: 'Hermanos → Enviar acceso',
      hecho: e.conAcceso > 0,
    },
    {
      id: 'web',
      titulo: 'Publicar la web de la hermandad',
      porQue: 'Cultos, actualidad y el formulario para que alguien pida entrar.',
      donde: '/app/web',
      comoLlegar: 'Web pública',
      hecho: e.webPublicada,
    },
    {
      id: 'redes',
      titulo: 'Decir cuáles son vuestras redes sociales',
      porQue: 'Salen en el pie de la web, y los comunicados se publican desde ahí.',
      donde: '/app/comunicados',
      comoLlegar: 'Comunicados → Redes sociales',
      hecho: e.redesConectadas > 0,
    },
  ]
}

/** Resumen para la cabecera: cuánto llevas. */
export interface ResumenPasos {
  hechos: number
  total: number
  /** Los imprescindibles que faltan. Son los que impiden empezar de verdad. */
  faltanImprescindibles: number
  /** El siguiente que toca, o null si está todo. */
  siguiente: PasoPuestaEnMarcha | null
  /** De 0 a 100, para la barra. */
  porcentaje: number
}

export function resumirPasos(pasos: PasoPuestaEnMarcha[]): ResumenPasos {
  const hechos = pasos.filter((p) => p.hecho).length
  const total = pasos.length
  return {
    hechos,
    total,
    faltanImprescindibles: pasos.filter((p) => p.imprescindible && !p.hecho).length,
    // El siguiente es el primero pendiente EN ORDEN, no el más fácil: el orden
    // de la lista es el orden en que hay que hacerlo.
    siguiente: pasos.find((p) => !p.hecho) ?? null,
    porcentaje: total === 0 ? 100 : Math.round((hechos / total) * 100),
  }
}

/**
 * ¿Se ha terminado la puesta en marcha?
 *
 * Con todo hecho el guion desaparece del panel: dejarlo puesto para siempre lo
 * convierte en parte del decorado, y entonces ya no lo lee nadie el día que
 * vuelve a hacer falta.
 */
export function estaTodoHecho(pasos: PasoPuestaEnMarcha[]): boolean {
  return pasos.every((p) => p.hecho)
}
