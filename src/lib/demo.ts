import { CLAVES_DATOS } from './persistencia'
import { isSupabaseConfigured } from './supabase'

/**
 * Modo demostración con dos puntos de partida, para probar la app sin base de
 * datos:
 *   - LLENA: censo, papeletas, cuotas… de ejemplo (para ver funciones ya con
 *     datos).
 *   - VACÍA: una hermandad sin hermanos ni registros (para empezar de cero y
 *     crear tus propios datos), pero con la configuración por defecto (tramos,
 *     cargos, campaña) para que todo siga funcionando.
 *
 * Ambas escriben en localStorage y NO tocan el usuario demo. Los módulos leen
 * su colección al montarse, así que basta con navegar o recargar para verlo.
 */

/** Colecciones de personas y registros que se vacían en la demo vacía. */
const CLAVES_COLECCIONES = [
  CLAVES_DATOS.hermanos,
  CLAVES_DATOS.cuotas,
  CLAVES_DATOS.papeletas,
  CLAVES_DATOS.incidencias,
  CLAVES_DATOS.movimientos,
  CLAVES_DATOS.enseres,
  CLAVES_DATOS.documentos,
  CLAVES_DATOS.comunicados,
  CLAVES_DATOS.cuentasSociales,
  CLAVES_DATOS.eventos,
  CLAVES_DATOS.recaudaciones,
  CLAVES_DATOS.proyectos,
  CLAVES_DATOS.tareasProyecto,
  // La tienda: catálogo, descuentos y lo vendido. En una hermandad que empieza
  // de cero tampoco hay tienda montada.
  CLAVES_DATOS.productos,
  CLAVES_DATOS.descuentos,
  CLAVES_DATOS.ventas,
  CLAVES_DATOS.lineasVenta,
  CLAVES_DATOS.movimientosStock,
  CLAVES_DATOS.reservas,
  CLAVES_DATOS.lineasReserva,
  'cabildo-solicitudes-papeleta',
  'cabildo-convocatoria',
  // Personal con acceso al panel: en una hermandad vacía tampoco hay cargos
  // de ejemplo (si no, la demo «de cero» aparecía con seis accesos creados).
  'cabildo-personal',
]

/** Se conservan al restablecer una demo (sesión demo y consentimiento del hermano). */
const CLAVES_CONSERVADAS = new Set(['cabildo-demo-user', 'cabildo-hermano-consent'])

const CLAVE_MODO = 'cabildo-demo-modo'

/** Borra todo dato guardado de la app salvo las claves que se conservan. */
function limpiarTodo() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('cabildo-') && !CLAVES_CONSERVADAS.has(k))
    .forEach((k) => localStorage.removeItem(k))
}

/**
 * Los datos de la hermandad en la demostración «llena». Hacen falta porque esa
 * demo enseña una hermandad **que ya funciona**: sin CIF ni cuenta, los recibos
 * salen sin justificante y al hermano no se le puede decir dónde pagar, y lo
 * que se está enseñando es justamente que eso funciona.
 */
/*
 * LOS NÚMEROS DE LA DEMO PASAN SUS PROPIAS COMPROBACIONES, y no es un detalle
 * estético. El CIF, el IBAN y el identificador de acreedor se validan al
 * teclearlos —lib/nif.ts, lib/iban.ts—, así que unos inventados a ojo pintaban
 * tres avisos rojos en Configuración nada más entrar en la demo. Quien la abre
 * para ver si esto le sirve concluye, con razón, que viene rota.
 *
 * Los de antes estaban mal los tres: el CIF llevaba control 0 cuando le toca 1,
 * y del IBAN y el identificador no cuadraban los dígitos de control. Estos están
 * calculados con la regla oficial y siguen siendo inventados: la cuenta no
 * existe y el 41010 es un código postal de Sevilla cualquiera.
 */
const HERMANDAD_DEMO = {
  nombreLegal: 'Real e Ilustre Hermandad de Nuestro Padre Jesús',
  cif: 'G41000001',
  direccion: 'C/ Pureza, 53',
  codigoPostal: '41010',
  ciudad: 'Sevilla',
  provincia: 'Sevilla',
  telefono: '954 000 000',
  email: 'secretaria@hermandad.example',
  iban: 'ES52 2100 0813 6102 0012 3456',
  bizumTelefono: '655 123 456',
  identificadorAcreedor: 'ES67000G41000001',
  logoDataUrl: null,
  colorPrimario: '#6A1A23',
  colorSecundario: '#C5A059',
  textoPieDocumentos: '',
}

/** Deja el navegador con los datos de ejemplo completos (censo, papeletas, cuotas…). */
export function sembrarDemoLlena() {
  limpiarTodo()
  localStorage.setItem(CLAVE_MODO, 'llena')
  localStorage.setItem('cabildo-hermandad-settings', JSON.stringify(HERMANDAD_DEMO))
  // Esta demo enseña una hermandad que YA está en marcha: el asistente de alta
  // taparía el panel para pedirle datos que se supone que puso hace años.
  localStorage.setItem('cabildo-alta-hermandad-hecha', 'si')
}

