/**
 * LAS CAMPAÑAS Y LOS PROYECTOS DE LA DEMO.
 *
 * Van en `data/` y no en `lib/` por lo mismo que el resto de los datos de
 * ejemplo: son contenido, no reglas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOS IDENTIFICADORES SON FIJOS Y ESO IMPORTA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lo que lleva recogido una campaña NO se guarda en la campaña: se cuenta
 * sumando los apuntes de Tesorería que llevan su marca —ver
 * `lib/recaudaciones.ts`—. Así que para que la demo enseñe una barra a medias,
 * los apuntes de `data/movimientos.ts` tienen que apuntar A ESTOS
 * IDENTIFICADORES, con esta forma exacta:
 *
 *     origen: 'campana:<id de la campaña>:<id de la aportación>'
 *
 * Con identificadores generados al azar no habría forma de escribirlos, la
 * barra saldría a cero y la demo enseñaría la pantalla vacía justo en lo único
 * que se pidió: «una barra hasta que se llegue al objetivo».
 *
 * Hay una prueba que comprueba que las dos mitades siguen cuadrando, porque es
 * exactamente el tipo de enlace que se rompe al tocar una de las dos y no se
 * nota hasta que alguien abre la demo.
 */
import type { Recaudacion } from '../lib/recaudaciones'
import type { Proyecto, TareaProyecto } from '../lib/proyectos'

export const CAMPANA_PALIO = 'camp-palio'
export const CAMPANA_CARIDAD = 'camp-caridad'
export const CAMPANA_TEJADO = 'camp-tejado'

export const RECAUDACIONES_INICIALES: Recaudacion[] = [
  {
    id: CAMPANA_PALIO,
    nombre: 'Restauración del palio',
    descripcion:
      'Los bordados del techo de palio están pasados a tisú nuevo a medias. Se restaura por '
      + 'faldones, y cada uno son unos ocho meses de taller.',
    objetivo: 24000,
    fechaInicio: '2026-01-07',
    fechaFin: '2027-02-28',
    estado: 'abierta',
    enLaWeb: true,
    creadaEn: '2026-01-07T10:00:00.000Z',
  },
  {
    id: CAMPANA_CARIDAD,
    // Una campaña SIN objetivo: el cepillo de caridad no tiene cifra a la que
    // llegar. Está aquí para que la demo enseñe también ese caso, que se pinta
    // sin barra — si no, parecería que una campaña sin objetivo está rota.
    nombre: 'Cepillo de caridad',
    descripcion: 'Lo que se recoge va íntegro a la bolsa de caridad de la hermandad.',
    objetivo: 0,
    fechaInicio: '2026-01-01',
    estado: 'abierta',
    enLaWeb: true,
    creadaEn: '2026-01-01T09:00:00.000Z',
  },
  {
    id: CAMPANA_TEJADO,
    // Y una CERRADA que llegó al objetivo: es lo que se mira el año siguiente
    // para saber si una campaña de este tamaño es realista.
    nombre: 'Tejado de la casa de hermandad',
    descripcion: 'Sustitución de las vigas del salón alto, que entraba agua.',
    objetivo: 9000,
    fechaInicio: '2025-03-01',
    fechaFin: '2025-11-30',
    estado: 'cerrada',
    enLaWeb: false,
    creadaEn: '2025-03-01T09:00:00.000Z',
  },
]

export const PROYECTOS_INICIALES: Proyecto[] = [
  {
    id: 'proy-palio',
    nombre: 'Restaurar el paso de palio',
    descripcion:
      'Techo de palio, bambalinas y varales. Va por fases y depende de lo que entre por la campaña.',
    estado: 'en marcha',
    responsableId: 'h13',
    responsableNombre: 'Rafael Ortiz Bermejo',
    fechaObjetivo: '2027-03-01',
    presupuesto: 24000,
    recaudacionId: CAMPANA_PALIO,
    creadoEn: '2026-01-07T10:05:00.000Z',
  },
  {
    id: 'proy-libro',
    // Un proyecto en «idea»: lo que se habló en un cabildo y quedó ahí. Sin un
    // sitio donde ponerlo se pierde entre un acta y la siguiente.
    nombre: 'Libro del centenario',
    descripcion: 'Recopilar el archivo fotográfico y encargar los textos. Se habló en el último cabildo.',
    estado: 'idea',
    presupuesto: 0,
    creadoEn: '2026-02-10T20:30:00.000Z',
  },
  {
    id: 'proy-almacen',
    // Y uno que VA TARDE, con la fecha ya pasada: es el que hay que mirar, y
    // la pantalla lo pone el primero y con el borde en rojo.
    nombre: 'Ordenar el almacén de enseres',
    descripcion: 'Inventariar lo que hay en el sótano y tirar lo que ya no sirve.',
    estado: 'parado',
    responsableId: 'h9',
    responsableNombre: 'Lucía Fernández Soto',
    fechaObjetivo: '2026-06-30',
    presupuesto: 400,
    creadoEn: '2026-01-20T18:00:00.000Z',
  },
]

export const TAREAS_PROYECTO_INICIALES: TareaProyecto[] = [
  { id: 'tp1', proyectoId: 'proy-palio', titulo: 'Pedir tres presupuestos de taller', hecha: true, creadaEn: '2026-01-08T10:00:00.000Z' },
  { id: 'tp2', proyectoId: 'proy-palio', titulo: 'Llevar el techo de palio al taller', hecha: true, fechaLimite: '2026-04-15', creadaEn: '2026-01-08T10:01:00.000Z' },
  { id: 'tp3', proyectoId: 'proy-palio', titulo: 'Primera bambalina', hecha: false, fechaLimite: '2026-11-30', hermanoId: 'h13', hermanoNombre: 'Rafael Ortiz Bermejo', creadaEn: '2026-01-08T10:02:00.000Z' },
  { id: 'tp4', proyectoId: 'proy-palio', titulo: 'Segunda bambalina', hecha: false, fechaLimite: '2027-01-31', creadaEn: '2026-01-08T10:03:00.000Z' },
  { id: 'tp5', proyectoId: 'proy-almacen', titulo: 'Vaciar las estanterías del fondo', hecha: true, creadaEn: '2026-01-20T18:05:00.000Z' },
  { id: 'tp6', proyectoId: 'proy-almacen', titulo: 'Fotografiar cada enser y darlo de alta en Inventario', hecha: false, fechaLimite: '2026-05-31', creadaEn: '2026-01-20T18:06:00.000Z' },
]
