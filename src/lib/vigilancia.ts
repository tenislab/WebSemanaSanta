/**
 * VIGILANCIA: ENTERARSE DE LO QUE SE ROMPE SIN QUE NADIE LO CUENTE.
 *
 * ============================================================================
 * SI ERES UN PROGRAMADOR Y ACABAS DE LLEGAR
 * ============================================================================
 *
 * Esto engancha tres cosas al arrancar la aplicación y no vuelve a hacer nada:
 *
 *   1. `window.onerror`               → algo se rompió pintando.
 *   2. `unhandledrejection`           → un `await` que nadie recogió.
 *   3. El evento `cabildo-sync-error` → la base rechazó una escritura. Este ya
 *      existía y lo pinta `AppShell`; aquí solo se escucha de pasada.
 *
 * Y los deja en la tabla `errores_cliente` de la propia base de la hermandad.
 * Ni Sentry ni nada de fuera; el porqué está escrito en `supabase/vigilancia.sql`.
 *
 * ----------------------------------------------------------------------------
 * LAS CINCO REGLAS. NINGUNA ES OPCIONAL.
 * ----------------------------------------------------------------------------
 *
 * Un vigilante de errores es un trozo de código que, por definición, se ejecuta
 * cuando las cosas ya van mal. Si además falla él, tienes dos problemas y el
 * segundo tapa al primero. De ahí estas cinco:
 *
 *   1. NO ROMPE NUNCA. Todo va dentro de `try`. Un fallo aquí se traga en
 *      silencio: no hay nada que se pueda hacer con él y decirlo sería un bucle.
 *
 *   2. NO SE LLAMA A SÍ MISMO. `enviando` corta la reentrada: si mandar un
 *      error provoca un error, el segundo no se manda. Sin esto, un fallo de
 *      red genera un fallo al reportarlo, que genera otro… hasta agotar la
 *      pestaña.
 *
 *   3. NO REPITE. El mismo mensaje se manda UNA VEZ por sesión. Un error
 *      dentro de un `render` de React se dispara sesenta veces por segundo:
 *      sin esto, una tarde de una hermandad son doscientas mil filas.
 *
 *   4. TIENE TECHO. Veinte por sesión y se acabó. Es el cinturón por si la
 *      regla 3 no bastara (veinte errores DISTINTOS ya es una sesión perdida:
 *      el error veintiuno no añade nada).
 *
 *   5. NO ESTORBA. `void`, sin `await`, en segundo plano. Nadie espera a que
 *      se guarde un error.
 *
 * ----------------------------------------------------------------------------
 * QUÉ NO SE MANDA, Y ESTO IMPORTA MÁS QUE LO QUE SE MANDA
 * ----------------------------------------------------------------------------
 *
 * NO se manda nada de datos personales. Ni nombres, ni DNI, ni correos, ni
 * teléfonos. Se manda el mensaje del error, la pila, la pantalla y el
 * navegador.
 *
 * Y hay un paso que no parece importante y lo es: `limpiarMensaje()` quita del
 * texto los números largos, los identificadores y las direcciones. Dos motivos,
 * y el segundo es el que de verdad manda:
 *
 *   · PARA AGRUPAR. «no existe la fila 7f3a…» y «no existe la fila 2b91…» son
 *     el mismo fallo. Con el identificador dentro son dos filas distintas y no
 *     hay manera de ver que eso ha pasado ochenta veces.
 *   · PARA NO LLEVARSE UN DATO SIN QUERER. Un mensaje de Postgres puede traer
 *     dentro el valor que se intentaba guardar. Limpiando los números y las
 *     comillas se corta esa vía antes de que exista.
 *
 * ----------------------------------------------------------------------------
 * EN MODO DEMOSTRACIÓN NO SE MANDA NADA
 * ----------------------------------------------------------------------------
 *
 * La demo es un escaparate: quien la abre no es cliente de nadie, no hay
 * hermandad a la que atribuir el fallo y RLS lo rechazaría igual. Se sale antes
 * de tocar la red.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { modoDemoActivo } from './demo'

/** Cuántos errores distintos se guardan por sesión. Ver la regla 4. */
const TECHO_POR_SESION = 20

