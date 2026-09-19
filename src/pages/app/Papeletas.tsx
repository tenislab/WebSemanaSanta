import { llano } from '../../lib/buscar'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { prepararAvisos } from '../../lib/avisosCorreo'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import MenuAcciones from '../../components/MenuAcciones'
import PapeletaTicket from '../../components/PapeletaTicket'
import PapeletaModeloRender from '../../components/PapeletaModeloRender'
import ModeloPapeletaEditor from '../../components/ModeloPapeletaEditor'
import { cargarModeloPapeletaDeLaBase, getModeloPapeleta, type ModeloPapeleta } from '../../lib/modeloPapeleta'
import { HERMANOS_INICIALES, initials } from '../../data/hermanos'
import { PAPELETAS_INICIALES, METODOS_PAGO_PAPELETA, type MetodoPagoPapeleta, type Papeleta } from '../../data/papeletas'
import { estaSinCobrar, CUOTAS_INICIALES, type Cuota } from '../../data/cuotas'
import { useAjustesCuotas } from '../../lib/ajustesCuotas'
import { useConvocatoria, destinatariosConvocatoria } from '../../lib/convocatoria'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { sumaEuros, formatCurrency } from '../../lib/format'
import {
  useTramos,
  tramosDeCuerpo,
  etiquetaTramo,
  esAutomatico,
  gruposAutomaticos,
  cuerposPresentes,
  precioDeTramo,
  } from '../../lib/tramos'
import { puedeSalirEnElCortejo, repartoCompleto, asignacionPorPapeleta as mapAsignaciones } from '../../lib/cortejo'
import {
  getCampana,
  saveCampana,
  cargarCampanaDeLaBase,
  ventanaAbierta,
  diasHasta,
  renovacionDeHermano,
  estadoDeLaCampana,
  type Campana,
  type EstadoRenovacion,
} from '../../lib/campana'
import { CLAVES_DATOS, leerPersistido, leerDatos } from '../../lib/persistencia'
import { useSupabaseTable } from '../../lib/supabaseSync'
import { esNovedad, NOVEDADES } from '../../lib/novedades'
import { desdeQueEjercicio, ventanaDePapeletas } from '../../lib/ventanaHistorico'
import { papeletaToRow, rowToPapeleta } from '../../lib/db/papeletas'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { filaQueAbre } from '../../lib/foco'
import { aniosDeHermandad } from '../../lib/hermanoFicha'
import { fmtIso, hoy } from './papeletas/fechas'
import { useRenovarYSacar } from './papeletas/renovarYSacar'
import { useLosPagos } from './papeletas/pagos'
import { useLaImpresion } from './papeletas/impresion'
import { useConvocar } from './papeletas/convocatoria'
import { useLasSolicitudes } from './papeletas/solicitudes'
import CajonDeAjustes from './papeletas/CajonDeAjustes'
import CajonDeSolicitudes from './papeletas/CajonDeSolicitudes'
import ZonaDeImpresion from './papeletas/ZonaDeImpresion'



function claseEstado(estado: EstadoRenovacion) {
  if (estado === 'Renovada' || estado === 'Nueva') return 'pill--ok'
  if (estado === 'Por renovar') return 'pill--warn'
  if (estado === 'No renovada') return 'pill--err'
  return 'pill--off'
}

const FILTROS = ['Todos', 'Por renovar', 'Renovadas', 'Nuevas', 'No renovadas', 'Sin papeleta'] as const

/** Valor centinela del selector para «papeleta personalizada» (no puede chocar con un nombre de cuerpo). */
/*
 * Valor centinela del selector para la PAPELETA SIMBÓLICA.
 *
 * Es la de quien tiene su sitio y ese año no sale. Es una sola: aquí hubo una
 * lista de «papeletas personalizadas» con nombre y precio libres, y era un
 * tramo pobre —dos hermanos del mismo sitio podían pagar distinto según por
 * dónde se les emitiera—. Todo lo que camina es un tramo.
 */
const SIMBOLICA = '__simbolica'


