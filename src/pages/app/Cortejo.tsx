import { hayDatosDeEjemplo } from '../../lib/demo'
import { llano } from '../../lib/buscar'
import { useMemo, useState, type FormEvent, useRef } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import HermanoPicker from '../../components/HermanoPicker'
import { hermanosAsignables } from '../../lib/asignables'
import { LogoMark } from '../../components/Logo'
import AsistenciaTramo from '../../components/AsistenciaTramo'
import { useAsistencias, registroDe } from '../../lib/asistencia'
import { HERMANOS_INICIALES, initials, type Hermano } from '../../data/hermanos'
import { PAPELETAS_INICIALES, type Papeleta } from '../../data/papeletas'
import { INCIDENCIAS_INICIALES, TIPOS_INCIDENCIA_POR_DEFECTO, type Incidencia, type TipoIncidencia } from '../../data/incidencias'
import { CLAVES_CATALOGOS, useLista } from '../../lib/catalogos'
import {
  etiquetaTramo,
  useTramos,
  tramosDeCuerpo,
  cuerposPresentes as cuerposDeTramos,
  precioDeTramo,
  type Cuerpo,
  type Tramo,
} from '../../lib/tramos'
import { puedeSalirEnElCortejo, repartoCompleto, repartoPorTramo, type Asignacion, type EstadoAsignacion } from '../../lib/cortejo'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings, type HermandadSettings } from '../../lib/hermandadSettings'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { papeletaToRow, rowToPapeleta } from '../../lib/db/papeletas'
import { incidenciaToRow, rowToIncidencia } from '../../lib/db/incidencias'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { conApunteDeCobro, origenDePapeleta } from '../../lib/apuntes'
import { getCampana, useCampana } from '../../lib/campana'
import { useFocoDeDialogo } from '../../lib/foco'


type FilaEstado = EstadoAsignacion | 'Pendiente' | 'Baja'

interface Fila {
  papeleta: Papeleta
  hermano: Hermano
  tramo: Tramo | null
  puesto: number | null
  estado: FilaEstado
}

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function tituloCuerpo(cuerpo: Cuerpo): string {
  if (cuerpo === 'Cristo') return 'Cortejo de Cristo'
  if (cuerpo === 'Virgen') return 'Cortejo de la Virgen'
  if (cuerpo === 'Único') return 'Tramos'
  return `Cortejo — ${cuerpo}`
}

function estadoPillClass(estado: FilaEstado) {
  if (estado === 'Confirmada') return 'pill--ok'
  if (estado === 'Con incidencia' || estado === 'Excede aforo') return 'pill--err'
  if (estado === 'Baja') return 'pill--off'
  return 'pill--warn' // Reservada, Pendiente
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
)
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
)
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
)

