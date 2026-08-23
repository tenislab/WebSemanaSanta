/**
 * TODO LO QUE SE CONECTA, EN UN SOLO SITIO.
 *
 * EL PROBLEMA QUE RESUELVE, y llegó dicho así: «no hay apartado que dé opción
 * de conectar, no está en ajustes».
 *
 * Y era verdad. Cada cosa que se conecta vivía donde se usa, que parece lo
 * lógico y no lo es:
 *
 *   · el correo            → Configuración → Correo
 *   · las redes sociales   → Comunicados, en una tarjeta plegada
 *   · el dominio propio    → Web pública → Compartir, dentro de un desplegable
 *   · el cobro con tarjeta → en ningún sitio todavía
 *
 * Puestas cada una en su módulo, no hay ningún sitio donde alguien pueda
 * preguntarse «¿qué me queda por conectar?» y obtener respuesta. Y ese sitio,
 * para cualquiera, es **Ajustes**: es donde se va a buscar, y es donde no
 * estaba.
 *
 * Esto NO mueve nada de su sitio. Cada cosa se sigue configurando donde se
 * configuraba —el dominio junto a la web, las redes junto a los comunicados—,
 * porque ahí es donde tiene sentido mientras se trabaja. Lo que hace es dar la
 * lista completa con su estado y el camino a cada una.
 */

export type EstadoConexion = 'conectado' | 'sinConectar' | 'noDisponible'

export interface Conexion {
  id: string
  nombre: string
  /** Para qué sirve, en una frase de las que se entienden. */
  paraQue: string
  /** Dónde se conecta de verdad. */
  donde: string
  /** El nombre de la pantalla, para poder decirlo además de enlazarlo. */
  comoLlegar: string
  estado: EstadoConexion
  /** Lo que hay puesto ahora, si hay algo (el remitente, el dominio…). */
  detalle?: string
  /**
   * Por qué no se puede todavía. Solo para `noDisponible`, y hay que ponerlo:
   * un apartado apagado sin explicación se lee como que está roto.
   */
  porQueNo?: string
}

/** Lo que hay que mirar para saber qué está conectado. Se pasa de fuera: esto es puro. */
export interface EstadoDeLasConexiones {
  correoListo: boolean
  /** El remitente configurado, para poder enseñarlo. */
  remitente?: string
  redesConectadas: number
  totalRedes: number
  /** El dominio propio escrito, si lo hay. */
  dominio?: string
  /** ¿Está la web publicada? Un dominio sin web publicada no lleva a ninguna parte. */
  webPublicada: boolean
  /** El pack contratado incluye dominio propio. */
  dominioEnElPack: boolean
  /** ¿Hay cuenta bancaria puesta? Es lo que hace falta para cobrar por transferencia. */
  tieneIban: boolean
  /** Bizum de la hermandad, si lo han puesto. */
  bizum?: string
}

export function conexiones(e: EstadoDeLasConexiones): Conexion[] {
  return [
    {
      id: 'correo',
      nombre: 'Correo',
      paraQue: 'Sin esto no sale ni un aviso: ni las claves de acceso, ni los recibos, ni los comunicados.',
      donde: '/app/configuracion?seccion=correo',
      comoLlegar: 'Configuración → Correo',
      estado: e.correoListo ? 'conectado' : 'sinConectar',
      detalle: e.correoListo ? e.remitente : undefined,
    },
    {
      id: 'redes',
      nombre: 'Redes sociales',
      /*
       * Decía «los iconos del pie de la web, y los comunicados…». Lo primero
       * era falso: el pie de la web sale de OTRA lista, la del editor de la
       * web pública. Conectar Instagram aquí no pone su icono allí. Mientras
       * las dos listas sigan separadas, esto tiene que decir solo lo que hace.
       */
      paraQue: 'Los comunicados salen con el texto listo para publicar y el botón que abre cada red.',
      donde: '/app/comunicados',
      comoLlegar: 'Comunicados → Redes sociales de la hermandad',
      estado: e.redesConectadas > 0 ? 'conectado' : 'sinConectar',
      detalle: e.redesConectadas > 0 ? `${e.redesConectadas} de ${e.totalRedes}` : undefined,
    },
    {
      id: 'dominio',
      nombre: 'Dominio propio',
      paraQue: 'Que la web se vea en hermandaddetriana.es y no en el enlace de Gobergo.',
      donde: '/app/web',
      comoLlegar: 'Web pública → Compartir → Usar un dominio propio',
      estado: !e.dominioEnElPack ? 'noDisponible' : e.dominio ? 'conectado' : 'sinConectar',
      detalle: e.dominio,
      porQueNo: !e.dominioEnElPack ? 'El dominio propio va con el pack «Todo».' : undefined,
    },
    {
      id: 'cobros',
      nombre: 'Cobros',
      paraQue: 'La cuenta y el Bizum donde los hermanos pagan cuotas y papeletas.',
      donde: '/app/configuracion?seccion=hermandad',
      comoLlegar: 'Configuración → Identidad y datos',
      estado: e.tieneIban || e.bizum ? 'conectado' : 'sinConectar',
      detalle: [e.tieneIban ? 'Cuenta bancaria' : null, e.bizum ? 'Bizum' : null]
        .filter(Boolean).join(' · ') || undefined,
    },
    {
      id: 'pasarela',
      nombre: 'Pago con tarjeta',
      paraQue: 'Que el hermano pague su cuota o su papeleta con tarjeta desde su área.',
      donde: '/app/configuracion?seccion=hermandad',
      comoLlegar: 'Configuración',
      /*
       * Apagado a propósito, y con el motivo escrito. Un apartado en gris sin
       * explicación se lee como que está roto, y genera la llamada que se
       * quería evitar.
       */
      estado: 'noDisponible',
      porQueNo: 'Todavía no está enchufado. Mientras tanto se cobra por transferencia, Bizum y en efectivo.',
    },
  ]
}

/** Cuántas están conectadas y cuántas se pueden conectar. Para el resumen de arriba. */
export function resumenConexiones(lista: Conexion[]): { conectadas: number; posibles: number } {
  const posibles = lista.filter((c) => c.estado !== 'noDisponible')
  return { conectadas: posibles.filter((c) => c.estado === 'conectado').length, posibles: posibles.length }
}