export default function Papeletas() {
  // Antes de mandar nada, traer de la base la configuración de correo de
  // la hermandad y lo que cada hermano tenga apagado. Sin esto, quien
  // entra desde otro ordenador trabaja con la de fábrica: no sale ningún
  // aviso, o se le escribe a quien pidió que no. Los dos en silencio.
  useEffect(() => {
    void prepararAvisos()
  }, [])

  const { user } = useAuth()
  // Quién está haciendo los cambios, para el registro de actividad.
  const quienSoy =
    (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Alguien de la junta'
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useHermandadSettings(fallbackNombre)
  const tramos = useTramos()
  const hermanos = useMemo(() => leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  // El libro de cuentas: cobrar una papeleta deja su apunte aquí.
  const [, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento,
  )
  // El precio de la hermandad, no el de este navegador (ver hermandadSettings).
  const precioBase = hermandad.precioPapeleta
  const [ajustes, setAjustes] = useAjustesCuotas()

  // Deuda (cuotas sin pagar) de cada hermano, para avisar al emitir su papeleta.
  const cuotasTodas = useMemo(() => leerPersistido<Cuota[]>(CLAVES_DATOS.cuotas, CUOTAS_INICIALES), [])
  const deudaDe = useMemo(() => {
    const map = new Map<string, number>()
    cuotasTodas.forEach((c) => {
      if (estaSinCobrar(c)) {
        map.set(c.hermanoId, (map.get(c.hermanoId) ?? 0) + c.importe)
      }
    })
    return (id: string) => map.get(id) ?? 0
  }, [cuotasTodas])

  // Registro de pago de la papeleta abierta (método elegido en la ficha).
  const [metodoPagoSel, setMetodoPagoSel] = useState<MetodoPagoPapeleta>('Efectivo')

  /*
   * LA VENTANA DE HISTÓRICO. El porqué está en `lib/ventanaHistorico.ts`.
   *
   * Esta pantalla trabaja ENTERA sobre `campana.anio`: las activas, el
   * siguiente número, los avisos, todo. Las papeletas de hace cinco años se
   * traían para no mirarlas ni una vez.
   *
   * EL AÑO SE MIRA DOS VECES —el de la campaña y el del calendario— y se coge
   * el menor. `campana.anio` es la Semana Santa QUE VIENE, así que en otoño va
   * un año por delante del calendario; y una hermandad puede haberlo dejado
   * puesto en un año raro. Cogiendo el menor de los dos, y restando uno, la
   * ventana no puede quedarse corta por ninguno de los dos lados.
   *
   * `getCampana()` y no el estado `campana`: ese se declara más abajo, y aquí
   * hace falta el valor ANTES de montar el hook. Es una lectura síncrona de
   * `localStorage`, no cuesta nada.
   *
   * Va detrás de la misma bandera que las cuotas y nace apagada.
   */
  const desdeAnioPapeleta = desdeQueEjercicio(
    Math.min(getCampana().anio || new Date().getFullYear(), new Date().getFullYear()),
  )
  const ventanaPapeletas = useMemo(
    () => (esNovedad(NOVEDADES.cuotasVentana) ? ventanaDePapeletas<Papeleta>(desdeAnioPapeleta) : undefined),
    [desdeAnioPapeleta],
  )
  const [papeletas, setPapeletas] = useSupabaseTable<Papeleta>(
    'papeletas',
    CLAVES_DATOS.papeletas,
    PAPELETAS_INICIALES,
    papeletaToRow,
    rowToPapeleta,
    undefined,
    { ventana: ventanaPapeletas },
  )
  const [campana, setCampanaState] = useState<Campana>(() => getCampana())
  /*
   * La campaña de LA HERMANDAD, no la de este navegador.
   *
   * Vivía solo aquí, así que la secretaría abría la de 2026 en su ordenador y
   * el hermano, desde el móvil, seguía viendo la de fábrica. Se trae al montar
   * y se vuelve a leer, igual que se hace con el modelo de papeleta.
   */
  useEffect(() => {
    void cargarCampanaDeLaBase().then(() => setCampanaState(getCampana()))
  }, [])
  const [query, setQuery] = useState('')
  /* La letra se pinta antes que la tabla: ver el comentario en Hermanos.tsx. */
  const busqueda = useDeferredValue(query)

  const [filter, setFilter] = useState<(typeof FILTROS)[number]>('Todos')
  const [orden, setOrden] = useState<'numero' | 'antiguedad'>('numero')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingCuerpo, setPendingCuerpo] = useState<string>('')
  const [ajustesOpen, setAjustesOpen] = useState(false)
  const [modeloOpen, setModeloOpen] = useState(false)
  const [modelo, setModelo] = useState<ModeloPapeleta | null>(() => getModeloPapeleta())
  // El modelo de la hermandad, no el que hubiera en este navegador.
  useEffect(() => {
    void cargarModeloPapeletaDeLaBase().then((m) => {
      if (m) setModelo(m)
    })
  }, [])
  // Salidas de la papeleta: móvil (con QR, para el correo), física (sin QR, para
  // imprimir) o las dos a la vez (se muestran e imprimen ambas).
  const [variantePapeleta, setVariantePapeleta] = useState<'movil' | 'fisica' | 'ambas'>('movil')
  /*
   * `useConvocatoria` se queda aquí: la banda de arriba dice cuándo se avisó,
   * y la convocatoria en sí se fue a `papeletas/convocatoria.ts`.
   */
  const [convocatoria, refrescarConvocatoria] = useConvocatoria()

  function guardarCampana(next: Campana) {
    setCampanaState(next)
    saveCampana(next)
  }

  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])

  const tramoDe = (tramoId: string | null) => (tramoId ? (tramos.find((t) => t.id === tramoId) ?? null) : null)

  const cuerposDisponibles = useMemo(() => cuerposPresentes(tramos), [tramos])
  const tramosDelCuerpoElegido = useMemo(
    () => (pendingCuerpo && pendingCuerpo !== SIMBOLICA ? tramosDeCuerpo(pendingCuerpo, tramos) : []),
    [pendingCuerpo, tramos],
  )

  const papeletasActivas = useMemo(() => papeletas.filter((p) => p.anio === campana.anio), [papeletas, campana.anio])

  // El tramo y el puesto de cada papeleta se calculan a partir del reparto del
  // cortejo (cirios en cascada por número; designados por menor número), no
  // del tramo que se pidió: por eso puede colocarse en otro tramo del cuerpo.
  const asignacionPorPapeleta = useMemo(
    () => mapAsignaciones(repartoCompleto(tramos, papeletasActivas, hermanoDe, new Set())),
    [papeletasActivas, hermanoDe, tramos],
  )

  // Ocupación de cada tramo (colocación real) y de cada cuerpo, para el selector.
  const ocupadosPorTramo = useMemo(() => {
    const map = new Map<string, number>()
    asignacionPorPapeleta.forEach((a) => {
      if (a.estado === 'Excede aforo' || !a.tramo) return
      map.set(a.tramo.id, (map.get(a.tramo.id) ?? 0) + 1)
    })
    return map
  }, [asignacionPorPapeleta])

  // Ficha del censo: cada hermano con su estado de renovación en la campaña.
  const filas = useMemo(() => {
    return hermanos
      .map((h) => ({ hermano: h, renovacion: renovacionDeHermano(h.id, papeletas, campana) }))
      .filter((f) => {
        if (filter === 'Todos') return true
        if (filter === 'Renovadas') return f.renovacion.estado === 'Renovada'
        if (filter === 'Nuevas') return f.renovacion.estado === 'Nueva'
        if (filter === 'Por renovar') return f.renovacion.estado === 'Por renovar'
        if (filter === 'No renovadas') return f.renovacion.estado === 'No renovada'
        if (filter === 'Sin papeleta') return f.renovacion.estado === 'Sin papeleta'
        return true
      })
      .filter((f) => {
        const q = llano(busqueda)
        if (!q) return true
        return (
          llano(f.hermano.nombre).includes(q) ||
          String(f.hermano.numero).includes(q) ||
          llano(f.hermano.dni).includes(q)
        )
      })
      .sort((a, b) =>
        orden === 'antiguedad'
          ? a.hermano.antiguedad - b.hermano.antiguedad || (a.hermano.numero || Infinity) - (b.hermano.numero || Infinity)
          : (a.hermano.numero || Infinity) - (b.hermano.numero || Infinity),
      )
  }, [hermanos, papeletas, campana, filter, busqueda, orden])

  const stats = useMemo(() => {
    const cuenta = { conSitio: 0, porRenovar: 0, noRenovadas: 0, nuevas: 0 }
    hermanos.forEach((h) => {
      const e = renovacionDeHermano(h.id, papeletas, campana).estado
      if (e === 'Renovada' || e === 'Nueva') cuenta.conSitio += 1
      if (e === 'Por renovar') cuenta.porRenovar += 1
      if (e === 'No renovada') cuenta.noRenovadas += 1
      if (e === 'Nueva') cuenta.nuevas += 1
    })

    // Estadísticas centradas en las papeletas de la campaña activa.
    const activas = papeletas.filter((p) => p.anio === campana.anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia')
    const emitidas = activas.length
    const recaudado = sumaEuros(activas.filter((p) => p.estado === 'Pagada' || p.estado === 'Entregada').map((p) => p.importe))
    const entregadas = activas.filter((p) => p.estado === 'Entregada').length
    const pendientePago = activas.filter((p) => p.estado === 'Asignada').length
    const solicitudes = activas.filter((p) => p.estado === 'Solicitada').length
    const anuladas = papeletas.filter((p) => p.anio === campana.anio && p.estado === 'Anulada').length

    return { ...cuenta, emitidas, recaudado, entregadas, pendientePago, solicitudes, anuladas }
  }, [hermanos, papeletas, campana])

  // Tramos casi completos, para el aviso de portada.
  const tramosCasiLlenos = useMemo(() => {
    const avisos: string[] = []
    ocupadosPorTramo.forEach((ocupados, tramoId) => {
      const t = tramos.find((x) => x.id === tramoId)
      if (t && t.capacidad > 0 && ocupados / t.capacidad >= 0.85) avisos.push(t.nombre)
    })
    return avisos
  }, [ocupadosPorTramo, tramos])

  /*
   * ¿HAY CAMPAÑA DE VERDAD, O SE ESTÁN VIENDO LAS FECHAS DE EJEMPLO?
   *
   * Lo necesitan tres cosas de esta pantalla: la banda de renovación, el botón
   * de convocar y este `abierta`, que decide medio filtrado. Sin esto, las tres
   * hablaban de una campaña que nadie había creado.
   */
  const estadoCampana = estadoDeLaCampana()
  const abierta = ventanaAbierta(campana, estadoCampana === 'creada')
  const diasRestantes = diasHasta(campana.fechaLimiteRenovacion)

  /**
   * Siguiente número de papeleta, DENTRO DE SU AÑO.
   *
   * Se calcula a partir de la lista más reciente —dentro del updater, nunca
   * del closure— porque entre el clic y el guardado puede entrar otra.
   *
   * Y cuenta solo las de ESTE ejercicio, que es como está hecha la regla en la
   * base: el índice único es (hermandad, año, número). Contando todos los años
   * juntos, una hermandad que llevara tres campañas empezaba la cuarta por el
   * número 553, y eso es lo que sale impreso en la papeleta que se le da al
   * hermano: «Papeleta nº 0553» en una campaña con veinte papeletas. Ahora
   * cada campaña empieza por el 1, como toda la vida.
   */
  function siguienteNumero(lista: Papeleta[], anio = campana.anio) {
    return Math.max(0, ...lista.filter((p) => p.anio === anio).map((p) => p.numero)) + 1
  }

  function abrirDetalle(id: string) {
    setSelectedId(id)
    setPendingCuerpo('')
  }






  /** Cierra la campaña actual y abre la del año siguiente (los sitios de este año pasan a renovables). */
  function abrirNuevoAno() {
    const anio = campana.anio + 1
    guardarCampana({
      anio,
      fechaInicioParticiparon: `${anio}-01-15`,
      fechaInicioNoParticiparon: `${anio}-02-01`,
      fechaLimiteRenovacion: `${anio}-02-28`,
      fechaSalida: null,
    })
    setFilter('Todos')
    setSelectedId(null)
  }

  /*
   * LAS CINCO PIEZAS QUE SE HAN IDO A `papeletas/`, enchufadas aquí.
   *
   * Se desarman porque la ficha del hermano y los cajones de abajo las nombran
   * sueltas, y esa ficha se queda: son treinta props, y un componente de
   * treinta props se lee peor que el fichero del que sale.
   */
  const emitir = useRenovarYSacar({
    campana, hermandad, hermanos, tramos, precioBase,
    setPapeletas, setPendingCuerpo, siguienteNumero,
  })
  const {
    renovar, noRenovar, sacarEnTramo, sacarSimbolica,
    enviandoPapeleta, enviarPapeletaPorCorreo,
  } = emitir

  const { actualizarPapeleta, registrarPago, anularPapeleta } = useLosPagos({
    papeletas, setPapeletas, setMovimientos, hermanos, quienSoy,
  })

  const impresion = useLaImpresion({ papeletasActivas, asignacionPorPapeleta, hermanoDe })
  const {
    imprimirOpen, setImprimirOpen, imprimirEstados, setImprimirEstados,
    listaImpresion, contadorImpresion, totalAImprimir, generarImpresion,
  } = impresion

  const { convocando, convocar, puedeConvocar } = useConvocar({
    campana, estadoCampana, hermandad, hermanos, refrescarConvocatoria,
  })

  const solicitud = useLasSolicitudes({ campana, tramos, precioBase, setPapeletas, siguienteNumero })
  /*
   * De la petición, la pantalla solo necesita dos cosas: cuántas hay
   * pendientes —para el número del botón— y cómo abrir el cajón. Lo demás
   * (aceptar, rechazar, si está abierto) lo saca el cajón del mismo hook,
   * que se le pasa entero.
   */
  const { solicitudesPendientes, setSolicitudesOpen } = solicitud

  const seleccion = selectedId ? { hermano: hermanoDe(selectedId), renovacion: renovacionDeHermano(selectedId, papeletas, campana) } : null

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Papeletas de sitio</p>
          <h1>Renovación de papeletas</h1>
          <p className="dash-head__lead">
            {/*
              EL AÑO SOLO SI ES DE VERDAD. Sin campaña creada, `campana.anio` es
              el del ejemplo: poner «Campaña 2027» como titular de la pantalla es
              afirmar un año que nadie ha elegido, y a partir de ahí todo lo que
              se lea debajo se entiende referido a él.
            */}
            {estadoCampana === 'creada' ? `Campaña ${campana.anio} · ` : ''}
            El censo entero, con quién ha renovado su sitio y quién no.{' '}
            <Link to="/app/configuracion" className="dash-head__link">
              Personalizar datos de la hermandad
            </Link>
          </p>
        </div>
        <div className="dash-head__actions">
          {solicitudesPendientes.length > 0 && (
            <button className="btn btn-outline" onClick={() => setSolicitudesOpen(true)}>
              Solicitudes ({solicitudesPendientes.length})
            </button>
          )}
          <MenuAcciones>
            <button type="button" onClick={() => setModeloOpen(true)}>
              Modelo de papeleta
            </button>
            <button type="button" onClick={() => setAjustesOpen(true)}>
              Ajustes de campaña
            </button>
          </MenuAcciones>
          <button className="btn btn-primary" onClick={() => setImprimirOpen(true)}>
            Imprimir papeletas
          </button>
        </div>
      </div>

      {/*
        SIN CAMPAÑA CREADA NO SE AFIRMA NADA.

        Aquí ponía «Renovación abierta hasta el 28 feb 2027» a una hermandad que
        no había creado ninguna campaña: esa fecha es la de ejemplo que trae
        `getCampana()` cuando no hay nada guardado. Anunciar un plazo que nadie
        ha fijado, y en negrita, es peor que no decir nada — porque se cree.

        Y mientras la base no ha contestado tampoco se afirma: «no consta» no es
        «no hay».
      */}
      {estadoCampana === 'sin-crear' ? (
        /*
          UN SOLO AVISO, Y CON EL BOTÓN AL LADO. Antes salían dos: este y el de
          convocatoria de abajo, que repetía «primero hay que crear la campaña»
          con un botón apagado. Dos bandas seguidas diciendo lo mismo sobrecargan
          la cabecera. Se deja uno, corto, y con el botón que lleva a crearla —así
          la banda no solo dice qué falta, sino que resuelve. El de convocatoria
          ya solo aparece cuando hay campaña de verdad.
        */
        <div className="banner-inline banner-inline--warn" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span>Todavía no habéis creado la campaña. Las fechas de abajo son de ejemplo; ponle el año y el plazo.</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAjustesOpen(true)}>Ajustes de campaña</button>
        </div>
      ) : estadoCampana === 'sin-saber' ? (
        <div className="banner-inline banner-inline--warn">Comprobando la campaña de la hermandad…</div>
      ) : (
      <div className={`banner-inline ${abierta ? 'banner-inline--accent' : 'banner-inline--warn'}`}>
        {abierta ? (
          <>
            Renovación <b>abierta</b> hasta el {fmtIso(campana.fechaLimiteRenovacion)}
            {diasRestantes >= 0 && ` · quedan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`}. Quien no renueve
            antes pierde su sitio del año anterior.
          </>
        ) : (
          <>
            Renovación <b>cerrada</b> el {fmtIso(campana.fechaLimiteRenovacion)}. Los hermanos que no renovaron han
            perdido su sitio y quedan como «No renovada».
          </>
        )}
      </div>
      )}

      {/*
        Convocatoria: avisar a todos los hermanos de la apertura del plazo.

        SOLO CON CAMPAÑA CREADA. Sin campaña, el aviso de arriba ya dice lo que
        hay que hacer (crearla) y trae su botón; repetirlo aquí con otro botón
        apagado eran dos bandas seguidas para lo mismo. Y mientras la base no
        contesta tampoco sale: «no consta» no es «no hay».
      */}
      {estadoCampana === 'creada' && (
      <div className="banner-inline banner-inline--accent" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {convocatoria && convocatoria.anio === campana.anio ? (
          <span>
            📣 Convocatoria enviada el {fmtIso(convocatoria.fecha)} a <b>{convocatoria.total}</b> hermanos. Ya pueden
            solicitar su papeleta desde su área.
          </span>
        ) : (
          <span>
            {/*
              SIN CAMPAÑA NO SE INVITA A NADA. Decir «avisa a los 812 hermanos
              de que pueden sacar su papeleta de 2027» cuando nadie ha fijado
              ese año ni ese plazo es invitar a mandar un correo falso.
            */}
            {/*
              UN SOLO MENSAJE, NO DOS. Aquí decía una cosa y el párrafo de
              debajo repetía casi la misma con otras palabras. Dos avisos
              seguidos diciendo lo mismo se leen como que la pantalla está
              descuidada, y acaban sin leerse ninguno de los dos.

              Cuando no se puede convocar, el motivo YA lo explica
              `puedeConvocar.motivo`, que es el que sabe por qué —falta la
              campaña, aún no ha abierto el plazo o ya se cerró—. Aquí solo se
              dice lo que se va a hacer cuando sí se pueda.
            */}
            {puedeConvocar.puede
              ? <>Avisa a los <b>{destinatariosConvocatoria(hermanos).length}</b> hermanos de que pueden solicitar su papeleta de sitio {campana.anio}.</>
              : puedeConvocar.motivo}
          </span>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={convocar}
          disabled={convocando || !puedeConvocar.puede}
          title={puedeConvocar.puede ? undefined : puedeConvocar.motivo}
        >
          {convocando
            ? 'Enviando…'
            : convocatoria && convocatoria.anio === campana.anio
              ? 'Reenviar convocatoria'
              : 'Convocar papeletas'}
        </button>
      </div>
      )}



      {/* Avisos de portada: lo que la secretaría debe mirar de un vistazo */}
      {(stats.pendientePago > 0 || tramosCasiLlenos.length > 0 || solicitudesPendientes.length > 0 || (abierta && stats.porRenovar > 0)) && (
        <div className="avisos-band">
          {solicitudesPendientes.length > 0 && (
            <button type="button" className="aviso aviso--info" onClick={() => setSolicitudesOpen(true)} style={{ cursor: 'pointer' }}>
              🔔 {solicitudesPendientes.length} solicitud{solicitudesPendientes.length === 1 ? '' : 'es'} de papeleta por revisar
            </button>
          )}
          {stats.pendientePago > 0 && (
            <span className="aviso aviso--warn">{stats.pendientePago} papeleta{stats.pendientePago === 1 ? '' : 's'} pendiente{stats.pendientePago === 1 ? '' : 's'} de pago</span>
          )}
          {tramosCasiLlenos.map((nombre) => (
            <span key={nombre} className="aviso aviso--warn">{nombre} casi completo</span>
          ))}
          {abierta && stats.porRenovar > 0 && (
            <span className="aviso aviso--neutral">{stats.porRenovar} por renovar</span>
          )}
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Papeletas emitidas</span>
          <span className="stat-tile__value">{stats.emitidas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">
            {estadoCampana === 'creada' ? `Campaña ${campana.anio}` : 'Sin campaña creada'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Recaudado</span>
          <span className="stat-tile__value">{formatCurrency(stats.recaudado)}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Pagadas y entregadas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Entregadas</span>
          <span className="stat-tile__value">{stats.entregadas}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">de {stats.emitidas} emitidas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Pendiente de pago</span>
          <span className="stat-tile__value">{stats.pendientePago}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.pendientePago > 0 ? 'warn' : 'ok'}`}>
            Emitidas sin cobrar
          </span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por hermano, nº o DNI"
          aria-label="Buscar papeletas por hermano, número o DNI"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {FILTROS.map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f}
            </button>
          ))}
        </div>
        <select
          className="search-box"
          style={{ maxWidth: '13rem' }}
          value={orden}
          onChange={(e) => setOrden(e.target.value as 'numero' | 'antiguedad')}
          aria-label="Ordenar"
        >
          <option value="numero">Por nº de hermano</option>
          <option value="antiguedad">Por antigüedad</option>
        </select>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="col-opcional">Nº</th>
              <th>Hermano</th>
              <th className="col-opcional">Antigüedad</th>
              <th className="col-opcional">Sitio {campana.anio - 1}</th>
              <th>Estado {campana.anio}</th>
              <th>Sitio {campana.anio}</th>
              <th className="col-opcional"></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ hermano: h, renovacion: r }) => {
              const tramoAnterior = tramoDe(r.sitioAnterior?.tramoId ?? null)
              const aniosEnLaHermandad = aniosDeHermandad(h.antiguedad, campana.anio)
              const asigActual = r.papeletaActual ? asignacionPorPapeleta.get(r.papeletaActual.id) : undefined
              const tramoActual = asigActual?.tramo ?? null
              return (
                <tr key={h.id} {...filaQueAbre(() => abrirDetalle(h.id))}>
                  <td className="num col-opcional">{h.numero}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{initials(h.nombre)}</span>
                      <span>
                        <span className="row-person__name">{h.nombre}</span>
                        <span className="row-person__sub">Nº {h.numero} · {h.estado}</span>
                        {/* En el móvil se ocultan sus columnas: el dato baja aquí. */}
                        <span className="row-person__sub solo-movil">
                          {aniosEnLaHermandad === null ? 'Antigüedad sin registrar' : `${aniosEnLaHermandad} años`}
                          {' · '}
                          {tramoAnterior ? etiquetaTramo(tramoAnterior) : 'sin sitio anterior'}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="table-subtle td-nowrap col-opcional">
                    {/* La antigüedad manda en el reparto del cortejo, así que
                        cuando no consta hay que decirlo, no poner un número
                        inventado. Aquí llegó a salir «NaN años». */}
                    {aniosEnLaHermandad === null ? (
                      <span className="table-muted">Sin registrar</span>
                    ) : (
                      <>
                        {aniosEnLaHermandad} años
                        <span className="table-muted"> · {h.antiguedad}</span>
                      </>
                    )}
                  </td>
                  <td className="col-opcional">{tramoAnterior ? etiquetaTramo(tramoAnterior) : <span className="table-muted">—</span>}</td>
                  <td>
                    <span className={`pill ${claseEstado(r.estado)}`}>{r.estado}</span>
                  </td>
                  <td>
                    {tramoActual ? (
                      <>
                        {etiquetaTramo(tramoActual)}
                        {asigActual?.estado === 'Excede aforo' && (
                          <span className="table-subtle"> · excede aforo</span>
                        )}
                      </>
                    ) : r.papeletaActual?.opcion && r.papeletaActual.estado !== 'Renuncia' ? (
                      <>
                        {/* La pregunta de quien mira esta columna es si esa
                            persona camina o no. Se responde. */}
                        {r.papeletaActual.opcion}
                        <span className="table-subtle"> · no sale en el cortejo</span>
                      </>
                    ) : (
                      <span className="table-muted">—</span>
                    )}
                  </td>
                  <td className="col-opcional">
                    <button
                      className="icon-btn"
                      title="Ver ficha"
                      onClick={(e) => {
                        e.stopPropagation()
                        abrirDetalle(h.id)
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  No hay hermanos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha del hermano en la campaña */}
      <Drawer
        open={!!seleccion?.hermano}
        onClose={() => setSelectedId(null)}
        title={seleccion?.hermano?.nombre ?? ''}
        subtitle={seleccion?.hermano ? `Hermano nº ${seleccion.hermano.numero}` : undefined}
      >
        {seleccion?.hermano &&
          (() => {
            const h = seleccion.hermano
            const r = seleccion.renovacion
            const tramoAnterior = tramoDe(r.sitioAnterior?.tramoId ?? null)
            const actual = r.papeletaActual
            const asig = actual ? asignacionPorPapeleta.get(actual.id) : undefined
            const tramoActual = asig?.tramo ?? null
            // Última papeleta anulada de la campaña (anular ≠ borrar): se conserva.
            const anuladaActual = papeletas.find(
              (p) => p.hermanoId === h.id && p.anio === campana.anio && p.estado === 'Anulada',
            )
            const deuda = deudaDe(h.id)
            const bloqueadoPorDeuda = ajustes.bloquearPapeletaConDeuda && deuda > 0
            /*
             * Y QUIEN NO SALE EN EL CORTEJO, TAMPOCO SACA PAPELETA.
             *
             * La lista de esta pantalla es el CENSO ENTERO: salen también las
             * bajas y los hermanos civiles, cada uno con su botón de «Sacar
             * papeleta». Y el reparto descarta a esos dos grupos, así que la
             * papeleta se emitía, se cobraba su importe, y el día del cortejo
             * no aparecía en ningún tramo ni en el orden impreso. Ni un error
             * ni un aviso: simplemente no estaba.
             */
            const fueraDelCortejo = !puedeSalirEnElCortejo(h)
            const puedeSacar =
              (r.estado === 'Sin papeleta' || r.estado === 'No renovada') && !bloqueadoPorDeuda && !fueraDelCortejo
            return (
              <div className="ficha">
                <div className="ficha__row">
                  <span className={`pill ${claseEstado(r.estado)}`}>{r.estado}</span>
                  {tramoAnterior && (
                    <span className="pill pill--info">Sitio {campana.anio - 1}: {etiquetaTramo(tramoAnterior)}</span>
                  )}
                </div>

                {/* Aviso de cuotas pendientes */}
                {deuda > 0 && (
                  <div className={`banner-inline ${bloqueadoPorDeuda ? 'banner-inline--warn' : 'banner-inline--accent'}`}>
                    ⚠️ {h.nombre.split(' ')[0]} tiene <b>{formatCurrency(deuda)}</b> en cuotas pendientes.{' '}
                    {bloqueadoPorDeuda
                      ? 'No se le puede sacar papeleta hasta regularizar (ver Ajustes de campaña).'
                      : 'Puedes emitir igualmente o pedirle que regularice.'}
                  </div>
                )}

                {/* Por renovar: renovar o renunciar */}
                {/* Quien está de baja o es civil no renueva sitio: ver `fueraDelCortejo`. */}
                {fueraDelCortejo && (
                  <div className="form-hint">
                    {h.civil
                      ? `${h.nombre.split(' ')[0]} está en el censo como hermano/a civil: no hace estación de penitencia, así que no se le emite papeleta de sitio.`
                      : `${h.nombre.split(' ')[0]} está de baja en la hermandad: no se le emite papeleta de sitio.`}
                  </div>
                )}

                {r.estado === 'Por renovar' && !bloqueadoPorDeuda && !fueraDelCortejo && r.sitioAnterior && tramoAnterior && (
                  <div className="assign-box">
                    <label>Renovación del sitio del año anterior</label>
                    <p className="form-hint">
                      {h.nombre} salió en <b>{etiquetaTramo(tramoAnterior)}</b> el año pasado. Puede mantener ese sitio o
                      renunciar a él.
                    </p>
                    <div className="assign-box__row">
                      <button
                        className="btn btn-primary"
                        // El precio es el de ESTE año, no el de la papeleta
                        // anterior: si la hermandad sube el precio del tramo,
                        // quien renovaba seguía pagando el viejo y dos hermanos
                        // del mismo tramo pagaban cantidades distintas.
                        onClick={() => renovar(h.id, r.sitioAnterior!.tramoId!)}
                      >
                        Renovar {etiquetaTramo(tramoAnterior)}
                      </button>
                      <button className="btn btn-ghost" onClick={() => noRenovar(h.id)}>
                        No renovar
                      </button>
                    </div>
                  </div>
                )}

                {/* Sin papeleta o No renovada: sacar papeleta eligiendo tramo */}
                {puedeSacar && (
                  <div className="assign-box">
                    <label htmlFor="cuerpoSacar">
                      {r.estado === 'No renovada' ? 'Volver a sacar papeleta' : 'Sacar papeleta'}
                    </label>
                    <div className="form-grid-2">
                      <select
                        id="cuerpoSacar"
                        value={pendingCuerpo}
                        onChange={(e) => setPendingCuerpo(e.target.value)}
                      >
                        <option value="">Elige un cuerpo</option>
                        {cuerposDisponibles.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        {/* Va la última y separada: no es «otro cuerpo más»,
                            es la excepción — el que no sale. */}
                        <option value={SIMBOLICA}>No sale · papeleta simbólica</option>
                      </select>
                      <select
                        id="tramoSacar"
                        defaultValue=""
                        disabled={!pendingCuerpo}
                        key={pendingCuerpo}
                        onChange={(e) => {
                          if (!e.target.value) return
                          if (pendingCuerpo === SIMBOLICA) {
                            sacarSimbolica(h.id)
                          } else {
                            sacarEnTramo(h.id, e.target.value)
                          }
                        }}
                      >
                        <option value="" disabled>
                          {pendingCuerpo === SIMBOLICA
                            ? 'Confirma…'
                            : pendingCuerpo
                              ? 'Elige el puesto…'
                              : 'Elige antes un cuerpo'}
                        </option>
                        {/* La simbólica no tiene puesto que elegir, así que el
                            segundo desplegable solo sirve para confirmar. */}
                        {pendingCuerpo === SIMBOLICA
                          ? (
                              <option value="si">
                                Papeleta simbólica — {hermandad.precioSimbolica} €
                              </option>
                            )
                          : (() => {
                              const grupos = gruposAutomaticos(tramosDelCuerpoElegido)
                              const designados = tramosDelCuerpoElegido.filter((t) => !esAutomatico(t))
                              return (
                                <>
                                  {grupos.map((g) => {
                                    const ocupados = g.tramos.reduce((s, t) => s + (ocupadosPorTramo.get(t.id) ?? 0), 0)
                                    const aforo = g.tramos.reduce((s, t) => s + t.capacidad, 0)
                                    return (
                                      <option key={g.tramos[0].id} value={g.tramos[0].id}>
                                        {g.etiqueta} (por número) — {ocupados}/{aforo}
                                        {ocupados >= aforo ? ' · completo' : ''}
                                      </option>
                                    )
                                  })}
                                  {designados.map((t) => {
                                    const ocupados = ocupadosPorTramo.get(t.id) ?? 0
                                    return (
                                      <option key={t.id} value={t.id}>
                                        {t.nombre}
                                        {t.tipo ? ` (${t.tipo})` : ''} — {ocupados}/{t.capacidad} · {precioDeTramo(t, precioBase)} €
                                        {ocupados >= t.capacidad ? ' · completo' : ''}
                                      </option>
                                    )
                                  })}
                                </>
                              )
                            })()}
                      </select>
                    </div>
                    <p className="form-hint">
                      Los tramos «por número» se colocan solos por número de hermano; los «por solicitud» (vara, cruz
                      de guía…) se dan al solicitante de menor número. Las papeletas personalizadas (mantilla,
                      simbólica…) no ocupan sitio en el cortejo.{' '}
                      <Link to="/app/configuracion">Configura cuerpos, tramos, precios y papeletas</Link>.
                    </p>
                  </div>
                )}

                {/* Tiene papeleta este año: mostrar el ticket y sus acciones */}
                {actual && actual.estado !== 'Renuncia' && (
                  <>
                    <div className="assign-box__row no-print" style={{ marginBottom: '0.6rem' }}>
                      <button
                        type="button"
                        className={`chip chip--toggle${variantePapeleta === 'movil' ? ' chip--active' : ''}`}
                        onClick={() => setVariantePapeleta('movil')}
                      >
                        📱 Móvil (con QR)
                      </button>
                      <button
                        type="button"
                        className={`chip chip--toggle${variantePapeleta === 'fisica' ? ' chip--active' : ''}`}
                        onClick={() => setVariantePapeleta('fisica')}
                      >
                        🖨️ Física (sin QR)
                      </button>
                      <button
                        type="button"
                        className={`chip chip--toggle${variantePapeleta === 'ambas' ? ' chip--active' : ''}`}
                        onClick={() => setVariantePapeleta('ambas')}
                      >
                        📱+🖨️ Las dos
                      </button>
                    </div>
                    {/* Contenedor de las versiones: al imprimir «las dos», es el que sale
                        del flujo para que cada versión caiga en su propia página. */}
                    <div className="papeleta-versiones">
                    {variantePapeleta !== 'fisica' && (
                      <div className="papeleta-variante">
                        {variantePapeleta === 'ambas' && (
                          <p className="papeleta-variante__lbl no-print">📱 Versión de móvil · con QR</p>
                        )}
                        {modelo ? (
                          <PapeletaModeloRender
                            modelo={modelo}
                            sinQr={false}
                            datos={{
                              hermano: h,
                              papeleta: actual,
                              tramoEtiqueta: tramoActual ? etiquetaTramo(tramoActual) : null,
                              puesto: asig?.puesto ?? null,
                              hermandadNombre: hermandad.nombreLegal || (user?.user_metadata?.hermandad as string | undefined) || '',
                              fechaSalida: campana.fechaSalida,
                            }}
                          />
                        ) : (
                          <PapeletaTicket
                            papeleta={actual}
                            hermano={h}
                            hermandad={hermandad}
                            tramo={tramoActual}
                            puesto={asig?.puesto ?? null}
                            excedeAforo={asig?.estado === 'Excede aforo'}
                            opcion={actual.opcion}
                            sinQr={false}
                          />
                        )}
                      </div>
                    )}
                    {variantePapeleta !== 'movil' && (
                      <div className="papeleta-variante papeleta-variante--fisica">
                        {variantePapeleta === 'ambas' && (
                          <p className="papeleta-variante__lbl no-print">🖨️ Versión física · sin QR</p>
                        )}
                        {modelo ? (
                          <PapeletaModeloRender
                            modelo={modelo}
                            sinQr={true}
                            datos={{
                              hermano: h,
                              papeleta: actual,
                              tramoEtiqueta: tramoActual ? etiquetaTramo(tramoActual) : null,
                              puesto: asig?.puesto ?? null,
                              hermandadNombre: hermandad.nombreLegal || (user?.user_metadata?.hermandad as string | undefined) || '',
                              fechaSalida: campana.fechaSalida,
                            }}
                          />
                        ) : (
                          <PapeletaTicket
                            papeleta={actual}
                            hermano={h}
                            hermandad={hermandad}
                            tramo={tramoActual}
                            puesto={asig?.puesto ?? null}
                            excedeAforo={asig?.estado === 'Excede aforo'}
                            opcion={actual.opcion}
                            sinQr={true}
                          />
                        )}
                      </div>
                    )}
                    </div>
                    <p className="form-hint no-print">
                      {variantePapeleta === 'movil'
                        ? 'Versión de móvil: lleva el QR de verificación. Descárgala o imprímela, o mándasela por correo con el botón de abajo.'
                        : variantePapeleta === 'fisica'
                        ? 'Versión física: sin QR, pensada para imprimir en papel.'
                        : 'Se sacan las dos: la de móvil con QR (también se puede mandar por correo) y la física sin QR (para imprimir). Al imprimir salen ambas.'}
                    </p>
                    <div className="assign-box__row no-print" style={{ marginTop: '0.4rem' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                        {variantePapeleta === 'movil'
                          ? 'Descargar / imprimir (con QR)'
                          : variantePapeleta === 'fisica'
                          ? 'Imprimir física (sin QR)'
                          : 'Imprimir las dos'}
                      </button>
                      {variantePapeleta !== 'fisica' && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={enviandoPapeleta}
                          onClick={() => enviarPapeletaPorCorreo(h.id, tramoActual ? etiquetaTramo(tramoActual) : null, actual.opcion ?? null, actual.tramoId)}
                        >
                          {enviandoPapeleta ? 'Enviando…' : `Enviar por correo${h.email ? '' : ' (sin correo en su ficha)'}`}
                        </button>
                      )}
                    </div>
                    {actual.estado === 'Asignada' && actual.pagoComunicado && (
                      <div className="banner-inline banner-inline--accent" style={{ marginTop: '1rem' }}>
                        {h.nombre.split(' ')[0]} avisó desde su área de que pagó por{' '}
                        <b>{actual.pagoComunicado.metodo}</b> el {actual.pagoComunicado.fecha}. Comprueba el ingreso en
                        la cuenta de la hermandad y confírmalo abajo.
                      </div>
                    )}
                    {/* Estado del pago: emitida (Asignada) ≠ pagada */}
                    {actual.estado === 'Asignada' && (
                      <div className="assign-box" style={{ marginTop: '1rem' }}>
                        <label>Registrar cobro</label>
                        <p className="form-hint">
                          Emitida el {actual.fechaSolicitud} · <b>{formatCurrency(actual.importe)}</b>. Aún sin cobrar.
                          {actual.pagoComunicado && ` ${h.nombre.split(' ')[0]} avisó de pago por ${actual.pagoComunicado.metodo} el ${actual.pagoComunicado.fecha}.`}
                        </p>
                        <div className="assign-box__row">
                          <select value={metodoPagoSel} onChange={(e) => setMetodoPagoSel(e.target.value as MetodoPagoPapeleta)}>
                            {METODOS_PAGO_PAPELETA.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <button className="btn btn-primary" onClick={() => registrarPago(actual.id, metodoPagoSel)}>
                            Registrar pago
                          </button>
                        </div>
                      </div>
                    )}
                    {(actual.estado === 'Pagada' || actual.estado === 'Entregada') && actual.metodoPago && (
                      <div className="banner-inline banner-inline--accent" style={{ marginTop: '1rem' }}>
                        Pagada por <b>{actual.metodoPago}</b>{actual.fechaPago ? ` el ${actual.fechaPago}` : ''}.
                      </div>
                    )}
                    <div className="assign-box__row" style={{ marginTop: '1rem' }}>
                      {actual.estado === 'Pagada' && (
                        <button
                          className="btn btn-primary"
                          onClick={() => actualizarPapeleta(actual.id, { estado: 'Entregada', fechaEntrega: hoy() })}
                        >
                          Marcar como entregada
                        </button>
                      )}
                    </div>
                    {(actual.estado === 'Solicitada' || actual.estado === 'Asignada' || actual.estado === 'Pagada') && (
                      <button type="button" className="ticket-cancel" onClick={() => anularPapeleta(actual.id)}>
                        Anular papeleta
                      </button>
                    )}
                  </>
                )}

                {!actual && anuladaActual && (
                  <div className="banner-inline banner-inline--warn">
                    Papeleta nº {String(anuladaActual.numero).padStart(4, '0')} <b>anulada</b>
                    {anuladaActual.motivoAnulacion ? ` · ${anuladaActual.motivoAnulacion}` : ''}. Se conserva el registro
                    (anular no es borrar). Puede volver a sacar papeleta arriba.
                  </div>
                )}

                {r.estado === 'No renovada' && actual?.estado === 'Renuncia' && (
                  <p className="form-hint">
                    {h.nombre} renunció a su sitio este año. Si cambia de idea, puede volver a sacar papeleta arriba.
                  </p>
                )}
              </div>
            )
          })()}
      </Drawer>

      <CajonDeAjustes
        ajustesOpen={ajustesOpen}
        setAjustesOpen={setAjustesOpen}
        campana={campana}
        guardarCampana={guardarCampana}
        abrirNuevoAno={abrirNuevoAno}
        ajustes={ajustes}
        setAjustes={setAjustes}
      />

      {/* Modelo de papeleta personalizado */}
      <Drawer
        open={modeloOpen}
        onClose={() => setModeloOpen(false)}
        title="Modelo de papeleta"
        subtitle="Sube tu diseño y coloca los datos"
      >
        <p className="form-hint">
          Sube la imagen de tu modelo de papeleta y coloca encima los datos del hermano. A partir
          de entonces, la papeleta de cada hermano se imprime sobre ese modelo con sus datos
          reales. Si borras el modelo, se vuelve a usar la papeleta estándar.
        </p>
        <ModeloPapeletaEditor modelo={modelo} onCambio={setModelo} />
      </Drawer>

      {/* Impresión masiva: elegir qué papeletas y generar un PDF con una por página */}
      <Drawer
        open={imprimirOpen}
        onClose={() => setImprimirOpen(false)}
        title="Imprimir papeletas"
        subtitle="Un PDF con una papeleta por página"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setImprimirOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={generarImpresion} disabled={totalAImprimir === 0}>
              Generar PDF ({totalAImprimir})
            </button>
          </>
        }
      >
        <div className="app-form">
          <p className="form-hint">
            Elige qué papeletas de la campaña {campana.anio} incluir. Se abrirá el diálogo de
            impresión; elige «Guardar como PDF» para obtener un único archivo con todas.
          </p>
          {(['Asignada', 'Pagada', 'Entregada'] as const).map((e) => (
            <label className="checkbox-row" key={e}>
              <input
                type="checkbox"
                checked={!!imprimirEstados[e]}
                onChange={(ev) => setImprimirEstados((prev) => ({ ...prev, [e]: ev.target.checked }))}
              />
              {e === 'Asignada' ? 'Emitidas (sin pagar)' : e === 'Pagada' ? 'Pagadas' : 'Entregadas'} — {contadorImpresion[e] ?? 0}
            </label>
          ))}
          <p className="form-hint" style={{ marginTop: '0.6rem' }}>
            Total a imprimir: <b>{totalAImprimir}</b> papeleta{totalAImprimir === 1 ? '' : 's'}. Cada una lleva su
            QR con los datos.
          </p>
        </div>
      </Drawer>

      <CajonDeSolicitudes solicitud={solicitud} />

      <ZonaDeImpresion
        listaImpresion={listaImpresion}
        campana={campana}
        hermandad={hermandad}
        modelo={modelo}
        fallbackNombre={fallbackNombre}
      />
    </div>
  )
}