export default function Cortejo() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const registrador = (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Secretaría'
  const hermandad = useHermandadSettings(fallbackNombre)
  const tramos = useTramos()
  const campana = useCampana()
  const edicionActual = campana.anio

  const [papeletasTodas, setPapeletas] = useSupabaseTable<Papeleta>(
    'papeletas',
    CLAVES_DATOS.papeletas,
    PAPELETAS_INICIALES,
    papeletaToRow,
    rowToPapeleta,
  )
  // El cortejo solo trabaja con las papeletas de la campaña activa.
  const papeletas = useMemo(() => papeletasTodas.filter((p) => p.anio === edicionActual), [papeletasTodas, edicionActual])
  const [incidencias, setIncidencias] = useSupabaseTable<Incidencia>(
    'incidencias',
    CLAVES_DATOS.incidencias,
    INCIDENCIAS_INICIALES,
    incidenciaToRow,
    rowToIncidencia,
  )

  const [query, setQuery] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'Todos' | 'Con hueco' | 'Completo' | 'Con incidencia' | 'Excede aforo'>('Todos')
  const [cuerpoFiltro, setCuerpoFiltro] = useState<'Todos' | Cuerpo>('Todos')
  const [vista, setVista] = useState<'tarjetas' | 'tabla'>('tarjetas')
  const [diaDeSalida, setDiaDeSalida] = useState(false)

  const [tramoAbiertoId, setTramoAbiertoId] = useState<string | null>(null)
  const [asignarOpen, setAsignarOpen] = useState(false)
  const [asignarError, setAsignarError] = useState<string | null>(null)
  const [asignarCuerpo, setAsignarCuerpo] = useState<Cuerpo | ''>('')
  const [ordenOpen, setOrdenOpen] = useState(false)
  const [incidenciaPara, setIncidenciaPara] = useState<string | null>(null)

  const hermanos = useMemo(() => leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])

  const incidenciasAbiertas = useMemo(
    () => new Set(incidencias.filter((i) => !i.resuelta).map((i) => i.papeletaId)),
    [incidencias],
  )

  // Reparto automático por número: la hermandad define los tramos y su aforo,
  // y la app coloca a los hermanos de cada cuerpo por número, llenando los
  // tramos en orden (al llenarse uno, empieza el siguiente; efecto cascada).
  const asignaciones = useMemo(
    () => repartoCompleto(tramos, papeletas, hermanoDe, incidenciasAbiertas),
    [tramos, papeletas, hermanoDe, incidenciasAbiertas],
  )
  const repartos = useMemo(() => repartoPorTramo(asignaciones), [asignaciones])

  const excedeAforo = useMemo(
    () =>
      asignaciones
        .filter((a) => a.estado === 'Excede aforo' && a.tramo)
        .map((a) => ({ asignacion: a, tramo: a.tramo as Tramo })),
    [asignaciones],
  )

  const pendientes = useMemo(
    () => papeletas.filter((p) => p.estado === 'Solicitada' && !p.tramoId),
    [papeletas],
  )

  /**
   * Papeletas activas cuyo tramo YA NO EXISTE.
   *
   * Pasa cuando alguien quita un tramo en Configuración teniendo papeletas
   * dentro. Antes esos hermanos se evaporaban: no entraban en ningún reparto
   * (`repartoDeCuerpo` solo reparte sobre tramos que existen), no salían en
   * «Pendientes» (esa lista solo recoge las 'Solicitada' SIN tramo) ni entre
   * las anuladas. En Papeletas su fila seguía diciendo «Renovada» tan
   * tranquila. Ocho personas con su papeleta cobrada, fuera del cortejo, y
   * nadie se enteraba hasta el día de la salida.
   *
   * Aquí se recogen y se enseñan aparte para recolocarlas.
   */
  const huerfanas = useMemo(() => {
    // Mientras la lista de tramos no ha llegado de la base de datos, TODAS las
    // papeletas parecerían huérfanas y saldría un aviso falso alarmante.
    if (tramos.length === 0) return []
    const existentes = new Set(tramos.map((t) => t.id))
    return papeletas.filter(
      (p) =>
        p.anio === edicionActual &&
        p.tramoId !== null &&
        !existentes.has(p.tramoId) &&
        p.estado !== 'Anulada' &&
        p.estado !== 'Renuncia',
    )
  }, [papeletas, tramos, edicionActual])

  const cuerposPresentes = useMemo(() => cuerposDeTramos(tramos), [tramos])
  // El precio de la hermandad, no el de este navegador (ver hermandadSettings).
  const precioBase = hermandad.precioPapeleta
  const tiposIncidencia = useLista(CLAVES_CATALOGOS.tiposIncidencia, TIPOS_INCIDENCIA_POR_DEFECTO)

  const stats = useMemo(() => {
    let cubiertos = 0
    let total = 0
    let completos = 0
    tramos.forEach((t) => {
      const reparto = (repartos.get(t.id) ?? []).filter((a) => a.estado !== 'Excede aforo')
      cubiertos += reparto.length
      total += t.capacidad
      // Un tramo de aforo 0 no está «completo»: está sin configurar.
      if (t.capacidad > 0 && reparto.length >= t.capacidad) completos += 1
    })
    return {
      cubiertos,
      total,
      completos,
      tramosTotal: tramos.length,
      excedeAforo: excedeAforo.length,
      incidenciasAbiertas: incidenciasAbiertas.size,
    }
  }, [tramos, repartos, excedeAforo, incidenciasAbiertas])

  // ---------- filas combinadas (para la vista tabla y para filtrar tarjetas) ----------
  const filas = useMemo(() => {
    const out: Fila[] = []
    tramos.forEach((t) => {
      ;(repartos.get(t.id) ?? []).forEach((a) => {
        out.push({ papeleta: a.papeleta, hermano: a.hermano, tramo: t, puesto: a.puesto, estado: a.estado })
      })
    })
    pendientes.forEach((p) => {
      const h = hermanoDe(p.hermanoId)
      if (h) out.push({ papeleta: p, hermano: h, tramo: null, puesto: null, estado: 'Pendiente' })
    })
    // Las que apuntan a un tramo que ya no existe salen aquí, igual que las
    // pendientes: es la única manera de que alguien las vea y las recoloque.
    // Antes se caían del listado y de todos los repartos, en silencio.
    huerfanas.forEach((p) => {
      const h = hermanoDe(p.hermanoId)
      if (h) out.push({ papeleta: p, hermano: h, tramo: null, puesto: null, estado: 'Pendiente' })
    })
    papeletas
      .filter((p) => p.estado === 'Anulada')
      .forEach((p) => {
        const h = hermanoDe(p.hermanoId)
        if (h) out.push({ papeleta: p, hermano: h, tramo: null, puesto: null, estado: 'Baja' })
      })
    return out
  }, [tramos, repartos, pendientes, huerfanas, papeletas, hermanoDe])

  function pasaFiltros(tramo: Tramo | null, filaEstado: FilaEstado, textoBusqueda: string) {
    if (cuerpoFiltro !== 'Todos' && tramo?.cuerpo !== cuerpoFiltro) return false
    if (estadoFiltro === 'Con incidencia' && filaEstado !== 'Con incidencia') return false
    if (estadoFiltro === 'Excede aforo' && filaEstado !== 'Excede aforo') return false
    if (estadoFiltro === 'Con hueco' || estadoFiltro === 'Completo') {
      if (!tramo) return false
      const reparto = (repartos.get(tramo.id) ?? []).filter((a) => a.estado !== 'Excede aforo')
      const estado = reparto.length >= tramo.capacidad ? 'Completo' : 'Con hueco'
      if (estado !== estadoFiltro) return false
    }
    const q = llano(query)
    if (q && !llano(textoBusqueda).includes(q)) return false
    return true
  }

  // Si hay algo escrito o filtrado. Sirve para distinguir «no encuentro nada»
  // de «no hay nada», que no son lo mismo y no se arreglan igual.
  const hayFiltroPuesto = cuerpoFiltro !== 'Todos' || estadoFiltro !== 'Todos' || query.trim() !== ''

  const tramosFiltrados = useMemo(() => {
    return tramos.filter((t) => {
      const reparto = repartos.get(t.id) ?? []
      const texto = `${etiquetaTramo(t)} ${reparto.map((a) => `${a.hermano.nombre} ${a.hermano.numero}`).join(' ')}`
      const filaEstado: FilaEstado = reparto.some((a) => a.estado === 'Con incidencia')
        ? 'Con incidencia'
        : reparto.some((a) => a.estado === 'Excede aforo')
          ? 'Excede aforo'
          : 'Reservada'
      return pasaFiltros(t, filaEstado, texto)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramos, repartos, cuerpoFiltro, estadoFiltro, query])

  const filasFiltradas = useMemo(() => {
    return filas.filter((f) => pasaFiltros(f.tramo, f.estado, `${f.hermano.nombre} ${f.hermano.numero} ${f.tramo ? etiquetaTramo(f.tramo) : ''}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, cuerpoFiltro, estadoFiltro, query])

  const tramoAbierto = tramos.find((t) => t.id === tramoAbiertoId) ?? null
  const repartoAbierto = tramoAbierto ? (repartos.get(tramoAbierto.id) ?? []) : []

  const tramosDelCuerpoElegido = useMemo(
    () => (asignarCuerpo ? tramosDeCuerpo(asignarCuerpo, tramos) : []),
    [asignarCuerpo, tramos],
  )

  // ---------- acciones ----------

  /*
   * COBRAR AQUÍ TAMBIÉN ES COBRAR, y esta pantalla no lo apuntaba.
   *
   * Desde el cortejo se marca pagada una papeleta —y en el pase de lista del
   * día de salida se cobra en mano al que llega sin pagar—, y nada de eso
   * llegaba al libro. Es dinero que entra en un sobre en la puerta de la casa
   * hermandad y que Tesorería no ve, que es exactamente el caso en el que un
   * descuadre no se puede reconstruir después.
   *
   * `conApunteDeCobro` no duplica: si la papeleta ya se cobró desde su
   * pantalla, esto no vuelve a apuntarla.
   */
  const [, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento,
  )

  function apuntarPapeleta(p: Papeleta, metodo: string | null | undefined, fecha: string) {
    // Una papeleta exenta se da por pagada a importe cero: no hay dinero que
    // apuntar, y apuntarlo sería inventarse un ingreso.
    if (!(p.importe > 0)) return
    setMovimientos((prev) => conApunteDeCobro(prev, {
      origen: origenDePapeleta(p.id),
      concepto: `Papeleta de sitio ${p.anio} — ${hermanos.find((h) => h.id === p.hermanoId)?.nombre ?? 'hermano/a'}`,
      categoria: 'Papeletas de Sitio',
      importe: p.importe,
      fecha,
      metodo,
    }))
  }

  function marcarPagada(papeletaId: string) {
    const hoyTexto = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    setPapeletas((prev) => prev.map((p) => (p.id === papeletaId
      ? { ...p, estado: 'Pagada', metodoPago: p.metodoPago ?? 'Efectivo', fechaPago: p.fechaPago ?? hoyTexto }
      : p)))
    const p = papeletasTodas.find((x) => x.id === papeletaId)
    if (p) apuntarPapeleta(p, p.metodoPago ?? 'Efectivo', hoyTexto)
  }

  function marcarPresente(papeletaId: string) {
    // "Pase de lista" del día de salida: si aún no estaba pagada, se confirma
    // también el pago en mano, dejando constancia del método y la fecha (antes
    // pasaba a "Entregada" sin registro y el dinero aparecía sin justificar).
    const hoyTexto = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    setPapeletas((prev) =>
      prev.map((p) => {
        if (p.id !== papeletaId) return p
        const yaPagada = p.estado === 'Pagada' || p.estado === 'Entregada'
        return {
          ...p,
          estado: 'Entregada',
          fechaEntrega: p.fechaEntrega ?? hoyTexto,
          metodoPago: yaPagada ? p.metodoPago : p.metodoPago ?? 'Efectivo',
          fechaPago: yaPagada ? p.fechaPago : p.fechaPago ?? hoyTexto,
        }
      }),
    )
    /*
     * Y SI SE LE HA COBRADO AQUÍ, al libro. En el pase de lista se cobra en
     * mano al que llega sin haber pagado: ese dinero entra en un sobre en la
     * puerta y hasta ahora no lo veía nadie más.
     */
    const p = papeletasTodas.find((x) => x.id === papeletaId)
    if (p && p.estado !== 'Pagada' && p.estado !== 'Entregada') {
      apuntarPapeleta(p, p.metodoPago ?? 'Efectivo', hoyTexto)
    }
  }

  function registrarIncidencia(papeletaId: string, tipo: TipoIncidencia, descripcion: string) {
    const nueva: Incidencia = {
      id: nuevoId(),
      papeletaId,
      tipo,
      descripcion,
      hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      registradoPor: registrador,
      resuelta: false,
    }
    setIncidencias((prev) => [nueva, ...prev])
    setIncidenciaPara(null)
  }

  function resolverIncidenciaDePapeleta(papeletaId: string, comoBaja: boolean) {
    setIncidencias((prev) =>
      prev.map((i) => (i.papeletaId === papeletaId && !i.resuelta ? { ...i, resuelta: true } : i)),
    )
    if (comoBaja) {
      setPapeletas((prev) => prev.map((p) => (p.id === papeletaId ? { ...p, estado: 'Anulada' } : p)))
    }
  }

  function abrirAsignar() {
    setAsignarError(null)
    setAsignarCuerpo(cuerposPresentes.length === 1 ? cuerposPresentes[0] : '')
    setAsignarOpen(true)
  }

  function handleAsignarHermano(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const hermanoId = String(data.get('hermanoId') ?? '')
    const tramoId = String(data.get('tramoId') ?? '')
    const hermano = hermanos.find((h) => h.id === hermanoId)
    const tramo = tramos.find((t) => t.id === tramoId)
    if (!hermano) {
      setAsignarError('Elige un hermano de la lista.')
      return
    }
    if (!tramo) {
      setAsignarError('Elige un tramo.')
      return
    }
    /*
     * Y SE VUELVE A MIRAR AQUÍ, no solo al pintar la lista.
     *
     * Lo que esconde una pantalla no protege nada: el formulario se manda con
     * el identificador que sea, y una ficha puede haber pasado a civil o a
     * baja entre que se abrió el cajón y se pulsó «Asignar».
     */
    if (!puedeSalirEnElCortejo(hermano)) {
      setAsignarError(
        hermano.civil
          ? `${hermano.nombre.split(' ')[0]} está en el censo como hermano/a civil: no hace estación de penitencia, así que no ocupa sitio en el cortejo.`
          : `${hermano.nombre.split(' ')[0]} está de baja en la hermandad y no puede salir en el cortejo.`,
      )
      return
    }
    if (hermano.antiguedad === edicionActual) {
      setAsignarError(
        `${hermano.nombre.split(' ')[0]} es nuevo/a esta edición: hace falta al menos un año de antigüedad para salir en el cortejo.`,
      )
      return
    }

    setPapeletas((prev) => {
      const existente = prev.find(
        (p) => p.hermanoId === hermanoId && p.anio === edicionActual && p.estado !== 'Anulada',
      )
      if (existente) {
        /**
         * Al moverlo de tramo hay que rehacer DOS cosas más, no solo el tramo:
         *
         * EL IMPORTE. Un hermano con papeleta de «Cirio 1º tramo» (18 €) al
         * que se le asigna «Cruz de guía» (22 €) se quedaba a 18 €: la
         * papeleta impresa y el cobro decían 18 € por un puesto que la
         * hermandad tiene a 22. Y al revés, se le cobraban 22 € por un cirio
         * de 18.
         *
         * LA OPCIÓN. Quien tenía papeleta personalizada («Mantilla», sin
         * tramo) y pasaba a un tramo se quedaba con las dos cosas a la vez:
         * salía en el cortejo Y como mantilla, y el documento impreso decía
         * ambas. Se limpia, como hace la renovación.
         */
        const nuevoImporte = precioDeTramo(tramo, precioBase)
        // Si ya estaba cobrada por otro importe, se avisa en vez de cambiarlo
        // en silencio: eso es dinero que ya entró y hay que decidir qué hacer.
        if (
          (existente.estado === 'Pagada' || existente.estado === 'Entregada') &&
          existente.importe !== nuevoImporte
        ) {
          const sigue = window.confirm(
            `Esta papeleta ya está cobrada por ${existente.importe} € y el nuevo tramo vale ${nuevoImporte} €.\n\n` +
              'Se cambia de tramo pero NO se toca el importe cobrado: la diferencia la arregláis vosotros ' +
              'en el mostrador. ¿Continuar?',
          )
          if (!sigue) return prev
          return prev.map((p) => (p.id === existente.id ? { ...p, tramoId: tramo.id, opcion: null } : p))
        }
        return prev.map((p) =>
          p.id === existente.id
            ? {
                ...p,
                tramoId: tramo.id,
                opcion: null,
                importe: nuevoImporte,
                estado: p.estado === 'Solicitada' || p.estado === 'Renuncia' ? 'Asignada' : p.estado,
              }
            : p,
        )
      }
      const nextNumero = Math.max(0, ...prev.map((p) => p.numero)) + 1
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: nextNumero,
        hermanoId,
        anio: edicionActual,
        tramoId: tramo.id,
        importe: precioDeTramo(tramo, precioBase),
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    setAsignarError(null)
    setAsignarOpen(false)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Cortejo</p>
          <h1>Reparto y organización del cortejo</h1>
          <p className="dash-head__lead">
            {stats.cubiertos}/{stats.total} puestos cubiertos · Edición {edicionActual} ·{' '}
            <Link to="/app/configuracion" className="dash-head__link">
              Editar tramos
            </Link>
          </p>
        </div>
        <div className="dash-head__actions">
          <button className="btn btn-outline" onClick={() => setOrdenOpen(true)}>
            Imprimir orden del cortejo
          </button>
          <button className="btn btn-primary" onClick={abrirAsignar}>
            + Asignar hermano
          </button>
        </div>
      </div>

      {excedeAforo.length > 0 && (
        <div className="banner-inline banner-inline--warn">
          {excedeAforo.length} hermano{excedeAforo.length > 1 ? 's' : ''} super{excedeAforo.length > 1 ? 'an' : 'a'} el
          aforo de su tramo: {[...new Set(excedeAforo.map((x) => etiquetaTramo(x.tramo)))].join(', ')}. En los tramos
          por número se reparten solos; en los de solicitud se lo queda el de menor número.{' '}
          <Link to="/app/configuracion">Amplía el aforo en Configuración</Link>.
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Puestos cubiertos</span>
          <span className="stat-tile__value">
            {stats.cubiertos}/{stats.total}
          </span>
          <span className="stat-tile__trend stat-tile__trend--ok">
            {stats.total ? Math.round((stats.cubiertos / stats.total) * 100) : 0}%
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Tramos completos</span>
          <span className="stat-tile__value">
            {stats.completos}/{stats.tramosTotal}
          </span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Al aforo máximo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Exceden el aforo</span>
          <span className="stat-tile__value">{stats.excedeAforo}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.excedeAforo > 0 ? 'warn' : 'ok'}`}>
            {stats.excedeAforo > 0 ? 'Amplía tramos' : 'Todo cabe'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Incidencias abiertas</span>
          <span className="stat-tile__value">{stats.incidenciasAbiertas}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.incidenciasAbiertas > 0 ? 'warn' : 'ok'}`}>
            {stats.incidenciasAbiertas > 0 ? 'Requieren atención' : 'Todo en orden'}
          </span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar hermano, número o tramo"
          aria-label="Buscar en el cortejo por hermano, número o tramo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {(['Todos', 'Con hueco', 'Completo', 'Con incidencia', 'Excede aforo'] as const).map((f) => (
            <button
              key={f}
              className={`chip${estadoFiltro === f ? ' chip--active' : ''}`}
              onClick={() => setEstadoFiltro(f)}
              type="button"
            >
              {f}
            </button>
          ))}
          {cuerposPresentes.length > 1 && (
            <>
              {/* Separador: distingue el grupo de estado del grupo de cuerpo (evita ver dos «Todos» seguidos). */}
              <span className="filters__sep" aria-hidden="true" />
              {(['Todos', ...cuerposPresentes] as Array<'Todos' | Cuerpo>).map((c) => (
                <button
                  key={c}
                  className={`chip${cuerpoFiltro === c ? ' chip--active' : ''}`}
                  onClick={() => setCuerpoFiltro(c)}
                  type="button"
                >
                  {c === 'Todos' ? 'Ambos cortejos' : c}
                </button>
              ))}
            </>
          )}
          {/* Conmutador de vista: no es un filtro, va con estilo de botón aparte. */}
          <button
            className="btn btn-outline btn-sm filters__vista"
            onClick={() => setVista((v) => (v === 'tarjetas' ? 'tabla' : 'tarjetas'))}
            type="button"
          >
            {vista === 'tarjetas' ? 'Ver como tabla' : 'Ver como tarjetas'}
          </button>
        </div>
      </div>

      <label className={`interruptor cortejo-daymode-toggle${diaDeSalida ? ' interruptor--on' : ''}`} htmlFor="diaDeSalida">
        <input
          id="diaDeSalida"
          type="checkbox"
          checked={diaDeSalida}
          onChange={(e) => setDiaDeSalida(e.target.checked)}
        />
        <span className="interruptor__palanca" aria-hidden="true" />
        <span className="interruptor__texto">
          <b>Modo día de salida</b>
          <small>
            {diaDeSalida
              ? 'Marca presentes y registra incidencias desde cada tramo.'
              : 'Actívalo el día de la estación de penitencia para pasar lista.'}
          </small>
        </span>
      </label>

      {vista === 'tarjetas' ? (
        <>
          {cuerposPresentes.map((c) => (
            <CuerpoSeccion
              key={c}
              titulo={tituloCuerpo(c)}
              tramos={tramosFiltrados.filter((t) => t.cuerpo === c)}
              repartos={repartos}
              diaDeSalida={diaDeSalida}
              onAbrir={setTramoAbiertoId}
            />
          ))}
          {tramosFiltrados.length === 0 && (
            /*
             * Tres motivos distintos para una lista vacía, y antes los tres
             * decían «no hay tramos que coincidan con la búsqueda». Con el
             * cortejo sin montar, eso es directamente mentira: no es que la
             * búsqueda no encuentre nada, es que no hay nada. Y quien lo lee se
             * queda sin saber qué hacer, que es lo peor de un hueco vacío.
             */
            <p className="table-empty">
              {tramos.length === 0 ? (
                <>
                  Todavía no hay tramos. El cortejo se monta en{' '}
                  <Link to="/app/configuracion">Ajustes → Cuerpos y tramos</Link>: allí se
                  dicen los tramos, su aforo y cómo se reparten.
                </>
              ) : hayFiltroPuesto ? (
                'Ningún tramo coincide con lo que has buscado o filtrado.'
              ) : (
                'No hay tramos que enseñar.'
              )}
            </p>
          )}
        </>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                {/* En el móvil se dejan puesto, hermano, estado y las acciones:
                    el día de salida el diputado de tramo lleva el teléfono y
                    necesita marcar presente sin abrir nada. */}
                <th>Puesto</th>
                <th>Hermano</th>
                {cuerposPresentes.length > 1 && <th className="col-opcional">Cuerpo</th>}
                <th className="col-opcional">Tramo</th>
                <th className="col-opcional">Papeleta</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((f) => (
                <tr key={f.papeleta.id}>
                  <td className="num">{f.puesto ?? '—'}</td>
                  <td>
                    <div className="row-person">
                      {/* La foto si la hay: el día de la salida se busca por
                          la cara, no por el número. */}
                      {f.hermano.fotoDataUrl ? (
                        <img className="row-avatar row-avatar--foto" src={f.hermano.fotoDataUrl} alt="" />
                      ) : (
                        <span className="row-avatar">{initials(f.hermano.nombre)}</span>
                      )}
                      <span>
                        <span className="row-person__name">{f.hermano.nombre}</span>
                        <span className="row-person__sub">Nº {f.hermano.numero}</span>
                        <span className="row-person__sub solo-movil">
                          {f.tramo ? etiquetaTramo(f.tramo) : 'Sin asignar'} · papeleta {String(f.papeleta.numero).padStart(4, '0')}
                        </span>
                      </span>
                    </div>
                  </td>
                  {cuerposPresentes.length > 1 && <td className="col-opcional">{f.tramo?.cuerpo ?? '—'}</td>}
                  <td className="col-opcional">{f.tramo ? etiquetaTramo(f.tramo) : <span className="table-muted">Sin asignar</span>}</td>
                  <td className="num col-opcional">{String(f.papeleta.numero).padStart(4, '0')}</td>
                  <td>
                    <span className={`pill ${estadoPillClass(f.estado)}`}>{f.estado}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {diaDeSalida && f.estado !== 'Pendiente' && f.estado !== 'Baja' && f.estado !== 'Excede aforo' ? (
                        <>
                          <button className="icon-btn" title="Marcar presente" onClick={() => marcarPresente(f.papeleta.id)}>
                            <CheckIcon />
                          </button>
                          <button className="icon-btn" title="Registrar incidencia" onClick={() => setIncidenciaPara(f.papeleta.id)}>
                            <WarnIcon />
                          </button>
                        </>
                      ) : (
                        f.tramo && (
                          <button className="icon-btn" title="Ver tramo" onClick={() => setTramoAbiertoId(f.tramo!.id)}>
                            <EyeIcon />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No hay hermanos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- Drawer: ficha de tramo ---------------- */}
      <Drawer
        open={!!tramoAbierto}
        onClose={() => setTramoAbiertoId(null)}
        title={tramoAbierto ? etiquetaTramo(tramoAbierto) : ''}
        subtitle={tramoAbierto ? `Aforo ${tramoAbierto.capacidad}${tramoAbierto.tipo ? ` · ${tramoAbierto.tipo}` : ''}` : undefined}
        footer={
          tramoAbierto && (
            <>
              <button className="btn btn-outline" onClick={() => window.print()}>
                Imprimir listado de tramo
              </button>
              <button className="btn btn-ghost" onClick={() => setTramoAbiertoId(null)}>
                Cerrar
              </button>
            </>
          )
        }
      >
        {tramoAbierto && (
          <TramoFicha
            tramo={tramoAbierto}
            reparto={repartoAbierto}
            hermandad={hermandad}
            diaDeSalida={diaDeSalida}
            onPresente={marcarPresente}
            onIncidencia={setIncidenciaPara}
            onResolver={resolverIncidenciaDePapeleta}
            onPagada={marcarPagada}
          />
        )}
      </Drawer>

      {/* ---------------- Drawer: asignar hermano ---------------- */}
      <Drawer
        open={asignarOpen}
        onClose={() => setAsignarOpen(false)}
        title="Asignar hermano"
        subtitle="Cortejo"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAsignarOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="asignar-hermano-form" type="submit">
              Asignar
            </button>
          </>
        }
      >
        <form id="asignar-hermano-form" className="app-form" onSubmit={handleAsignarHermano}>
          {asignarError && <div className="form-hint form-hint--error">{asignarError}</div>}
          <div className="form-row">
            <label htmlFor="hermanoId">Hermano</label>
            {/* Solo quien puede salir de verdad. La lista ofrecía también a los
                hermanos CIVILES —el administrativo contratado, el asesor—, y
                el reparto los descarta: se les emitía la papeleta, se les
                cobraba, y el día del cortejo no aparecían en ningún tramo ni
                en el orden impreso. Sin un error por medio. Es el mismo fallo
                que ya se arregló con los de baja. */}
            <HermanoPicker
              hermanos={hermanosAsignables(hermanos.filter(puedeSalirEnElCortejo))}
              name="hermanoId"
              id="hermanoId"
            />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="cuerpoSelector">Cuerpo</label>
              <select
                id="cuerpoSelector"
                value={asignarCuerpo}
                onChange={(e) => setAsignarCuerpo(e.target.value as Cuerpo)}
              >
                <option value="" disabled>
                  Elige un cuerpo
                </option>
                {cuerposPresentes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="tramoId">Tramo</label>
              <select id="tramoId" name="tramoId" defaultValue="" disabled={!asignarCuerpo} key={asignarCuerpo}>
                <option value="" disabled>
                  {asignarCuerpo ? 'Vara, cruz de guía…' : 'Elige antes un cuerpo'}
                </option>
                {tramosDelCuerpoElegido.map((t) => {
                  const ocupados = (repartos.get(t.id) ?? []).filter((a) => a.estado !== 'Excede aforo').length
                  return (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                      {t.tipo ? ` (${t.tipo})` : ''} — {ocupados}/{t.capacidad}
                      {ocupados >= t.capacidad ? ' · completo' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>
          <p className="form-hint">
            El puesto dentro del tramo se calcula solo a partir de su número de hermano: los
            más antiguos (número más bajo) van al final del tramo, junto al paso; los más nuevos,
            en cabeza.
          </p>
        </form>
      </Drawer>

      {/* ---------------- Drawer: orden completo del cortejo (impresión) ---------------- */}
      <Drawer
        open={ordenOpen}
        onClose={() => setOrdenOpen(false)}
        title="Orden del cortejo"
        subtitle={`Documento maestro · Edición ${edicionActual}`}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => window.print()}>
              Imprimir / Descargar
            </button>
            <button className="btn btn-ghost" onClick={() => setOrdenOpen(false)}>
              Cerrar
            </button>
          </>
        }
      >
        <div className="cortejo-orden print-doc">
          {/* Se repite en cada hoja: un cortejo largo se reparte por tramos y
              la hoja suelta tiene que decir de qué documento es. */}
          <div className="print-hoja">
            {hermandad.nombreLegal || 'Tu hermandad'} · Orden del cortejo · Edición {edicionActual}
          </div>
          <div className="cortejo-orden__head">
            <span className="ticket-doc__logo">
              {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={26} />}
            </span>
            <div>
              <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
              <p className="eyebrow">Orden del cortejo · Edición {edicionActual}</p>
            </div>
          </div>
          {tramos.map((t) => {
            const reparto = (repartos.get(t.id) ?? []).filter((a) => a.estado !== 'Excede aforo')
            return (
              <div className="cortejo-orden__tramo" key={t.id}>
                <h3>
                  {etiquetaTramo(t)}
                  {t.tipo && <span className="table-subtle"> · {t.tipo}</span>}{' '}
                  <span className="table-subtle">· {reparto.length}/{t.capacidad}</span>
                </h3>
                {reparto.length === 0 ? (
                  <p className="form-hint">Sin hermanos asignados todavía.</p>
                ) : (
                  <ol>
                    {reparto.map((a) => (
                      <li key={a.papeleta.id}>
                        Puesto {a.puesto} · {a.hermano.nombre}{' '}
                        <span className="table-subtle">· nº {a.hermano.numero}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
          {/*
            La coletilla de «datos de ejemplo» iba SIEMPRE, y esto se imprime:
            la hoja del cortejo que se le da al diputado de tramo el Viernes
            Santo decía que los nombres eran de mentira.
          */}
          <p className="recibo-doc__note">
            Documento generado por Gobergo{hayDatosDeEjemplo() ? ' · datos de ejemplo' : ''}
          </p>
        </div>
      </Drawer>

      {/* ---------------- Mini-formulario: registrar incidencia ---------------- */}
      {incidenciaPara && (
        <IncidenciaForm
          tipos={tiposIncidencia}
          papeleta={papeletas.find((p) => p.id === incidenciaPara) ?? null}
          hermano={(() => {
            const p = papeletas.find((pp) => pp.id === incidenciaPara)
            return p ? hermanoDe(p.hermanoId) : undefined
          })()}
          onCancel={() => setIncidenciaPara(null)}
          onConfirm={(tipo, descripcion) => registrarIncidencia(incidenciaPara, tipo, descripcion)}
        />
      )}
    </div>
  )
}

// =============================================================================
// Subcomponentes
// =============================================================================

function CuerpoSeccion({
  titulo,
  tramos,
  repartos,
  diaDeSalida,
  onAbrir,
}: {
  titulo: string
  tramos: Tramo[]
  repartos: Map<string, Asignacion[]>
  diaDeSalida: boolean
  onAbrir: (id: string) => void
}) {
  if (tramos.length === 0) return null
  return (
    <section className="cortejo-cuerpo">
      <h2 className="cortejo-cuerpo__title">{titulo}</h2>
      <div className="tramos-grid">
        {tramos.map((t, i) => (
          <TramoCard
            key={t.id}
            tramo={t}
            indice={i + 1}
            reparto={repartos.get(t.id) ?? []}
            diaDeSalida={diaDeSalida}
            onAbrir={() => onAbrir(t.id)}
          />
        ))}
      </div>
    </section>
  )
}

function TramoCard({
  tramo,
  indice,
  reparto,
  diaDeSalida,
  onAbrir,
}: {
  tramo: Tramo
  indice: number
  reparto: Asignacion[]
  diaDeSalida: boolean
  onAbrir: () => void
}) {
  const confirmados = reparto.filter((a) => a.estado !== 'Excede aforo')
  const ocupados = confirmados.length
  const capacidad = tramo.capacidad
  const conIncidencia = reparto.filter((a) => a.estado === 'Con incidencia').length
  const excede = reparto.filter((a) => a.estado === 'Excede aforo').length
  const pct = capacidad > 0 ? Math.min(100, Math.round((ocupados / capacidad) * 100)) : 0
  // Con aforo 0 la tarjeta salía marcada como llena y al 0 % a la vez.
  const lleno = capacidad > 0 && ocupados >= capacidad
  const visibles = confirmados.slice(0, 5)
  const resto = ocupados - visibles.length

  return (
    <article className={`tramo-card${lleno ? ' tramo-card--full' : ''}`} onClick={onAbrir}>
      <span className="tramo-card__index">{String(indice).padStart(2, '0')}</span>
      <h3 className="tramo-card__title">{tramo.nombre}</h3>
      {tramo.tipo && <span className="tramo-card__tipo">{tramo.tipo}</span>}

      <div className="meter" aria-hidden="true">
        <span
          className={`meter__fill meter__fill--${pct >= 100 ? 'full' : pct >= 75 ? 'warn' : 'ok'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tramo-card__count">
        {ocupados}/{capacidad} puestos
      </span>

      <div className="avatar-stack">
        {visibles.map((a) => (
          a.hermano.fotoDataUrl ? (
            <img
              key={a.papeleta.id} className="row-avatar row-avatar--foto avatar-stack__item"
              src={a.hermano.fotoDataUrl} alt="" title={a.hermano.nombre}
            />
          ) : (
            <span key={a.papeleta.id} className="row-avatar avatar-stack__item" title={a.hermano.nombre}>
              {initials(a.hermano.nombre)}
            </span>
          )
        ))}
        {resto > 0 && <span className="row-avatar avatar-stack__item avatar-stack__more">+{resto}</span>}
        {ocupados === 0 && <span className="table-muted">Sin hermanos asignados</span>}
      </div>

      {(conIncidencia > 0 || excede > 0) && (
        <div className="tramo-card__badges">
          {conIncidencia > 0 && <span className="pill pill--err">{conIncidencia} incidencia{conIncidencia > 1 ? 's' : ''}</span>}
          {excede > 0 && <span className="pill pill--err">{excede} excede{excede > 1 ? 'n' : ''} aforo</span>}
        </div>
      )}

      {diaDeSalida && (
        <button
          type="button"
          className="btn btn-outline btn-sm tramo-card__pase"
          onClick={(e) => {
            e.stopPropagation()
            onAbrir()
          }}
        >
          Pase de lista
        </button>
      )}
    </article>
  )
}

function TramoFicha({
  tramo,
  reparto,
  hermandad,
  diaDeSalida,
  onPresente,
  onIncidencia,
  onResolver,
  onPagada,
}: {
  tramo: Tramo
  reparto: Asignacion[]
  hermandad: HermandadSettings
  diaDeSalida: boolean
  onPresente: (papeletaId: string) => void
  onIncidencia: (papeletaId: string) => void
  onResolver: (papeletaId: string, comoBaja: boolean) => void
  onPagada: (papeletaId: string) => void
}) {
  const edicionActual = getCampana().anio
  const [mapaAsistencia] = useAsistencias()
  const confirmados = reparto.filter((a) => a.estado !== 'Excede aforo')
  const excedidos = reparto.filter((a) => a.estado === 'Excede aforo')
  const ocupados = confirmados.length
  const capacidad = tramo.capacidad
  const pct = capacidad > 0 ? Math.min(100, Math.round((ocupados / capacidad) * 100)) : 0

  return (
    <div className="ficha">
      <div className="meter meter--lg" aria-hidden="true">
        <span className={`meter__fill meter__fill--${pct >= 100 ? 'full' : pct >= 75 ? 'warn' : 'ok'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="dash-head__lead">
        {ocupados}/{capacidad} puestos ocupados{tramo.tipo && ` · ${tramo.tipo}`}
      </p>

      <dl className="ficha__list">
        <div>
          <dt>Roster, por número de hermano</dt>
          <dd>
            {/* No basta con decir que está vacío: hay que decir de dónde sale
                lo que lo llena. El reparto no se teclea aquí —se calcula solo
                a partir de las papeletas emitidas—, y sin decirlo parece que
                la pantalla no funciona en vez de que falta el paso de antes. */}
            {reparto.length === 0 && (
              <span className="table-muted">
                Nadie asignado todavía. Este tramo se llena solo según se van emitiendo
                papeletas: cada papeleta de este tramo coloca a su hermano aquí.
              </span>
            )}
            <ul className="cortejo-roster">
              {reparto.map((a) => (
                <li key={a.papeleta.id}>
                  <span className="row-person">
                    {a.hermano.fotoDataUrl ? (
                      <img className="row-avatar row-avatar--foto" src={a.hermano.fotoDataUrl} alt="" />
                    ) : (
                      <span className="row-avatar">{initials(a.hermano.nombre)}</span>
                    )}
                    <span>
                      <span className="row-person__name">{a.hermano.nombre}</span>
                      <span className="row-person__sub">
                        Nº {a.hermano.numero} · puesto {a.puesto}
                      </span>
                    </span>
                  </span>
                  <span className={`pill ${estadoPillClass(a.estado)}`}>{a.estado}</span>
                  {diaDeSalida && a.estado === 'Con incidencia' && (
                    <span className="row-actions">
                      <button className="icon-btn" title="Resuelta, sigue en el cortejo" onClick={() => onResolver(a.papeleta.id, false)}>
                        <CheckIcon />
                      </button>
                      <button className="icon-btn" title="Fue baja definitiva" onClick={() => onResolver(a.papeleta.id, true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </span>
                  )}
                  {diaDeSalida && a.estado !== 'Con incidencia' && a.estado !== 'Excede aforo' && (
                    <span className="row-actions">
                      <button className="icon-btn" title="Marcar presente" onClick={() => onPresente(a.papeleta.id)}>
                        <CheckIcon />
                      </button>
                      <button className="icon-btn" title="Registrar incidencia" onClick={() => onIncidencia(a.papeleta.id)}>
                        <WarnIcon />
                      </button>
                    </span>
                  )}
                  {!diaDeSalida && a.estado === 'Reservada' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onPagada(a.papeleta.id)}>
                      Marcar pagada
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {excedidos.length > 0 && (
              <p className="form-hint form-hint--error">
                {excedidos.length} hermano{excedidos.length > 1 ? 's' : ''} de más para el aforo de
                este tramo. Amplía la capacidad en Configuración o reasígnalos a otro tramo.
              </p>
            )}
          </dd>
        </div>
      </dl>

      <div className="assign-box">
        <label>Asistencia · día de salida {edicionActual}</label>
        <p className="form-hint">
          Confírmala aquí o deja que la marque el diputado del tramo desde su área de hermano: se
          sincroniza al instante en ambos sitios.
        </p>
        <AsistenciaTramo
          anio={edicionActual}
          miembros={confirmados.map((a) => ({ hermano: a.hermano, puesto: a.puesto }))}
          porQuien="Secretaría"
        />
      </div>

      <p className="recibo-doc__note">{hermandad.nombreLegal || 'Tu hermandad'} · listado generado por Gobergo</p>

      {/* Documento imprimible: solo aparece en el papel, no en la ficha en pantalla (ver .screen-hidden). */}
      <div className="cortejo-orden screen-hidden print-doc">
        {/* Se repite en cada hoja (ver .print-hoja): un tramo de 40 nombres
            ocupa varias, y la hoja suelta debe decir de qué tramo es. */}
        <div className="print-hoja">
          {hermandad.nombreLegal || 'Tu hermandad'} · {etiquetaTramo(tramo)} · Edición {edicionActual}
        </div>
        <div className="cortejo-orden__head">
          <span className="ticket-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={26} />}
          </span>
          <div>
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            <p className="eyebrow">Listado de tramo · Edición {edicionActual}</p>
          </div>
        </div>
        <div className="cortejo-orden__tramo">
          <h3>
            {etiquetaTramo(tramo)}
            {tramo.tipo && <span className="table-subtle"> · {tramo.tipo}</span>}{' '}
            <span className="table-subtle">· {ocupados}/{capacidad}</span>
          </h3>
          {confirmados.length === 0 ? (
            <p className="form-hint">Sin hermanos asignados todavía.</p>
          ) : (
            <ol>
              {confirmados.map((a) => {
                // El listado del día de salida refleja la asistencia ya confirmada
                // (por la secretaría o por el diputado del tramo).
                const asis = registroDe(mapaAsistencia, edicionActual, a.hermano.id)
                return (
                  <li key={a.papeleta.id} className={asis.estado === 'no_asiste' ? 'cortejo-orden__ausente' : undefined}>
                    Puesto {a.puesto} · {a.hermano.nombre}{' '}
                    <span className="table-subtle">· nº {a.hermano.numero > 0 ? a.hermano.numero : '—'}</span>
                    {asis.estado === 'no_asiste' && (
                      <span className="table-subtle"> · NO ASISTE{asis.motivo ? ` (${asis.motivo})` : ''}</span>
                    )}
                    {asis.estado === 'asiste' && <span className="table-subtle"> · asiste</span>}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <p className="recibo-doc__note">{hermandad.nombreLegal || 'Tu hermandad'} · listado generado por Gobergo</p>
      </div>
    </div>
  )
}

function IncidenciaForm({
  tipos,
  papeleta,
  hermano,
  onCancel,
  onConfirm,
}: {
  tipos: string[]
  papeleta: Papeleta | null
  hermano: Hermano | undefined
  onCancel: () => void
  onConfirm: (tipo: TipoIncidencia, descripcion: string) => void
}) {
  const [tipo, setTipo] = useState<TipoIncidencia>(tipos[0] ?? 'Otra')
  const [descripcion, setDescripcion] = useState('')
  const panel = useRef<HTMLElement>(null)
  // El foco entra al abrir, no se escapa y vuelve al cerrar (ver foco.ts).
  // Este panel se usa en la calle, el día de salida, con prisa: que el foco se
  // pierda por detrás mientras se apunta que a un nazareno le ha pasado algo
  // es exactamente lo que no puede ocurrir.
  useFocoDeDialogo(!!papeleta && !!hermano, panel)

  if (!papeleta || !hermano) return null

  return (
    <div className="drawer-layer">
      <button className="drawer-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onCancel} />
      <aside ref={panel} tabIndex={-1} className="drawer drawer--sm" role="dialog" aria-modal="true" aria-label="Registrar incidencia">
        <header className="drawer__head">
          <div>
            <p className="eyebrow">Modo día de salida</p>
            <h2>Registrar incidencia</h2>
          </div>
          <button className="drawer__close" onClick={onCancel} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="drawer__body">
          <p className="dash-head__lead">
            {hermano.nombre} · nº {hermano.numero}
          </p>
          <div className="form-row">
            <label htmlFor="tipoIncidencia">Tipo</label>
            <select id="tipoIncidencia" value={tipo} onChange={(e) => setTipo(e.target.value as TipoIncidencia)}>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="descripcionIncidencia">Descripción</label>
            <textarea
              id="descripcionIncidencia"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué ha pasado y qué se ha hecho"
            />
          </div>
        </div>
        <footer className="drawer__foot">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={!descripcion.trim()}
            onClick={() => onConfirm(tipo, descripcion.trim())}
          >
            Registrar
          </button>
        </footer>
      </aside>
    </div>
  )
}