/** Lo ya mandado en esta sesión, por mensaje limpio. Ver la regla 3. */
const yaMandados = new Set<string>()

/** Ver la regla 2: si esto está a `true`, no se manda nada. */
let enviando = false

/** Ver la regla 4. */
let cuantos = 0

/** Para no engancharse dos veces si alguien llama a `vigilar()` de más. */
let enganchado = false

/**
 * La versión de la aplicación: la fecha de compilación que mete Vite.
 *
 * `typeof` primero porque en las pruebas —esbuild, sin `define`— esa constante
 * NO EXISTE, y una referencia a un global inexistente lanza `ReferenceError`
 * al cargar el módulo. O sea que el vigilante tumbaría el banco de pruebas.
 */
function versionApp(): string {
  try {
    return typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''
  } catch {
    return ''
  }
}

/**
 * Deja el mensaje en su forma AGRUPABLE: sin identificadores, sin números
 * largos, sin direcciones y sin lo que fuera entre comillas.
 *
 * Se exporta para poder probarla: es la pieza con lógica de todo el módulo y
 * la única que puede llevarse un dato personal por delante si se hace mal.
 */
export function limpiarMensaje(texto: string): string {
  return String(texto ?? '')
    // Identificadores (UUID). Son los que más ensucian: cada fila trae el suyo.
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '‹id›')
    // Direcciones completas. Traen el subdominio del proyecto y, a veces, la
    // consulta entera con los valores dentro.
    .replace(/https?:\/\/\S+/gi, '‹url›')
    // Correos, por si alguno se cuela en un mensaje de la base.
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '‹correo›')
    /*
     * LO QUE VA ENTRE COMILLAS DOBLES NO. Postgres escribe así los nombres de
     * tabla y de columna —`column "fecha_baja" does not exist`—, que es
     * justamente lo que hace útil el mensaje. Lo que se limpia es lo de las
     * comillas SIMPLES, que es como escribe los VALORES.
     */
    .replace(/'[^']{0,200}'/g, "'…'")
    /*
     * NÚMEROS DE CUATRO CIFRAS O MÁS: importes en céntimos, marcas de tiempo,
     * números de fila, trozos de identificador.
     *
     * MENOS LOS AÑOS. «El ejercicio 2026 no existe» sin el año no dice nada, y
     * un año no identifica a nadie. Se salvan a mano —`19xx` y `20xx`— porque
     * el corte por número de cifras se los llevaba por delante: 2026 tiene
     * cuatro. Aquí había un comentario que decía que «se salvan por poco», y
     * era falso; lo cazó `pruebas/vigilancia.prueba.mjs`.
     */
    .replace(/\b\d{4,}\b/g, (n) => (/^(19|20)\d{2}$/.test(n) ? n : '‹n›'))
    .trim()
    .slice(0, 500)
}

/**
 * EL CARGO DE QUIEN ESTÁ. Nunca su nombre, nunca su correo: solo «Tesorero/a».
 *
 * Casi todo lo que falla depende de los permisos, así que saber el cargo suele
 * ser la diferencia entre reproducir el fallo a la primera o no reproducirlo.
 *
 * Se guarda aquí y no se pregunta: averiguarlo es asíncrono (`useCargoDeLaSesion`
 * hace tres consultas) y este módulo se ejecuta cuando algo YA se ha roto, que
 * es el peor momento para ponerse a consultar. Lo apunta `AppShell` en cuanto
 * lo sabe; si el fallo llega antes, se manda vacío y ya está.
 */
let cargoApuntado = ''

/** La llama `AppShell` cuando resuelve el cargo. Ver arriba. */
export function apuntarCargo(cargo: string | null | undefined): void {
  cargoApuntado = String(cargo ?? '')
}

export interface FalloVisto {
  mensaje: string
  pila?: string
  clase?: 'js' | 'promesa' | 'base'
}

