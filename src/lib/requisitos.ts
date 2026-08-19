import { isSupabaseConfigured } from './supabase'
import { getHermandadSettings, type HermandadSettings } from './hermandadSettings'
import { getWebPublica, type WebPublica } from './webPublica'

/**
 * Lo que hace falta CONFIGURAR para que ciertas cosas funcionen de verdad:
 * conectar la base de datos, contratar un proveedor de correo, una pasarela de
 * cobro, poner los datos bancarios, apuntar un dominio.
 *
 * La norma es la misma en toda la aplicación: **lo que no funciona no se
 * esconde, se avisa en rojo**. Esconder un botón que no va tiene dos problemas:
 * la hermandad no descubre nunca que existe, y quien lo configura no sabe qué
 * le falta. Un aviso enseña las dos cosas.
 *
 * Por eso cada requisito lleva las tres piezas que hacen falta para resolverlo,
 * y no una sola: **qué no va**, **por qué** y **quién lo arregla y dónde**. Un
 * aviso que solo dice «no configurado» deja a la junta igual de perdida.
 */
export type IdRequisito = 'supabase' | 'correo' | 'pasarela' | 'datosCobro' | 'dominio'

export interface Requisito {
  id: IdRequisito
  /** Cómo se llama la cosa. Para listarlo cuando ya está resuelto. */
  nombre: string
  /** Título del aviso: qué NO funciona. En una frase, en cristiano. */
  queNoVa: string
  /** Por qué no se puede hacer desde aquí. Sin esto, el aviso suena a excusa. */
  porQue: string
  /** Quién lo arregla y dónde. Es la parte que de verdad desatasca. */
  comoSeArregla: string
  /** A dónde ir dentro de la aplicación, cuando se arregla desde dentro. */
  enlace?: { a: string; texto: string }
  /** ¿Está ya resuelto? Cuando lo está, no se pinta nada. */
  listo: boolean
}

/** Lo que hace falta saber para decidir si cada requisito está cumplido. */
export interface ContextoRequisitos {
  hermandad?: Pick<HermandadSettings, 'iban' | 'bizumTelefono'> | null
  web?: Pick<WebPublica, 'dominio' | 'donativos'> | null
  /** Se pasa de fuera para poder probarlo sin depender del entorno. */
  supabaseListo?: boolean
}

/**
 * El estado de todos los requisitos. Se calcula de una vez y cada pantalla coge
 * el que le toca, en vez de que cada una lo compruebe a su manera y se vayan
 * desincronizando (que es lo que pasaba antes de esto: había tres formatos de
 * aviso distintos para la misma idea).
 */
export function requisitos(ctx: ContextoRequisitos = {}): Record<IdRequisito, Requisito> {
  const supabaseListo = ctx.supabaseListo ?? isSupabaseConfigured
  const iban = (ctx.hermandad?.iban ?? '').trim()
  const bizum = (ctx.hermandad?.bizumTelefono ?? '').trim()
  const pasarela = (ctx.web?.donativos?.enlacePasarela ?? '').trim()
  const dominio = (ctx.web?.dominio ?? '').trim()

  return {
    supabase: {
      id: 'supabase',
      nombre: 'Base de datos',
      queNoVa: 'Los datos solo están en este navegador',
      porQue:
        'Sin base de datos conectada, todo lo que se guarda vive en este ordenador y en este navegador. No lo ve nadie más de la junta, y si se borran los datos de navegación, se pierde.',
      comoSeArregla:
        'Lo conecta quien administre Cabildo: se crea un proyecto en Supabase, se ejecutan los ficheros de la carpeta supabase/ y se pegan las dos claves en el archivo .env.',
      listo: supabaseListo,
    },
    correo: {
      id: 'correo',
      nombre: 'Envío de correo',
      queNoVa: 'Los avisos no salen por correo',
      porQue:
        'Los avisos llegan al buzón que cada hermano tiene dentro de su área, pero no se manda ningún correo electrónico. Hace falta contratar un proveedor de envío y verificar el dominio de la hermandad; sin esa verificación, los correos acabarían en la carpeta de spam.',
      comoSeArregla:
        'Lo contrata la hermandad (Resend, SendGrid o Amazon SES) y se configura una vez. Mientras tanto, el hermano ve sus avisos al entrar en su área.',
      listo: false,
    },
    pasarela: {
      id: 'pasarela',
      nombre: 'Pasarela de cobro',
      queNoVa: 'No se puede pagar con tarjeta',
      porQue:
        'Cabildo no puede cobrar en nombre de la hermandad: el dinero tiene que entrar en una cuenta suya, y eso exige una pasarela contratada a su nombre, con su CIF.',
      comoSeArregla:
        'La contrata la hermandad (con su banco o con Stripe) y se pega el enlace de pago en Web pública → Donativos. Mientras tanto se paga por Bizum o transferencia y la tesorería lo confirma al ver el ingreso.',
      enlace: { a: '/app/web', texto: 'Ir a Web pública' },
      listo: pasarela !== '',
    },
    datosCobro: {
      id: 'datosCobro',
      nombre: 'Datos de cobro de la hermandad',
      queNoVa: 'No hay por dónde pagar',
      porQue:
        'La hermandad no ha puesto ni su Bizum ni su cuenta bancaria, así que a quien quiere pagar una cuota, una papeleta o un donativo no se le puede enseñar a dónde mandarlo.',
      comoSeArregla: 'Se ponen en Configuración → Datos de la hermandad.',
      enlace: { a: '/app/configuracion', texto: 'Ir a Configuración' },
      listo: iban !== '' || bizum !== '',
    },
    dominio: {
      id: 'dominio',
      nombre: 'Dominio propio',
      queNoVa: 'La web vive en un enlace largo',
      porQue:
        'Sin dominio propio, la web se comparte con la dirección larga de Cabildo. Funciona, pero no es la dirección de la hermandad.',
      comoSeArregla:
        'La hermandad compra el dominio en un registrador y lo apunta aquí siguiendo las instrucciones de Web pública → Estilo y secciones.',
      enlace: { a: '/app/web', texto: 'Ir a Web pública' },
      listo: dominio !== '',
    },
  }
}

/** Atajo para preguntar por uno solo. */
export function requisito(id: IdRequisito, ctx: ContextoRequisitos = {}): Requisito {
  return requisitos(ctx)[id]
}

/** Los que faltan, para poder contarlos o listarlos de una vez. */
export function requisitosPendientes(ctx: ContextoRequisitos = {}): Requisito[] {
  return Object.values(requisitos(ctx)).filter((r) => !r.listo)
}

/**
 * El contexto ya reunido, para las pantallas que no tienen a mano ni los
 * ajustes de la hermandad ni la web. `requisitos()` se deja puro a propósito
 * (así se puede probar sin navegador); este envoltorio es el que va a buscar
 * los datos donde están.
 */
export function contextoActual(): ContextoRequisitos {
  return { hermandad: getHermandadSettings(), web: getWebPublica() }
}

/** Como `requisito()`, pero yendo a buscar el contexto por su cuenta. */
export function requisitoActual(id: IdRequisito): Requisito {
  return requisito(id, contextoActual())
}