/** Deja una hermandad vacía: sin hermanos, papeletas ni registros (config por defecto). */
export function sembrarDemoVacia() {
  limpiarTodo()
  CLAVES_COLECCIONES.forEach((k) => localStorage.setItem(k, '[]'))
  localStorage.setItem(CLAVE_MODO, 'vacia')
  // Aquí el asistente SÍ sale: es exactamente el caso para el que se hizo,
  // una hermandad que empieza de cero.
}

/**
 * Restaura solo el censo/papeletas/cuotas de ejemplo, sin tocar el resto
 * (web, colores, tramos…). Sirve para que el acceso demo del hermano funcione
 * siempre, aunque el navegador tenga un censo viejo de pruebas anteriores.
 */
export function restaurarCensoDemo() {
  localStorage.removeItem(CLAVES_DATOS.hermanos)
  localStorage.removeItem(CLAVES_DATOS.papeletas)
  localStorage.removeItem(CLAVES_DATOS.cuotas)
}

/** Punto de partida de demo activo, si se eligió alguno. */
export function demoModo(): 'llena' | 'vacia' | null {
  try {
    const v = localStorage.getItem(CLAVE_MODO) ?? sessionStorage.getItem(CLAVE_MODO)
    return v === 'llena' || v === 'vacia' ? v : null
  } catch {
    return null
  }
}

/**
 * ¿Estamos en modo demo? Cuando lo estamos, los datos deben leerse en local
 * (censo, papeletas… de ejemplo) sin depender de Supabase, aunque el proyecto
 * esté configurado pero en pausa. Así el acceso demo funciona siempre.
 */
export function modoDemoActivo(): boolean {
  /*
   * CON BASE DE DATOS CONECTADA NO HAY DEMOSTRACIÓN, HAYA LO QUE HAYA
   * GUARDADO EN ESTE NAVEGADOR.
   *
   * La marca solo se puede encender desde pantallas que están detrás de
   * `!isSupabaseConfigured`, así que cuando Supabase SÍ está configurado y la
   * marca existe, es un resto: de cuando esta web se probaba sin base de
   * datos, o de un navegador que jugó con la demostración antes del despliegue.
   *
   * Y ese resto no era inofensivo. `useSupabaseTable` decide al montarse si
   * lee de la base o del navegador, y esta función era la mitad de esa
   * decisión: con la marca vieja puesta, la secretaría abría el panel con
   * Supabase conectado y trabajaba contra su propio navegador —altas, cuotas,
   * papeletas— sin escribir nada en la base y sin un solo aviso. `limpiarModoDemo()`
   * la borra al iniciar sesión, pero eso llega tarde si la tabla ya se montó.
   *
   * Así, el resto es inofensivo para siempre y no depende de que nadie se
   * acuerde de limpiarlo a tiempo.
   */
  if (isSupabaseConfigured) return false
  try {
    // Los dos sitios: en `localStorage` lo deja «sembrar datos de ejemplo»
    // (deliberado, dura entre sesiones); en `sessionStorage`, el acceso rápido
    // del portal del hermano, que solo debe durar esta pestaña.
    return localStorage.getItem(CLAVE_MODO) !== null || sessionStorage.getItem(CLAVE_MODO) !== null
  } catch {
    return false
  }
}

/**
 * Marca el modo demo (sin borrar nada) si aún no había ninguno elegido.
 *
 * En `sessionStorage`, no en `localStorage`: la marca no debe sobrevivir al
 * cierre del navegador. Un clic en «entrar en modo demo» dejaba el panel
 * trabajando SOLO contra el navegador —sin escribir en la base de datos y sin
 * avisar de nada— para siempre, y la secretaría podía pasar días dando altas
 * que no existían en ningún otro sitio.
 */
export function marcarModoDemo() {
  try {
    if (!sessionStorage.getItem(CLAVE_MODO) && !localStorage.getItem(CLAVE_MODO)) {
      sessionStorage.setItem(CLAVE_MODO, 'llena')
    }
  } catch {
    // sin almacenamiento: la app sigue en memoria
  }
}

/** Sale del modo demo (p. ej. al iniciar sesión de verdad contra Supabase). */
export function limpiarModoDemo() {
  try {
    localStorage.removeItem(CLAVE_MODO)
    sessionStorage.removeItem(CLAVE_MODO)
  } catch {
    // nada que hacer
  }
}


/**
 * ¿Lo que se está viendo son datos de ejemplo?
 *
 * Hace falta porque media aplicación lo daba por hecho. Cinco pantallas
 * ponían «datos de ejemplo mientras conectamos la base de datos» pasara lo que
 * pasara, así que una hermandad con su censo de verdad dentro leía eso encima
 * de sus 800 hermanos.
 *
 * Y en los documentos impresos era peor: el pie de un recibo decía «datos de
 * ejemplo, sin validez fiscal» por defecto. Ese papel se le entrega a un
 * hermano en mano, y lo que ponía era que no valía para nada.
 */
export function hayDatosDeEjemplo(): boolean {
  return !isSupabaseConfigured || modoDemoActivo()
}