/**
 * Guarda un fallo. No espera, no lanza y no devuelve nada útil: es a propósito.
 *
 * Se exporta para poder llamarla a mano desde un `catch` donde el fallo importa
 * y no llegaría solo (un `try/catch` que ya trata el error se lo come antes de
 * que `window.onerror` lo vea).
 */
export function anotarFallo(f: FalloVisto): void {
  try {
    if (enviando) return                       // regla 2
    if (cuantos >= TECHO_POR_SESION) return    // regla 4
    if (!isSupabaseConfigured || !supabase) return
    if (modoDemoActivo()) return
    if (typeof window === 'undefined') return

    const mensaje = limpiarMensaje(f.mensaje)
    if (!mensaje) return
    if (yaMandados.has(mensaje)) return        // regla 3
    yaMandados.add(mensaje)
    cuantos += 1

    enviando = true
    /*
     * SIN `hermandad_id`: la pone la base sola con `default hermandad_actual()`.
     *
     * Mandarlo desde aquí sería mandar un dato que el navegador cree saber; la
     * base lo sabe de verdad. Y si `hermandad_actual()` es nulo —una cuenta
     * recién registrada— la política lo rechaza y no se guarda nada, que es
     * exactamente lo correcto: un error sin hermandad no se le puede atribuir
     * a nadie.
     */
    void supabase
      .from('errores_cliente')
      .insert({
        ruta: window.location?.pathname ?? '',
        mensaje,
        pila: limpiarMensaje(String(f.pila ?? '')).slice(0, 2000),
        clase: f.clase ?? 'js',
        navegador: String(navigator?.userAgent ?? '').slice(0, 300),
        version_app: versionApp(),
        cargo: cargoApuntado,
      })
      .then(
        () => { enviando = false },
        () => { enviando = false },
      )
  } catch {
    // Regla 1. Aquí no se puede hacer nada más y decirlo sería el bucle.
    enviando = false
  }
}

/**
 * Engancha la vigilancia. Se llama UNA VEZ, desde `main.tsx`, antes de pintar
 * nada: un error al montar el primer componente también cuenta.
 *
 * Devuelve una función para soltarla, que solo usan las pruebas.
 */
export function vigilar(): () => void {
  if (typeof window === 'undefined' || enganchado) return () => {}
  enganchado = true

  const alRomperse = (e: ErrorEvent) => {
    anotarFallo({
      mensaje: e.message || String(e.error ?? 'error sin mensaje'),
      pila: e.error instanceof Error ? e.error.stack : '',
      clase: 'js',
    })
  }

  const alQuedarColgada = (e: PromiseRejectionEvent) => {
    const r = e.reason
    anotarFallo({
      mensaje: r instanceof Error ? r.message : String(r ?? 'promesa rechazada sin motivo'),
      pila: r instanceof Error ? r.stack : '',
      clase: 'promesa',
    })
  }

  /*
   * EL FALLO DE LA BASE DE DATOS, que es el que de verdad interesa.
   *
   * `AppShell` ya escucha este evento para pintar la banda de aviso. Que lo
   * escuche también el vigilante no duplica nada: uno se lo cuenta a quien está
   * delante, el otro a quien lo puede arreglar.
   */
  const alFallarLaBase = (e: Event) => {
    const d = (e as CustomEvent<{ tabla?: string; fallos?: string[] }>).detail
    const primero = (d?.fallos ?? [])[0]
    if (!primero) return
    anotarFallo({ mensaje: `${d?.tabla ?? '?'} · ${primero}`, clase: 'base' })
  }

  window.addEventListener('error', alRomperse)
  window.addEventListener('unhandledrejection', alQuedarColgada)
  window.addEventListener('cabildo-sync-error', alFallarLaBase)

  return () => {
    window.removeEventListener('error', alRomperse)
    window.removeEventListener('unhandledrejection', alQuedarColgada)
    window.removeEventListener('cabildo-sync-error', alFallarLaBase)
    enganchado = false
  }
}

/** Solo para las pruebas: deja el contador y la memoria como recién arrancado. */
export function reiniciarVigilancia(): void {
  yaMandados.clear()
  cuantos = 0
  cargoApuntado = ''
  enviando = false
  enganchado = false
}
