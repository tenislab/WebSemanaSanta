/**
 * EL ÁREA DEL HERMANO.
 *
 * Dos pantallas en una dirección (`/hermano`): la de identificarse —buscar tu
 * hermandad, entrar, pedir el alta, recuperar la contraseña— y, una vez
 * dentro, el portal con su cuota, su papeleta, su sitio en el cortejo y sus
 * datos.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ ESTÁ PARTIDO EN `portal/`, Y POR QUÉ NO COMO EL EDITOR DE LA WEB
 * ----------------------------------------------------------------------------
 *
 * Tenía 2.909 líneas, y el reparto NO podía ser el mismo que el del editor de
 * la web. Allí eran veintitrés componentes hermanos y bastaba con darle un
 * fichero a cada uno; aquí es UN SOLO componente con ciento setenta y tres
 * bindings dentro, así que el problema no es el reparto de la interfaz: es el
 * estado.
 *
 * Se midió antes de cortar, y eso decidió los cortes:
 *
 *   · Sacar una sección del portal costaría entre VEINTE Y CUARENTA props.
 *     Un componente de cuarenta props se lee peor que el fichero gordo, así
 *     que las secciones se quedan aquí.
 *   · La pantalla de identificarse usa treinta y cuatro bindings del padre y
 *     TREINTA Y UNO son solo suyos: su estado se muda con ella y el contrato
 *     queda en ocho props. Ese sí es un corte: una pantalla entera fuera.
 *   · La sesión y los ayudantes no son interfaz y no cuestan nada.
 *
 * ----------------------------------------------------------------------------
 * LO QUE HAY QUE SABER SI SE TOCA
 * ----------------------------------------------------------------------------
 *
 * VEINTITRÉS ficheros de prueba vigilan esta pantalla LEYENDO SU FUENTE, y no
 * leen este fichero: piden el área entera con `fuenteDelPortalDelHermano()`
 * (ver `pruebas/fuentes.mjs`), que pega esto con todo lo de `portal/`. Sin eso,
 * un trozo movido deja veintitantos guardias apuntando a donde ya no hay nada
 * —y los que comprueban que algo NO está se quedarían EN VERDE sin vigilar
 * nada—.
 */
import AsistenciaTramo from '../components/AsistenciaTramo'
import BuzonHermano from '../components/BuzonHermano'
import CalendarioMes from '../components/CalendarioMes'
import CarneHermano from '../components/CarneHermano'
import Drawer from '../components/Drawer'
import FotoHermano from '../components/FotoHermano'
import HistorialHermano from '../components/HistorialHermano'
import MiFamilia from '../components/MiFamilia'
import MiSitioCortejo from '../components/MiSitioCortejo'
import MisReservasTienda from '../components/MisReservasTienda'
import PapeletaModeloRender from '../components/PapeletaModeloRender'
import PapeletaTarjeta from '../components/PapeletaTarjeta'
import PapeletaTicket from '../components/PapeletaTicket'
import ReportarFallo from '../components/ReportarFallo'
import { useAuth } from '../context/AuthContext'
import { CUOTAS_INICIALES, deudaDe, type Cuota } from '../data/cuotas'
import { EVENTOS_INICIALES, type Aparicion, type Evento } from '../data/eventos'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { PAPELETAS_INICIALES, type MetodoPago, type Papeleta } from '../data/papeletas'
import { useAjustesCuotas } from '../lib/ajustesCuotas'
import { useAvisosHermano } from '../lib/avisosHermano'
import { claseTipo, fechaLarga } from '../lib/calendario'
import {
  diasHasta,
  estadoDeLaCampana,
  participoEnCampana,
  renovacionDeHermano,
  useCampana,
  ventanaAbiertaPara,
} from '../lib/campana'
import { estiloTema, inicialesHermandad } from '../lib/color'
import { asignacionPorPapeleta as mapAsignaciones, repartoCompleto, repartoPorTramo } from '../lib/cortejo'
import { descargarArchivo } from '../lib/csv'
import { ejercicioDeCuotas } from '../lib/cuotasEmision'
import { cuotaToRow, rowToCuota } from '../lib/db/cuotas'
import { eventoToRow, rowToEvento } from '../lib/db/eventos'
import { contactoDelHermanoToRow, hermanoToRow, rowToHermano } from '../lib/db/hermanos'
import { papeletaToRow, rowToPapeleta } from '../lib/db/papeletas'
import { etiquetaDeSituacion, situacionDeHermano } from '../lib/estadoCuotaHermano'
import { solicitudesDeMiFamilia, traerMiTutor, type MiTutor } from '../lib/familia'
import { formatCurrency, formatDate, maskIban } from '../lib/format'
import { useHermandadSettings } from '../lib/hermandadSettings'
import {
  HERMANDADES_MUESTRA,
  HERMANOS_MUESTRA,
  ID_HERMANDAD_PRINCIPAL,
  type HermanoDirectorio,
} from '../lib/hermandades'
import { hidratarPlantillas } from '../lib/hidratar'
import { mandatoVigente, textoDelMandatoSepa, useMandatosSepa } from '../lib/mandatosSepa'
import { cargarModeloPapeletaDeLaBase, getModeloPapeleta, type ModeloPapeleta } from '../lib/modeloPapeleta'
import { comoVuelveDePagar, misPagosConTarjeta, type IntentoDePago } from '../lib/pagoTarjeta'
import { CLAVES_DATOS, useEscuchaOtrasPestanas } from '../lib/persistencia'
import { conRenovacion } from '../lib/renovarPapeleta'
import { exportarDatosHermano, recopilarDatosHermano } from '../lib/rgpd'
import {
  STORAGE_KEY as CLAVE_SOLICITUDES,
  crearSolicitudPrincipal,
  getSolicitudes,
  type SolicitudAlta,
} from '../lib/solicitudes'
import { MODALIDADES, useSolicitudesPapeleta, type ModalidadPapeleta } from '../lib/solicitudesPapeleta'
import { supabase } from '../lib/supabase'
import { nuevoId, useSupabaseTable } from '../lib/supabaseSync'
import { loQueHayQueHacer, misTareasPendientes, useTareasRedes } from '../lib/tareasRedes'
import { problemaDeTelefono } from '../lib/telefono'
import { cuerposPresentes, etiquetaTramo, useTramos } from '../lib/tramos'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Identificarse from './portal/Identificarse'
import { PagoPapeleta } from './portal/PagoPapeleta'
import { PortalHead } from './portal/PortalHead'
import {
  CONSENT_KEY,
  SESION_KEY,
  TIPOS_PARA_HERMANOS,
  aDondeVolver,
  hoy,
  leerSesion,
  siNoEsElHueco,
  useTablaPorHermandad,
  type Sesion,
} from './portal/sesion'
import DocumentosDelHermano from '../components/DocumentosDelHermano'
import { DOCUMENTOS_INICIALES, type Documento } from '../data/documentos'
import { documentoToRow, rowToDocumento } from '../lib/db/documentos'

export default function HermanoPortal() {

  const hermandadPrincipal = useHermandadSettings()
  const nombrePrincipal = hermandadPrincipal.nombreLegal || 'Tu hermandad (modo demo)'
  // Modo local efectivo: sin Supabase o con Supabase en pausa/caído. En ese
  // caso el acceso del hermano funciona igual, contra el censo del navegador
  // (si no, con Supabase dormido no se podría entrar como hermano).
  const { configured: usarSupabase } = useAuth()

  /**
   * SIN ESPEJO, todas.
   *
   * El área del hermano monta los mismos hooks que el panel, con las mismas
   * claves locales, pero las políticas de Supabase solo le dejan ver SU ficha,
   * SUS papeletas y SUS cuotas. Dejar que eso se guarde en el navegador hacía
   * un estropicio bien visible: en el ordenador de la casa de hermandad, con
   * la secretaria en Hermanos y un hermano entrando en otra pestaña, la
   * consulta del hermano devolvía 1 fila, espejaba `cabildo-hermanos` con esa
   * única fila, y la pestaña del panel —que escucha esa clave— cambiaba sola:
   * la secretaria veía sus 400 hermanos convertirse en 1. Y la copia se
   * quedaba así aunque cerrara la pestaña del hermano.
   */
  const sinEspejo = { sinEspejo: true }
  const [hermanos, setHermanos] = useSupabaseTable<Hermano>(
    'hermanos',
    CLAVES_DATOS.hermanos,
    HERMANOS_INICIALES,
    hermanoToRow,
    rowToHermano,
    'numero',
    sinEspejo,
  )
  const [papeletas, setPapeletas] = useSupabaseTable<Papeleta>(
    'papeletas',
    CLAVES_DATOS.papeletas,
    PAPELETAS_INICIALES,
    papeletaToRow,
    rowToPapeleta,
    undefined,
    sinEspejo,
  )
  const [cuotas, setCuotas] = useSupabaseTable<Cuota>(
    'cuotas',
    CLAVES_DATOS.cuotas,
    CUOTAS_INICIALES,
    cuotaToRow,
    rowToCuota,
    undefined,
    sinEspejo,
  )

  // El calendario de la hermandad, para enseñárselo al hermano. Solo lectura.
  const [eventos] = useSupabaseTable<Evento>(
    'eventos',
    CLAVES_DATOS.eventos,
    EVENTOS_INICIALES,
    eventoToRow,
    rowToEvento,
    undefined,
    sinEspejo,
  )
  /*
   * LOS DOCUMENTOS QUE PUEDE VER. La política `documentos_hermano_select` solo
   * le manda los marcados para hermanos o para la web, así que esto no trae de
   * más; el componente vuelve a filtrar por si el espejo del navegador guarda
   * filas de cuando la sesión era de secretaría.
   *
   * CON `sinEspejo`, como los eventos: el espejo en `localStorage` es por
   * hermandad y aquí hay varias de muestra, así que guardarlo mezclaría los
   * documentos de unas con los de otras.
   */
  const [documentos] = useSupabaseTable<Documento>(
    'documentos',
    CLAVES_DATOS.documentos,
    DOCUMENTOS_INICIALES,
    documentoToRow,
    rowToDocumento,
    undefined,
    sinEspejo,
  )
  const [diaCalendario, setDiaCalendario] = useState<{ fecha: string; delDia: Aparicion[] } | null>(null)

  // Censo y papeletas de cada hermandad de muestra: cada una guarda los suyos
  // aparte, igual que en la base de datos real cada hermandad vería solo sus filas.
  const censosMuestra = useTablaPorHermandad<HermanoDirectorio>(
    'cabildo-directorio',
    (id) => HERMANOS_MUESTRA[id] ?? [],
  )
  const papeletasMuestra = useTablaPorHermandad<Papeleta>('cabildo-papeletas', () => [])

  const [ajustesCuotas] = useAjustesCuotas()
  const tramos = useTramos()
  /* `useCampana` y no `getCampana()`: la campaña viene de la base y tarda lo
     que tarde la red. Con la lectura de una vez, el hermano veía la de fábrica
     —otro año y otro plazo— y ahí se quedaba toda la sesión. */
  const campana = useCampana()
  /*
   * ¿HAY CAMPAÑA DE VERDAD? Es lo que decide si al hermano se le enseña
   * «Solicitar mi papeleta de sitio». Sin campaña creada, `getCampana()` da las
   * fechas de ejemplo, y se le estaba ofreciendo pedir sitio para una Semana
   * Santa que su hermandad no ha convocado. Esto no lo ve la junta: lo ven los
   * ochocientos.
   */
  const hayCampana = estadoDeLaCampana() === 'creada'
  // El precio de la hermandad, no el de este navegador (ver hermandadSettings).
  const precioBase = hermandadPrincipal.precioPapeleta
  // El modelo con el que la hermandad imprime sus papeletas. Se trae de la
  // base: en el móvil del hermano no hay nada guardado, así que sin esto veía
  // siempre la papeleta genérica en vez de la de su hermandad.
  const [modeloPapeleta, setModeloPapeleta] = useState<ModeloPapeleta | null>(() => getModeloPapeleta())
  useEffect(() => {
    void cargarModeloPapeletaDeLaBase().then((m) => {
      if (m) setModeloPapeleta(m)
    })
  }, [])

  /*
   * Y LO DEMÁS DE LA HERMANDAD, IGUAL. El área del hermano va por su propia
   * ruta, fuera del panel, así que no pasa por el `AppShell` que lo trae.
   *
   * Aquí es donde más se notaba, y estaba escrito de antes: la secretaría abre
   * la campaña de 2026 desde su ordenador, y el hermano, en su móvil, ve la de
   * fábrica —otro año, otro plazo, otra fecha de salida— y pide sitio para una
   * Semana Santa que no toca, sin que ninguno de los dos vea nada raro. Con los
   * ajustes de cuotas pasa lo mismo: el bloqueo de papeleta a los morosos no se
   * aplicaba aquí porque este móvil no sabía que existía.
   *
   * Los hooks se enteran solos —`useAjustesCuotas` escucha su evento—, así que
   * no hace falta recoger nada.
   */
  useEffect(() => {
    void hidratarPlantillas()
  }, [])

  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  const [searchParams] = useSearchParams()
  /* Con qué DNI llega rellenado el campo de entrar. Ver `Identificarse`. */
  const [dniInicial, setDniInicial] = useState(() => searchParams.get('dni') ?? '')
  const navigate = useNavigate()

  /*
   * Y SI SE LLEGÓ AQUÍ DESDE OTRO SITIO, SE VUELVE ALLÍ AL ENTRAR.
   *
   * Lo usa la tienda de la web pública: quien pulsa «entra y verás tu precio»
   * tiene que aparecer otra vez en el escaparate, con los precios ya rebajados
   * y no en su área del hermano preguntándose qué ha pasado con su cesta.
   *
   * En un efecto y no dentro de las tres ramas del `entrar()` —Supabase,
   * hermandad principal sin base y hermandades de muestra—: es la misma
   * decisión para las tres y escrita tres veces se olvidaría en una.
   *
   * `yaVolví` para que ocurra UNA sola vez: sin él, volver a `/hermano` desde
   * la propia web con el parámetro todavía en la barra sería un ida y vuelta
   * del que no se sale.
   */
  const yaVolvi = useRef(false)
  const volverA = aDondeVolver(searchParams.get('volver'))
  useEffect(() => {
    if (!sesion || !volverA || yaVolvi.current) return
    yaVolvi.current = true
    navigate(volverA)
  }, [sesion, volverA, navigate])


  /*
   * ¿VUELVE DE PAGAR CON TARJETA?
   *
   * Sirve SOLO para el mensaje. Que ponga `pago=hecho` NO significa que el
   * dinero esté —esa dirección se puede escribir a mano— así que el aviso dice
   * «en un momento» y no da nada por cobrado. Quien marca la cuota es el
   * webhook, con la clave de servicio. Ver `lib/pagoTarjeta.ts`.
   */
  const vueltaDelPago = comoVuelveDePagar(window.location.search)

  const [datosGuardados, setDatosGuardados] = useState(false)
  const [datosError, setDatosError] = useState<string | null>(null)
  const [bajaMuestraSolicitada, setBajaMuestraSolicitada] = useState(false)
  const [bajaOpen, setBajaOpen] = useState(false)
  const [motivoBaja, setMotivoBaja] = useState('')
  const [solicitudesAlta, setSolicitudesAlta] = useState<SolicitudAlta[]>(() => getSolicitudes())
  // Cuando la secretaría aprueba (o rechaza) un alta desde el panel, aquí se ve
  // al momento: sin esto, el hermano seguía viendo «alta pendiente» al lado de
  // su hijo ya dado de alta.
  useEscuchaOtrasPestanas(CLAVE_SOLICITUDES, () => setSolicitudesAlta(getSolicitudes()))
  const [consent, setConsent] = useState<boolean>(() => localStorage.getItem(CONSENT_KEY) === 'si')
  const [claveError, setClaveError] = useState<string | null>(null)
  const [claveGuardada, setClaveGuardada] = useState(false)

  // Solicitud de papeleta de sitio (el hermano la pide; la secretaría la acepta o rechaza).
  const [solicitudesPapeleta, setSolicitudesPapeleta] = useSolicitudesPapeleta(sinEspejo)
  const [reporteAbierto, setReporteAbierto] = useState(false)
  const [solModalidad, setSolModalidad] = useState<ModalidadPapeleta>('Nazareno')
  const [solTramo, setSolTramo] = useState('')
  const [solPreferencia, setSolPreferencia] = useState('')
  const [solComentario, setSolComentario] = useState('')

  const esPrincipal = sesion?.hermandadId === ID_HERMANDAD_PRINCIPAL
  const hermanoPrincipal = useMemo(
    () => (esPrincipal && sesion ? hermanos.find((h) => h.id === sesion.hermanoId) ?? null : null),
    [esPrincipal, sesion, hermanos],
  )
  const hermanoMuestra = useMemo(() => {
    if (esPrincipal || !sesion) return null
    const censo = censosMuestra[sesion.hermandadId]?.[0] ?? []
    return censo.find((h) => h.id === sesion.hermanoId) ?? null
  }, [esPrincipal, sesion, censosMuestra])
  const hermandadMuestra = useMemo(
    () => (sesion ? HERMANDADES_MUESTRA.find((h) => h.id === sesion.hermandadId) ?? null : null),
    [sesion],
  )

  const hermanoActivo = hermanoPrincipal ?? hermanoMuestra
  /**
   * A quien le tramitan la baja mientras tiene su área abierta se le dice ahí
   * mismo (las pestañas ya se enteran unas de otras) y se le cierran las
   * acciones. No se le echa de golpe: puede querer ver su histórico o
   * descargar sus datos.
   */
  const deBaja = hermanoPrincipal?.estado === 'Baja'

  // Su domiciliación SEPA: solo ve la suya (RLS), y solo la firma él. Ver
  // `lib/mandatosSepa.ts` y `supabase/mandatos-sepa.sql`.
  const [misMandatos, setMisMandatos] = useMandatosSepa(sinEspejo)
  const miMandatoVigente = useMemo(
    () => (hermanoPrincipal ? mandatoVigente(misMandatos, hermanoPrincipal.id, hermanoPrincipal.iban) : null),
    [misMandatos, hermanoPrincipal],
  )
  /*
   * LOS ENCARGOS DE REDES QUE LE HAN REPARTIDO.
   *
   * La base solo le deja ver los suyos y solo le deja darlos por hechos (ver
   * `supabase/encargos-redes.sql`), así que aquí no hace falta filtrar por
   * seguridad — `misTareasPendientes` filtra para no enseñar las cerradas.
   */
  const [tareasRedes, setTareasRedes] = useTareasRedes(sinEspejo)
  const misEncargos = useMemo(
    () => misTareasPendientes(tareasRedes, hermanoPrincipal?.id),
    [tareasRedes, hermanoPrincipal],
  )
  function marcarEncargoHecho(id: string) {
    setTareasRedes((prev) => prev.map((t) => (t.id === id ? { ...t, estado: 'hecha' as const } : t)))
  }

  const [firmando, setFirmando] = useState(false)
  // Guarda de verdad contra el doble clic: `firmando` en el estado no sirve
  // sola, porque `setFirmando(true)` no se ve hasta el siguiente pintado y un
  // segundo clic dentro del mismo instante lee el mismo `false` que el
  // primero. La referencia sí se actualiza al momento.
  const firmandoRef = useRef(false)
  /*
   * LA REFERENCIA DE VERDAD LA PONE LA BASE, no este navegador.
   *
   * `setMisMandatos` abre la fila con una referencia en blanco —la real la
   * calcula el disparador `mandatos_sepa_firma()` a partir del id, y ese
   * cálculo no vuelve aquí: `useSupabaseTable` no trae de vuelta la fila que
   * acaba de crear—. Sin esto, el aviso de «domiciliación firmada» se
   * quedaría enseñando una referencia vacía hasta que el hermano recargara
   * la página. Se guarda aparte y no reescribiendo `misMandatos`: hacerlo con
   * `setMisMandatos` lo trataría como un cambio a sincronizar, y esta cuenta
   * no tiene permiso para modificar un mandato ya firmado (con razón: eso es
   * justo lo que evita que se pueda falsificar una firma después de puesta).
   */
  const [referenciaConfirmada, setReferenciaConfirmada] = useState<Record<string, string>>({})
  async function firmarMandatoSepa() {
    if (!hermanoPrincipal || firmandoRef.current) return
    firmandoRef.current = true
    setFirmando(true)
    const id = nuevoId()
    // La base rellena el IBAN y la fecha de verdad también: aquí solo hace
    // falta abrir la fila. Ver el disparador `mandatos_sepa_firma()`.
    setMisMandatos((prev) => [
      ...prev,
      {
        id,
        hermanoId: hermanoPrincipal.id,
        iban: hermanoPrincipal.iban ?? '',
        referencia: '',
        textoAceptado: textoDelMandatoSepa(nombreHermandadActiva),
        firmadoEn: new Date().toISOString(),
      },
    ])
    if (usarSupabase && supabase) {
      /*
       * `setMisMandatos` lanza el INSERT por su cuenta y sin esperarlo (ver
       * `useSupabaseTable`): cuando se llega aquí puede que todavía no haya
       * llegado a la base. Un solo intento se encontraría con frecuencia sin
       * fila que traer, así que se insiste unas pocas veces antes de rendirse
       * — y si nunca llega, el mandato sigue firmado igual; solo se enseñará
       * la referencia la próxima vez que se recargue esta página.
       */
      for (let intento = 0; intento < 5; intento++) {
        if (intento > 0) await new Promise((r) => setTimeout(r, 400))
        const { data } = await supabase.from('mandatos_sepa').select('referencia').eq('id', id).maybeSingle()
        if (data?.referencia) {
          setReferenciaConfirmada((prev) => ({ ...prev, [id]: data.referencia as string }))
          break
        }
      }
    }
    firmandoRef.current = false
    setFirmando(false)
  }
  /*
   * ¿Lleva cargo en la hermandad? Entonces desde su área tiene que poder
   * llegar al panel sin cerrar sesión, porque es la misma persona.
   *
   * Con `hermanoPrincipal` y no con `hermanoActivo`: las hermandades de
   * muestra del modo demostración no tienen panel al que ir. Y se pide correo
   * porque sin correo no hay cuenta, y sin cuenta el panel le rebotaría.
   */
  const llevaCargo = Boolean(
    hermanoPrincipal?.cargo
    && hermanoPrincipal.cargo !== 'Hermano de a pie'
    && hermanoPrincipal.estado !== 'Baja'
    && hermanoPrincipal.email?.includes('@'),
  )
  /* El civil no paga cuota: es lo que significa. Sin esto lee «Cuota
     pendiente» en su propia área para siempre. */
  const esCivil = Boolean(hermanoPrincipal?.civil)

  /**
   * Lo que debe este hermano: cuotas pendientes, en mora o devueltas, de
   * cualquier ejercicio. Es el mismo cálculo que hace el panel al emitir una
   * papeleta.
   */
  const miDeuda = useMemo(() => {
    if (!hermanoPrincipal) return 0
    return deudaDe(cuotas.filter((c) => c.hermanoId === hermanoPrincipal.id))
  }, [cuotas, hermanoPrincipal])

  /**
   * Su situación de cuota, sacada de los recibos. «Sin emitir» NO es «al día»:
   * a quien no se le ha cobrado nada todavía no se le puede decir que está al
   * corriente, y a él le interesa saberlo antes de que le llegue todo junto.
   */
  const miSituacionDeCuota = useMemo(
    () => (hermanoPrincipal
      ? situacionDeHermano(cuotas, hermanoPrincipal, ejercicioDeCuotas(cuotas)).situacion
      : 'sinEmitir'),
    [cuotas, hermanoPrincipal],
  )

  /**
   * ¿Puede pedir o renovar su sitio? Y si no, por qué.
   *
   * La regla de «no hay papeleta con cuotas pendientes» ya existía y la
   * respetaba el panel al emitirlas, pero el hermano podía saltársela pidiendo
   * la suya desde aquí: la secretaría se encontraba con una solicitud que su
   * propio ajuste prohibía.
   */
  const bloqueoPapeleta: string | null = deBaja
    ? 'Tu ficha figura de baja en la hermandad: no se puede sacar papeleta de sitio.'
    : ajustesCuotas.bloquearPapeletaConDeuda && miDeuda > 0
      ? `Tienes ${formatCurrency(miDeuda)} en cuotas pendientes. La hermandad pide estar al corriente para sacar papeleta de sitio: ponte al día y vuelve por aquí.`
      : null
  const {
    avisos: avisosSecretaria,
    sinLeer: avisosSinLeer,
    marcarLeidos: marcarAvisosLeidos,
    marcarLeido: marcarAvisoLeido,
    borrar: borrarAviso,
    preferencias: preferenciasAvisos,
    cambiarPreferencia: cambiarPreferenciaAviso,
    errorPreferencias: errorPreferenciasAvisos,
  } = useAvisosHermano(hermanoActivo?.id ?? null)
  /*
   * Lo que le espera, en un solo número: avisos sin leer más encargos por
   * hacer. Separarlos en dos cuentas obliga a sumar de cabeza para responder
   * a «¿tengo algo?», que es la única pregunta que se hace desde arriba.
   */
  const pendientesDeVer = avisosSinLeer + misEncargos.length
  const nombreHermandadActiva = esPrincipal ? nombrePrincipal : hermandadMuestra?.nombre ?? 'tu hermandad'
  const colorActivo = esPrincipal ? hermandadPrincipal.colorPrimario : hermandadMuestra?.color ?? '#caa24a'
  const contactoActivo = esPrincipal
    ? { telefono: hermandadPrincipal.telefono, email: hermandadPrincipal.email }
    : { telefono: hermandadMuestra?.telefono ?? '', email: hermandadMuestra?.email ?? '' }

  // Papeleta activa del hermano en una hermandad de muestra (su propio subsistema).
  const listaPapeletasMuestra = !esPrincipal && sesion ? (papeletasMuestra[sesion.hermandadId]?.[0] ?? []) : []
  const papeletaMuestraActual = hermanoMuestra
    ? listaPapeletasMuestra.find(
        (p) => p.hermanoId === hermanoMuestra.id && p.anio === campana.anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia',
      ) ?? null
    : null


  /*
   * SUS PAGOS CON TARJETA A MEDIO HACER.
   *
   * Entre que Stripe cobra y el webhook marca el recibo pasan segundos, y a
   * veces minutos. En ese hueco el hermano vuelve aquí, ve su cuota todavía
   * en «Pendiente» y hace lo que haría cualquiera: pagarla otra vez. Esto es
   * lo que se lo evita.
   *
   * `null` es «todavía no lo sé» y NO se pinta como «no tienes ninguno»: la
   * lista solo se cree cuando la base contesta. Ver `lib/pagoTarjeta.ts`.
   */
  const [intentosPago, setIntentosPago] = useState<IntentoDePago[] | null>(null)
  useEffect(() => {
    if (!sesion) { setIntentosPago(null); return }
    let cancelado = false
    misPagosConTarjeta().then((lista) => {
      if (!cancelado) setIntentosPago(lista)
    })
    return () => {
      cancelado = true
    }
    // `vueltaDelPago` está a propósito: quien acaba de volver de la pasarela
    // es justo quien necesita ver su intento recién abierto.
  }, [sesion, vueltaDelPago])


  // El censo puede haber perdido a este hermano (borrado desde el panel). Con
  // la sesión apuntando a nadie el área se quedaba a medias; se cierra sola.
  // `hermanos.length > 0` evita cerrarla mientras el censo aún está cargando.
  useEffect(() => {
    if (!sesion || !esPrincipal || hermanos.length === 0) return
    if (!hermanos.some((h) => h.id === sesion.hermanoId)) salir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, esPrincipal, hermanos])

  function salir() {
    if (usarSupabase && supabase) {
      supabase.auth.signOut()
    }
    sessionStorage.removeItem(SESION_KEY)
    setSesion(null)
    /*
     * LO QUE ANTES SE VACIABA A MANO AQUÍ LO HACE AHORA EL REMONTAJE.
     *
     * Eran nueve líneas reiniciando el formulario de entrada —el paso, la
     * hermandad elegida, el buscador, el DNI, la contraseña, los errores—.
     * Hacían falta porque todo vivía en el mismo componente y el estado
     * sobrevivía al cambio de pantalla. Ahora la pantalla de identificarse es
     * otro componente que solo existe mientras no hay hermano dentro: al salir
     * se monta de cero y sus `useState` arrancan en su valor inicial, que es
     * exactamente lo que hacían esas nueve líneas.
     *
     * La única que NO se arregla sola es el DNI: su valor inicial sale de
     * `?dni=` de la dirección, que sigue ahí después de salir. Se vacía con el
     * prop.
     */
    setDniInicial('')
    setSolTramo('')
    setSolPreferencia('')
    setSolComentario('')
    setDatosGuardados(false)
    setBajaMuestraSolicitada(false)
    setClaveError(null)
    setClaveGuardada(false)
  }

  function aceptarConsentimiento() {
    localStorage.setItem(CONSENT_KEY, 'si')
    setConsent(true)
  }

  // ---- Datos personales editables ----
  async function guardarDatos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sesion) return
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const telefono = String(data.get('telefono') ?? '').trim()

    /*
     * SI SE EQUIVOCA AQUÍ, LA HERMANDAD SE QUEDA SIN FORMA DE LLAMARLE. Este
     * formulario PISA el teléfono que tenía en su ficha, así que una cifra de
     * menos no deja el dato viejo: lo borra. Y no se descubre hasta el día que
     * hay que llamarle por algo.
     */
    const malTelefono = problemaDeTelefono(telefono)
    if (malTelefono) {
      setDatosError(malTelefono)
      return
    }

    if (esPrincipal && hermanoPrincipal) {
      const direccion = String(data.get('direccion') ?? '').trim()
      /**
       * SOLO SUS TRES CAMPOS, escritos a mano contra la base de datos.
       *
       * No se usa `setHermanos` para esto: ese circuito manda la fila ENTERA
       * con los valores que este móvil cargó al entrar, y ese móvil no se
       * refresca nunca. Un hermano que a las 10:10 cambiaba su teléfono
       * deshacía la corrección de IBAN, la etiqueta y la cuota al día que la
       * secretaría le había puesto a las 10:05. Con una baja tramitada a media
       * mañana era peor: volvía a estar activo.
       */
      if (usarSupabase && supabase) {
        const { error } = await supabase
          .from('hermanos')
          .update(contactoDelHermanoToRow({ email, telefono, direccion }))
          .eq('id', hermanoPrincipal.id)
        if (error) {
          setDatosError('No se han podido guardar tus datos. Inténtalo de nuevo en unos segundos.')
          return
        }
      }
      // Y en la copia de pantalla, para que se vea el cambio al momento.
      setHermanos((prev) => prev.map((h) => (h.id === hermanoPrincipal.id ? { ...h, email, telefono, direccion } : h)))
    } else if (hermanoMuestra) {
      const [, setCenso] = censosMuestra[sesion.hermandadId]
      setCenso((prev) => prev.map((h) => (h.id === hermanoMuestra.id ? { ...h, email, telefono } : h)))
    }
    setDatosError(null)
    setDatosGuardados(true)
    setTimeout(() => setDatosGuardados(false), 2500)
  }

  async function cambiarClave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sesion || !hermanoActivo) return
    const data = new FormData(e.currentTarget)
    const actual = String(data.get('claveActual') ?? '')
    const nueva = String(data.get('claveNueva') ?? '')
    const confirmar = String(data.get('claveConfirmar') ?? '')

    if (nueva.length < 6) {
      setClaveError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setClaveError('Las dos contraseñas nuevas no coinciden.')
      return
    }

    if (esPrincipal && usarSupabase && supabase && hermanoPrincipal) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: hermanoPrincipal.email,
        password: actual,
      })
      if (verifyError) {
        setClaveError('La contraseña actual no es correcta.')
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: nueva })
      if (updateError) {
        setClaveError('No se pudo cambiar la contraseña. Inténtalo de nuevo.')
        return
      }
      setClaveError(null)
      setClaveGuardada(true)
      e.currentTarget.reset()
      setTimeout(() => setClaveGuardada(false), 2500)
      return
    }

    if (actual !== hermanoActivo.claveAcceso) {
      setClaveError('La contraseña actual no es correcta.')
      return
    }

    if (esPrincipal && hermanoPrincipal) {
      setHermanos((prev) => prev.map((h) => (h.id === hermanoPrincipal.id ? { ...h, claveAcceso: nueva } : h)))
    } else if (hermanoMuestra) {
      const [, setCenso] = censosMuestra[sesion.hermandadId]
      setCenso((prev) => prev.map((h) => (h.id === hermanoMuestra.id ? { ...h, claveAcceso: nueva } : h)))
    }
    setClaveError(null)
    setClaveGuardada(true)
    e.currentTarget.reset()
    setTimeout(() => setClaveGuardada(false), 2500)
  }

  // ---- Papeleta de sitio (renovación / sacar) — solo hermandad principal ----
  const renovacion = useMemo(
    () => (hermanoPrincipal ? renovacionDeHermano(hermanoPrincipal.id, papeletas, campana) : null),
    [hermanoPrincipal, papeletas, campana],
  )
  /**
   * El reparto entero de la campaña. Hace falta completo y no solo la línea de
   * este hermano: para decirle quién va delante y detrás hay que tener el tramo.
   */
  const repartoActual = useMemo(
    () => repartoCompleto(tramos, papeletas.filter((p) => p.anio === campana.anio), (id) => hermanos.find((h) => h.id === id), new Set()),
    [papeletas, campana.anio, tramos, hermanos],
  )
  const asignacion = useMemo(
    () => (renovacion?.papeletaActual ? mapAsignaciones(repartoActual).get(renovacion.papeletaActual.id) : undefined),
    [repartoActual, renovacion],
  )
  /** Los compañeros de su tramo, para el «delante de ti / detrás de ti». */
  const miTramo = useMemo(
    () => (asignacion?.tramo ? repartoPorTramo(repartoActual).get(asignacion.tramo.id) ?? [] : []),
    [repartoActual, asignacion],
  )

  // Diputado de tramo: si el hermano tiene esa etiqueta y sitio asignado, puede
  // gestionar la asistencia de los hermanos de SU tramo desde su propia área.
  const esDiputadoTramo = useMemo(
    () => (hermanoPrincipal?.etiquetas ?? []).includes('Diputado de tramo'),
    [hermanoPrincipal],
  )
  const tramoDelDiputado = asignacion?.tramo ?? null
  const miembrosTramo = useMemo(() => {
    if (!esDiputadoTramo || !tramoDelDiputado) return []
    const activas = papeletas.filter((p) => p.anio === campana.anio)
    const porTramo = repartoPorTramo(
      repartoCompleto(tramos, activas, (id) => hermanos.find((h) => h.id === id), new Set()),
    )
    return (porTramo.get(tramoDelDiputado.id) ?? [])
      .filter((a) => a.estado !== 'Excede aforo')
      .map((a) => ({ hermano: a.hermano, puesto: a.puesto }))
  }, [esDiputadoTramo, tramoDelDiputado, papeletas, campana.anio, tramos, hermanos])

  const cuerposDisponibles = useMemo(() => cuerposPresentes(tramos), [tramos])
  /** ¿Participó el año anterior? (cualquier papeleta emitida, con o sin tramo): decide qué fecha de apertura le aplica. */
  const participoAnoAnterior = hermanoPrincipal
    ? participoEnCampana(hermanoPrincipal.id, papeletas, campana.anio - 1)
    : false
  /** Solicitud de papeleta que este hermano ya envió para la campaña activa (si la hay). */
  const miSolicitud = useMemo(
    () =>
      hermanoPrincipal
        ? solicitudesPapeleta.find((s) => s.hermanoId === hermanoPrincipal.id && s.anio === campana.anio) ?? null
        : null,
    [solicitudesPapeleta, hermanoPrincipal, campana.anio],
  )

  function nextNumeroPapeleta() {
    return Math.max(0, ...papeletas.map((p) => p.numero)) + 1
  }

  /**
   * Renovar su sitio. La cuenta la lleva `conRenovacion`, compartida con
   * secretaría.
   *
   * Antes esto estaba escrito aquí a mano y cogía `sitioAnterior.importe`, o
   * sea lo que costó el AÑO PASADO. Si la hermandad subía el tramo de 18 € a
   * 20 €, quien renovaba desde su móvil pagaba 18 y quien llamaba a secretaría
   * pagaba 20, los dos en el mismo tramo. Nadie se enteraba hasta cuadrar caja.
   */
  function renovarSitio() {
    if (bloqueoPapeleta || !hermanoPrincipal || !renovacion?.sitioAnterior?.tramoId) return
    const tramoId = renovacion.sitioAnterior.tramoId
    setPapeletas((prev) =>
      conRenovacion(prev, {
        hermanoId: hermanoPrincipal.id,
        tramoId,
        anio: campana.anio,
        tramos,
        precioBase,
        nuevoId,
        hoy,
      }),
    )
  }

  function noRenovar() {
    if (deBaja || !hermanoPrincipal) return
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoPrincipal.id && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id ? { ...p, tramoId: null, opcion: null, estado: 'Renuncia', importe: 0, pagoComunicado: null } : p,
        )
      }
      const renuncia: Papeleta = {
        id: nuevoId(),
        numero: nextNumeroPapeleta(),
        hermanoId: hermanoPrincipal.id,
        anio: campana.anio,
        tramoId: null,
        importe: 0,
        estado: 'Renuncia',
        fechaSolicitud: hoy(),
      }
      return [renuncia, ...prev]
    })
  }

  /**
   * El hermano envía su solicitud de papeleta de sitio. No se emite la papeleta
   * todavía: queda «Pendiente» hasta que la secretaría la acepte o rechace desde
   * el módulo Papeletas. Así el reparto lo controla siempre la hermandad.
   */
  function enviarSolicitudPapeleta(e: FormEvent) {
    e.preventDefault()
    if (bloqueoPapeleta || !hermanoPrincipal) return
    const nueva = {
      id: nuevoId(),
      hermanoId: hermanoPrincipal.id,
      hermanoNombre: hermanoPrincipal.nombre,
      hermanoNumero: hermanoPrincipal.numero,
      anio: campana.anio,
      modalidad: solModalidad,
      preferencia: solPreferencia.trim(),
      tramoSolicitado: solTramo || 'Sin preferencia',
      comentario: solComentario.trim(),
      fecha: hoy(),
      estado: 'Pendiente' as const,
    }
    setSolicitudesPapeleta([nueva, ...solicitudesPapeleta])
    setSolPreferencia('')
    setSolComentario('')
    setSolTramo('')
  }

  /**
   * El hermano avisa de que ya ha pagado un recibo. No se da por pagado: eso
   * lo hace la tesorería al ver el ingreso. Pero deja de ser una incógnita, y
   * el hermano deja de llamar para preguntar si ha llegado.
   */
  function anularAvisoPago(cuotaId: string) {
    setCuotas((prev) => prev.map((c) => (c.id === cuotaId ? { ...c, pagoComunicado: null } : c)))
  }

  function comunicarPagoCuota(cuotaId: string, metodo: MetodoPago) {
    setCuotas((prev) => prev.map((c) => (c.id === cuotaId ? { ...c, pagoComunicado: { metodo, fecha: hoy() } } : c)))
  }

  /** El hermano avisa de que ya ha pagado su papeleta por Bizum o transferencia; la secretaría lo confirma. */
  function comunicarPago(metodo: MetodoPago) {
    const p = renovacion?.papeletaActual
    if (deBaja || !p) return
    setPapeletas((prev) => prev.map((x) => (x.id === p.id ? { ...x, pagoComunicado: { metodo, fecha: hoy() } } : x)))
  }

  // ---- Papeletas de las hermandades de muestra (cada una con su propio subsistema) ----
  function sacarMuestra(opcionId: string) {
    if (!sesion || !hermanoMuestra || !hermandadMuestra) return
    const op = hermandadMuestra.opcionesPapeleta.find((o) => o.id === opcionId)
    if (!op) return
    const [, setLista] = papeletasMuestra[sesion.hermandadId]
    setLista((prev) => {
      const numero = Math.max(0, ...prev.map((p) => p.numero)) + 1
      const nueva: Papeleta = {
        id: nuevoId(),
        numero,
        hermanoId: hermanoMuestra.id,
        anio: campana.anio,
        tramoId: null,
        opcion: op.nombre,
        importe: op.importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
  }

  function comunicarPagoMuestra(metodo: MetodoPago) {
    if (!sesion || !papeletaMuestraActual) return
    const [, setLista] = papeletasMuestra[sesion.hermandadId]
    setLista((prev) =>
      prev.map((p) => (p.id === papeletaMuestraActual.id ? { ...p, pagoComunicado: { metodo, fecha: hoy() } } : p)),
    )
  }

  // ---- RGPD ----
  async function descargarMisDatos() {
    if (esPrincipal && hermanoPrincipal) {
      const datos = await recopilarDatosHermano(hermanoPrincipal.id)
      if (!datos) return
      const slug = hermanoPrincipal.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      descargarArchivo(`mis-datos-${slug}.json`, exportarDatosHermano(datos), 'application/json;charset=utf-8;')
      return
    }
    if (hermanoMuestra) {
      const slug = hermanoMuestra.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      descargarArchivo(
        `mis-datos-${slug}.json`,
        JSON.stringify({ hermandad: nombreHermandadActiva, hermano: hermanoMuestra }, null, 2),
        'application/json;charset=utf-8;',
      )
    }
  }

  /**
   * Pedir la baja. Antes era un `window.confirm` del navegador: feo, imposible
   * de leer en un móvil y sin sitio para explicarse. Ahora es un panel como el
   * resto de la aplicación, y de paso se le puede preguntar por qué se va —sin
   * obligarle, que exigir justificarse para darse de baja está feo.
   */
  function confirmarBaja(motivo: string) {
    if (deBaja) return
    if (esPrincipal && hermanoPrincipal) {
      // Es una SOLICITUD: no se da de baja solo. Queda marcada para que la
      // secretaría la tramite desde el censo.
      setHermanos((prev) =>
        prev.map((h) =>
          h.id === hermanoPrincipal.id
            ? { ...h, bajaSolicitada: true, bajaSolicitadaEl: hoy(), motivoBaja: motivo.trim() || undefined }
            : h,
        ),
      )
    } else {
      setBajaMuestraSolicitada(true)
    }
    setBajaOpen(false)
    setMotivoBaja('')
  }

  /** ¿Ya está pedida la baja? (guardada en el censo, o marcada en una hermandad de muestra). */
  const bajaPedida = esPrincipal ? Boolean(hermanoPrincipal?.bajaSolicitada) : bajaMuestraSolicitada

  const misCuotas = useMemo(
    () => (hermanoPrincipal ? cuotas.filter((c) => c.hermanoId === hermanoPrincipal.id) : []),
    [cuotas, hermanoPrincipal],
  )
  /** Los hermanos que este hermano lleva: sus hijos menores, normalmente. */
  const aCargo = useMemo(
    () => (hermanoPrincipal ? hermanos.filter((h) => h.tutorId === hermanoPrincipal.id) : []),
    [hermanos, hermanoPrincipal],
  )
  /**
   * DE QUÉ FAMILIA ES ÉL, si es de alguna.
   *
   * No sale de `hermanos`: sus políticas solo le dejan ver SU ficha y las de
   * los que lleva, así que la de su padre no está en esa lista y nunca lo
   * estará —ni debe, que ahí va el IBAN—. Se pregunta al servidor, que
   * devuelve el nombre y el número y nada más.
   */
  const [miTutor, setMiTutor] = useState<MiTutor | null>(null)
  useEffect(() => {
    void traerMiTutor().then(setMiTutor)
  }, [hermanoPrincipal?.id])

  /**
   * Todas las altas de familia que ha pedido, RESUELTAS INCLUIDAS.
   *
   * Aquí estaba el fallo: se filtraba por «Pendiente», así que en cuanto
   * secretaría resolvía una desaparecía de su área. Ni aprobada ni rechazada:
   * desaparecida. Ver `lib/familia.ts`, que es donde se decide el orden.
   */
  const solicitudesFamilia = useMemo(
    () => solicitudesDeMiFamilia(solicitudesAlta, hermanoPrincipal?.id),
    [solicitudesAlta, hermanoPrincipal],
  )

  /**
   * Pide a secretaría el alta de un hijo. No se da de alta a nadie desde aquí:
   * queda en el mismo buzón de solicitudes que ya revisa la hermandad, con la
   * marca de quién lo pide para que al aprobarla quede a su cargo.
   */
  async function solicitarAltaFamilia(
    datos: { nombre: string; dni: string; fechaNacimiento: string },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!hermanoPrincipal) return { ok: false, error: 'No se sabe quién eres. Vuelve a entrar e inténtalo otra vez.' }
    const nueva: SolicitudAlta = {
      id: nuevoId(),
      nombre: datos.nombre,
      dni: datos.dni,
      // Del menor no se pide correo ni contraseña: entra su tutor por él.
      email: hermanoPrincipal.email,
      telefono: hermanoPrincipal.telefono,
      clavePropuesta: '',
      fecha: hoy(),
      estado: 'Pendiente',
      tutorId: hermanoPrincipal.id,
      fechaNacimiento: datos.fechaNacimiento || undefined,
    }
    /*
     * SE ESPERA EL RESULTADO Y SE DEVUELVE.
     *
     * `crearSolicitudPrincipal` devuelve `{ ok, error }` a propósito —está
     * escrito así justamente para que se pueda decir cuándo falla— y aquí se
     * tiraba a la basura con un `.then()` que solo refrescaba la lista. La
     * pantalla ponía «solicitud enviada» pasara lo que pasara.
     *
     * Resultado: un hermano pedía el alta de su hijo, se quedaba convencido de
     * haberla pedido, y en secretaría no entraba nada. Se descubría semanas
     * después preguntando por qué el niño no salía en el cortejo.
     */
    const r = await crearSolicitudPrincipal(nueva)
    setSolicitudesAlta(getSolicitudes())
    return r
  }

  /** Todas sus papeletas, de cualquier año: el histórico, no solo la de ahora. */
  const misPapeletas = useMemo(
    () => (hermanoPrincipal ? papeletas.filter((p) => p.hermanoId === hermanoPrincipal.id) : []),
    [papeletas, hermanoPrincipal],
  )

  // ===================== Pantalla de identificación =====================
  if (!hermanoActivo) {
    /*
     * LA OTRA PANTALLA. Vive en `portal/Identificarse.tsx` con su estado, sus
     * efectos y sus manejadores dentro: de los treinta y cuatro bindings que
     * usaba, treinta y uno eran solo suyos. Lo que cruza son estas siete cosas.
     */
    return (
      <Identificarse
        hermanos={hermanos}
        censosMuestra={censosMuestra}
        usarSupabase={usarSupabase}
        hermandadPrincipal={hermandadPrincipal}
        nombrePrincipal={nombrePrincipal}
        colorActivo={colorActivo}
        dniInicial={dniInicial}
        onSesion={setSesion}
      />
    )
  }

  // ===================== Portal del hermano =====================
  const numeroActivo = hermanoActivo.numero
  const primerNombre = hermanoActivo.nombre.split(' ')[0]

  return (
    <div className="portal" style={estiloTema(colorActivo)}>
      <PortalHead
        hermandad={nombreHermandadActiva}
        logo={esPrincipal ? hermandadPrincipal.logoDataUrl : null}
        color={colorActivo}
        icono={esPrincipal ? undefined : hermandadMuestra?.icono}
        onSalir={salir}
        onContarFallo={() => setReporteAbierto(true)}
        alPanel={llevaCargo}
      />
      <ReportarFallo
        abierto={reporteAbierto}
        onCerrar={() => setReporteAbierto(false)}
        contexto={{
          ruta: '/hermano',
          hermandad: nombreHermandadActiva,
          // Aquí no hay cargo: quien reporta es un hermano, y decirlo así
          // ahorra la pregunta de «¿desde dónde lo mandaste?».
          cargo: 'área del hermano',
          navegador: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          tamanoPantalla:
            typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : undefined,
        }}
      />
      <main className="portal__main">
        {/*
          VUELVE DE LA PASARELA. El mensaje dice «en un momento» a propósito y
          NO da nada por cobrado: esta dirección se puede escribir a mano, y
          quien marca el recibo es el webhook cuando Stripe confirma que el
          dinero está. Prometer aquí que está pagado sería exactamente el fallo
          que costó el webhook de las suscripciones.
        */}
        {vueltaDelPago === 'hecho' && (
          <div className="banner-inline banner-inline--ok">
            <span>
              <b>Gracias, hemos recibido tu pago.</b> En un momento verás el recibo actualizado en
              tu área. Si tarda, recarga la página dentro de un minuto.
            </span>
          </div>
        )}
        {vueltaDelPago === 'cancelado' && (
          <div className="banner-inline banner-inline--warn">
            <span>
              <b>No se ha llegado a pagar.</b> No se te ha cobrado nada. Puedes volver a
              intentarlo cuando quieras, o pagar por cualquiera de los otros medios.
            </span>
          </div>
        )}
        {deBaja && (
          <div className="banner-inline banner-inline--warn portal__baja">
            <span>
              <b>Tu ficha figura de baja en la hermandad.</b> Puedes seguir viendo tu histórico y
              descargar tus datos, pero no sacar papeleta de sitio ni renovar tu sitio. Si crees que
              es un error, habla con secretaría.
            </span>
          </div>
        )}
        <div className="portal__welcome" style={{ ['--portal-accent' as string]: colorActivo }}>
          <span className="portal__welcome-avatar">{inicialesHermandad(hermanoActivo?.nombre ?? primerNombre)}</span>
          <div className="portal__welcome-text">
            <p className="eyebrow">Área del hermano · {nombreHermandadActiva}</p>
            <h1>Hola, {primerNombre}</h1>
            <div className="portal__resumen">
              <span className="pill pill--info">
                {numeroActivo > 0 ? `Nº ${numeroActivo}` : esCivil ? 'Sin número de hermano' : 'Sin número (baja)'}
              </span>
              {hermanoPrincipal && (
                <>
                  <span className={`pill ${hermanoPrincipal.estado === 'Activo' ? 'pill--ok' : hermanoPrincipal.estado === 'Nuevo' ? 'pill--info' : 'pill--off'}`}>
                    {hermanoPrincipal.estado}
                  </span>
                  {/*
                    SALE DE SUS RECIBOS, no del `cuotaAlDia` de su ficha.
                    Aquel era un booleano guardado que NADIE actualizaba al
                    cobrar: nacía en falso y se quedaba en falso, así que el
                    hermano leía «Cuota pendiente» en su propia área para
                    siempre, hubiera pagado o no. Ver lib/estadoCuotaHermano.ts.
                  */}
                  {esCivil ? (
                    <span className="pill pill--info">No se te emiten cuotas</span>
                  ) : (
                    <span className={`pill ${etiquetaDeSituacion(miSituacionDeCuota).clase}`}>
                      {miSituacionDeCuota === 'alDia'
                        ? 'Cuota al día'
                        : miSituacionDeCuota === 'sinEmitir'
                          ? 'Sin cuotas emitidas'
                          : `Debes ${formatCurrency(miDeuda)}`}
                    </span>
                  )}
                  {hermanoPrincipal.cargo && <span className="pill pill--info">{hermanoPrincipal.cargo}</span>}
                  {!esCivil && <span className="pill pill--off">Hermano/a desde {hermanoPrincipal.antiguedad}</span>}
                </>
              )}
            </div>
          </div>
        </div>

        {hermanoPrincipal && (
          <div className="portal__cards">
            <div className={`portal__card-mini portal__card-mini--${esCivil || miSituacionDeCuota === 'alDia' ? 'ok' : 'warn'}`}>
              <span className="portal__card-mini__label">Mi cuota</span>
              <span className="portal__card-mini__value">
                {esCivil
                  ? 'No procede'
                  : miSituacionDeCuota === 'alDia'
                    ? 'Al día'
                    : miSituacionDeCuota === 'sinEmitir'
                      ? 'Sin emitir'
                      : formatCurrency(miDeuda)}
              </span>
              <span className="portal__card-mini__sub">
                {esCivil
                  ? 'Hermano civil'
                  : miSituacionDeCuota === 'sinEmitir'
                    ? 'Aún no se te ha cobrado'
                    : miSituacionDeCuota === 'debe'
                      ? 'Pendiente de pago'
                      : campana.anio}
              </span>
            </div>
            {/*
              NOTIFICACIONES, ARRIBA DEL TODO.
              El buzón existía, pero estaba a media página —debajo de la cuota,
              la papeleta, el tramo y los datos personales— y se llamaba «Mi
              buzón». Quien entra a ver si tiene algo nuevo no baja hasta ahí:
              mira arriba, no ve nada, y da por hecho que no hay nada.

              Así que el aviso sube a donde se mira, y es un botón: lleva a la
              sección de un salto. Sale SIEMPRE, también cuando no hay nada,
              porque «Nada nuevo» es una respuesta y no encontrar el apartado
              no lo es.
            */}
            <button
              type="button"
              className={`portal__card-mini portal__card-mini--boton${
                pendientesDeVer > 0 ? ' portal__card-mini--warn' : ' portal__card-mini--ok'}`}
              onClick={() => {
                document.getElementById('mis-avisos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <span className="portal__card-mini__label">Notificaciones</span>
              <span className="portal__card-mini__value">
                {pendientesDeVer > 0 ? pendientesDeVer : 'Al día'}
              </span>
              <span className="portal__card-mini__sub">
                {misEncargos.length > 0
                  ? `${avisosSinLeer} sin leer · ${misEncargos.length} por hacer`
                  : pendientesDeVer > 0
                    ? `${avisosSinLeer} sin leer`
                    : 'Nada nuevo'}
              </span>
            </button>
            <div className="portal__card-mini portal__card-mini--accent">
              <span className="portal__card-mini__label">Mi papeleta {campana.anio}</span>
              <span className="portal__card-mini__value">
                {asignacion?.tramo ? etiquetaTramo(asignacion.tramo) : renovacion?.papeletaActual?.opcion ?? 'Sin sitio'}
              </span>
              <span className="portal__card-mini__sub">{renovacion?.estado ?? '—'}</span>
            </div>
            <div className="portal__card-mini">
              <span className="portal__card-mini__label">Antigüedad</span>
              <span className="portal__card-mini__value">{Math.max(0, new Date().getFullYear() - hermanoPrincipal.antiguedad)} años</span>
              <span className="portal__card-mini__sub">desde {hermanoPrincipal.antiguedad}</span>
            </div>
            <div className="portal__card-mini">
              <span className="portal__card-mini__label">Nº de hermano</span>
              <span className="portal__card-mini__value">{hermanoPrincipal.numero > 0 ? hermanoPrincipal.numero : '—'}</span>
              <span className="portal__card-mini__sub">{hermanoPrincipal.estado}</span>
            </div>
          </div>
        )}

        {!consent && (
          <div className="banner-inline banner-inline--accent portal__consent">
            <span>
              {nombreHermandadActiva} trata tus datos personales para gestionar tu condición de hermano/a (cuotas, papeletas y
              comunicaciones), conforme al RGPD. Puedes descargar o solicitar la supresión de tus datos abajo.
            </span>
            <button className="btn btn-primary btn-sm" onClick={aceptarConsentimiento}>
              Entendido
            </button>
          </div>
        )}

        {/*
          LO QUE LE HAN ENCARGADO. Va ANTES del buzón a propósito: el buzón son
          cosas que han pasado y esto son cosas que hay que hacer, y lo segundo
          se lee primero. Solo sale si tiene algo pendiente — a un hermano que
          no lleva redes no le aparece nunca un apartado vacío.
        */}
        {esPrincipal && hermanoPrincipal && misEncargos.length > 0 && (
          <section className="portal__section">
            <h2>Lo que tengo que hacer</h2>
            <p className="form-hint">
              Encargos de la junta. Cuando termines uno, márcalo y quien lo pidió lo verá hecho.
            </p>
            <ul className="lista-limpia">
              {misEncargos.map((t) => (
                <li key={t.id} className="assign-box" style={{ marginBottom: '0.6rem' }}>
                  <div>
                    <strong>{loQueHayQueHacer(t)}</strong>
                    <p className="form-hint" style={{ margin: '0.2rem 0' }}>{t.titulo}</p>
                    {/* El texto del post, para no tener que pedirlo por WhatsApp. */}
                    {t.texto && <p style={{ whiteSpace: 'pre-wrap', margin: '0.4rem 0' }}>{t.texto}</p>}
                    {t.notas && <p className="form-hint">{t.notas}</p>}
                  </div>
                  <div className="assign-box__row">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => marcarEncargoHecho(t.id)}
                    >
                      Ya está hecho
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Avisos de la secretaría: cambios que la hermandad ha hecho en tus datos */}
        <BuzonHermano
          avisos={avisosSecretaria}
          sinLeer={avisosSinLeer}
          marcarLeidos={marcarAvisosLeidos}
          marcarLeido={marcarAvisoLeido}
          borrar={borrarAviso}
          preferencias={preferenciasAvisos}
          cambiarPreferencia={cambiarPreferenciaAviso}
          errorPreferencias={errorPreferenciasAvisos}
        />

        {/* Lo que tiene apartado en la tienda de la web, si algo. Va detrás del
            buzón porque el aviso de «tu reserva está lista» llega ahí, y esto es
            a donde tiene que llevar. */}
        <MisReservasTienda hermanoId={hermanoActivo?.id ?? null} />

        {/* Calendario de la hermandad: lo que viene, con las repeticiones ya
            desplegadas. El hermano ve los actos abiertos, no los cabildos
            internos ni la formación de la junta. */}
        <section className="portal__section">
          <h2>Calendario de la hermandad</h2>
          <p className="portal__lead">
            Cultos, salidas y actos. Pulsa un día para ver lo que hay.
          </p>
          <div className="portal__calendario-fila">
          <div className="portal__calendario">
            <CalendarioMes
              eventos={eventos}
              filtrar={(e) => TIPOS_PARA_HERMANOS.has(e.tipo)}
              onAbrirDia={(fecha, delDia) => setDiaCalendario({ fecha, delDia })}
              compacto
            />
            <div className="eventos-cal__leyenda">
              <span><i className="eventos-cal__punto evento-tipo--culto" /> Culto</span>
              <span><i className="eventos-cal__punto evento-tipo--salida" /> Salida</span>
              <span><i className="eventos-cal__punto evento-tipo--caridad" /> Caridad</span>
              <span><i className="eventos-cal__punto evento-tipo--otro" /> Otros</span>
            </div>
          </div>
          {diaCalendario ? (
            <div className="portal__dia">
              <div className="portal__dia-head">
                <b>{fechaLarga(diaCalendario.fecha)}</b>
                <button type="button" className="icon-btn" onClick={() => setDiaCalendario(null)} aria-label="Cerrar el día">✕</button>
              </div>
              <ul className="portal__dia-lista">
                {diaCalendario.delDia.map(({ evento, vuelta }) => (
                  <li key={`${evento.id}-${vuelta}`}>
                    <span className={`eventos-item__tipo ${claseTipo(evento.tipo)}`}>{evento.tipo}</span>
                    <div>
                      <b>{evento.titulo}</b>
                      <small>
                        {[evento.hora, evento.lugar].filter(Boolean).join(' · ')}
                      </small>
                      {evento.descripcion && <p>{evento.descripcion}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="form-hint">Pulsa un día marcado para ver qué hay.</p>
          )}
          </div>
        </section>

        {/* Diputado de tramo: asistencia de los hermanos de su tramo el día de salida */}
        {esDiputadoTramo && (
          <section className="portal__section">
            <h2>Mi tramo · día de salida {campana.anio}</h2>
            {tramoDelDiputado ? (
              <>
                <p className="portal__lead">
                  Eres diputado/a del tramo <b>{etiquetaTramo(tramoDelDiputado)}</b>. Confirma quién sale
                  y quién no (con el motivo). La secretaría lo ve al instante en el panel.
                </p>
                <AsistenciaTramo
                  anio={campana.anio}
                  miembros={miembrosTramo}
                  porQuien={hermanoPrincipal?.nombre ?? 'Diputado de tramo'}
                />
              </>
            ) : (
              <p className="portal__lead">
                Cuando tengas tu sitio asignado en el cortejo, aquí verás a los hermanos de tu tramo
                para tomar la asistencia del día de salida.
              </p>
            )}
          </section>
        )}

        {/* Papeletas de una hermandad de muestra: su propio subsistema, con sus papeletas y sus datos de pago */}
        {!esPrincipal && hermandadMuestra && hermanoMuestra && (
          <section className="portal__section">
            <h2>Mi papeleta de sitio · {campana.anio}</h2>
            {papeletaMuestraActual ? (
              <div className="portal__papeleta">
                <div className="ficha__row">
                  <span
                    className={`pill ${papeletaMuestraActual.estado === 'Asignada' ? 'pill--warn' : 'pill--ok'}`}
                  >
                    {papeletaMuestraActual.estado === 'Asignada' ? 'Pendiente de pago' : papeletaMuestraActual.estado}
                  </span>
                  <span className="pill pill--info">{papeletaMuestraActual.opcion}</span>
                  <span className="pill pill--off">Papeleta nº {papeletaMuestraActual.numero}</span>
                </div>
                {papeletaMuestraActual.estado === 'Asignada' ? (
                  <PagoPapeleta
                    papeleta={papeletaMuestraActual}
                    bizum={hermandadMuestra.bizum}
                    iban={hermandadMuestra.iban}
                    nombreHermandad={nombreHermandadActiva}
                    hermano={hermanoMuestra}
                    onComunicar={comunicarPagoMuestra}
                  />
                ) : (
                  <p className="portal__lead">
                    Papeleta pagada. La secretaría de {nombreHermandadActiva} te avisará para recogerla.
                  </p>
                )}
              </div>
            ) : (
              <div className="assign-box">
                <label htmlFor="opcionMuestra">Sacar mi papeleta</label>
                <select id="opcionMuestra" defaultValue="" onChange={(e) => e.target.value && sacarMuestra(e.target.value)}>
                  <option value="" disabled>
                    Elige tu papeleta…
                  </option>
                  {hermandadMuestra.opcionesPapeleta.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre} — {o.importe} €
                    </option>
                  ))}
                </select>
                <p className="form-hint">Papeletas que ofrece {nombreHermandadActiva} para esta salida.</p>
              </div>
            )}
          </section>
        )}

        {/* Mi papeleta de sitio — solo si la hermandad tiene el módulo activo */}
        {esPrincipal && (
          <section className="portal__section">
            <h2>Mi papeleta de sitio · Campaña {campana.anio}</h2>
            {renovacion && (
              <div className="portal__papeleta">
                <div className="ficha__row">
                  <span className={`pill ${renovacion.estado === 'Renovada' || renovacion.estado === 'Nueva' ? 'pill--ok' : renovacion.estado === 'Por renovar' ? 'pill--warn' : renovacion.estado === 'No renovada' ? 'pill--err' : 'pill--off'}`}>
                    {renovacion.estado}
                  </span>
                  {asignacion?.tramo && <span className="pill pill--info">{etiquetaTramo(asignacion.tramo)}</span>}
                </div>

                {/* Dónde va exactamente: puesto, citación y con quién. */}
                {asignacion?.tramo && (
                  <MiSitioCortejo
                    asignacion={asignacion}
                    compañeros={miTramo}
                    donde={hermandadPrincipal.direccion}
                    salida={campana.fechaSalida ? formatDate(new Date(`${campana.fechaSalida}T00:00:00`)) : null}
                  />
                )}

                {bloqueoPapeleta && (
                  <div className="banner-inline banner-inline--warn">
                    <span>{bloqueoPapeleta}</span>
                    {/* Decir que debe algo sin enseñarle el qué deja al hermano
                        buscándolo por la página. */}
                    {!deBaja && <a className="btn btn-outline btn-sm" href="#mis-cuotas">Ver mis cuotas</a>}
                  </div>
                )}

                {!bloqueoPapeleta && renovacion.estado === 'Por renovar' && renovacion.sitioAnterior?.tramoId && (
                  <>
                    <p className="portal__lead">
                      {/* El `!` de aquí tumbaba el área entera. Si los tramos
                          todavía no han llegado —o el de su papeleta ya no
                          existe porque lo han quitado— el `find` no devuelve
                          nada y `etiquetaTramo` reventaba con un TypeError: el
                          hermano se encontraba su área EN BLANCO, sin ningún
                          mensaje, y no había nada que pudiera hacer. */}
                      El año pasado saliste en{' '}
                      <b>{etiquetaTramo(tramos.find((t) => t.id === renovacion.sitioAnterior!.tramoId)) || 'tu tramo'}</b>. La renovación
                      está {ventanaAbiertaPara(campana, true, hayCampana) ? 'abierta' : 'cerrada'}
                      {ventanaAbiertaPara(campana, true, hayCampana)
                        ? ` hasta el ${formatDate(new Date(`${campana.fechaLimiteRenovacion}T00:00:00`))}`
                        : ''}
                      .
                    </p>
                    {ventanaAbiertaPara(campana, true, hayCampana) ? (
                      <div className="assign-box__row">
                        <button className="btn btn-primary" onClick={renovarSitio}>
                          Renovar mi sitio
                        </button>
                        <button className="btn btn-ghost" onClick={noRenovar}>
                          Este año no salgo
                        </button>
                      </div>
                    ) : diasHasta(campana.fechaInicioParticiparon) > 0 ? (
                      <p className="form-hint">
                        La renovación abre el {formatDate(new Date(`${campana.fechaInicioParticiparon}T00:00:00`))}.
                      </p>
                    ) : (
                      <p className="form-hint">El plazo de renovación ha terminado. Contacta con la secretaría.</p>
                    )}
                  </>
                )}

                {/* Renunció este año: se le confirma, en vez de volver a ofrecerle
                    el formulario como si no hubiera hecho nada. */}
                {renovacion.papeletaActual?.estado === 'Renuncia' && (
                  <div className="assign-box assign-box--wait">
                    <label>Este año no sales</label>
                    <p className="portal__lead">
                      Queda registrado que renuncias a tu sitio en la estación de penitencia de{' '}
                      {campana.anio}. Si cambias de idea antes de que acabe el plazo, escribe a la
                      secretaría de {nombreHermandadActiva}.
                    </p>
                  </div>
                )}

                {!bloqueoPapeleta &&
                  renovacion.papeletaActual?.estado !== 'Renuncia' &&
                  (renovacion.estado === 'Sin papeleta' || renovacion.estado === 'No renovada') &&
                  (miSolicitud && miSolicitud.estado === 'Pendiente' ? (
                    <div className="assign-box assign-box--wait">
                      <label>Solicitud enviada</label>
                      <p className="portal__lead">
                        Pediste <b>{miSolicitud.modalidad}</b>
                        {miSolicitud.tramoSolicitado !== 'Sin preferencia' ? ` · ${miSolicitud.tramoSolicitado}` : ''}. La
                        secretaría la revisará y te avisará.
                      </p>
                      <p className="form-hint">Enviada el {miSolicitud.fecha} · pendiente de revisión.</p>
                    </div>
                  ) : ventanaAbiertaPara(campana, participoAnoAnterior, hayCampana) ? (
                    <form className="assign-box" onSubmit={enviarSolicitudPapeleta}>
                      <label>Solicitar mi papeleta de sitio</label>
                      {miSolicitud && miSolicitud.estado === 'Rechazada' && (
                        <p className="form-hint form-hint--error">
                          Tu solicitud anterior no fue aceptada. Puedes enviar una nueva.
                        </p>
                      )}
                      <div className="form-grid-2">
                        <div className="field">
                          <label htmlFor="solModalidad">Modalidad</label>
                          <select
                            id="solModalidad"
                            value={solModalidad}
                            onChange={(e) => setSolModalidad(e.target.value as ModalidadPapeleta)}
                          >
                            {MODALIDADES.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="solTramo">Cuerpo o tramo preferido</label>
                          <select id="solTramo" value={solTramo} onChange={(e) => setSolTramo(e.target.value)}>
                            <option value="">Sin preferencia</option>
                            {cuerposDisponibles.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="solPreferencia">Preferencia (opcional)</label>
                        <input
                          id="solPreferencia"
                          type="text"
                          value={solPreferencia}
                          placeholder="P. ej. cirio junto a mi hermano"
                          onChange={(e) => setSolPreferencia(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="solComentario">Comentario para la secretaría (opcional)</label>
                        <textarea
                          id="solComentario"
                          rows={2}
                          value={solComentario}
                          onChange={(e) => setSolComentario(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary">
                        Enviar solicitud
                      </button>
                      <p className="form-hint">
                        No se te cobra ni se te asigna nada todavía: la secretaría revisa tu solicitud y te confirma el
                        puesto.
                      </p>
                    </form>
                  ) : diasHasta(
                      participoAnoAnterior ? campana.fechaInicioParticiparon : campana.fechaInicioNoParticiparon,
                    ) > 0 ? (
                    <p className="form-hint">
                      El plazo de solicitud de papeletas abre el{' '}
                      {formatDate(
                        new Date(
                          `${participoAnoAnterior ? campana.fechaInicioParticiparon : campana.fechaInicioNoParticiparon}T00:00:00`,
                        ),
                      )}
                      .
                    </p>
                  ) : (
                    <p className="form-hint">
                      El plazo de solicitud de papeletas ha terminado. Contacta con la secretaría.
                    </p>
                  ))}

                {(renovacion.estado === 'Renovada' || renovacion.estado === 'Nueva') && renovacion.papeletaActual && hermanoPrincipal && (
                  <>
                    <p className="portal__lead">
                      {renovacion.papeletaActual.estado === 'Solicitada' ? (
                        <>
                          Tu solicitud está <b>pendiente de asignación</b>: la secretaría te dará
                          sitio y te avisará. Todavía no hay nada que pagar.
                        </>
                      ) : (
                        <>
                          Tienes tu sitio para este año
                          {asignacion?.tramo ? ` en ${etiquetaTramo(asignacion.tramo)}` : ''}. La secretaría te
                          avisará para recoger la papeleta física.
                        </>
                      )}
                    </p>
                    {/* En pantalla, la tarjeta: los cuatro datos que se
                        consultan de verdad, legibles sin ampliar. */}
                    <PapeletaTarjeta
                      papeleta={renovacion.papeletaActual}
                      hermano={hermanoPrincipal}
                      hermandadNombre={hermandadPrincipal.nombreLegal || nombrePrincipal}
                      tramoEtiqueta={asignacion?.tramo ? etiquetaTramo(asignacion.tramo) : null}
                      puesto={asignacion?.puesto ?? null}
                      fechaSalida={campana.fechaSalida ?? undefined}
                      excedeAforo={asignacion?.estado === 'Excede aforo'}
                    />
                    {/* Y el documento entero, solo al imprimir. */}
                    <div className="solo-impresion">
                      {modeloPapeleta ? (
                        <PapeletaModeloRender
                          modelo={modeloPapeleta}
                          datos={{
                            hermano: hermanoPrincipal,
                            papeleta: renovacion.papeletaActual,
                            tramoEtiqueta: asignacion?.tramo ? etiquetaTramo(asignacion.tramo) : null,
                            puesto: asignacion?.puesto ?? null,
                            hermandadNombre: hermandadPrincipal.nombreLegal || nombrePrincipal,
                            fechaSalida: campana.fechaSalida,
                          }}
                        />
                      ) : (
                        <PapeletaTicket
                          papeleta={renovacion.papeletaActual}
                          hermano={hermanoPrincipal}
                          hermandad={hermandadPrincipal}
                          tramo={asignacion?.tramo}
                          puesto={asignacion?.puesto ?? null}
                          excedeAforo={asignacion?.estado === 'Excede aforo'}
                          opcion={renovacion.papeletaActual.opcion}
                        />
                      )}
                    </div>
                    {/* Solo se cobra cuando la papeleta está ASIGNADA: una simple
                        solicitud aún no tiene sitio ni importe firme. */}
                    {renovacion.papeletaActual.estado === 'Asignada' && (
                      <PagoPapeleta
                        papeleta={renovacion.papeletaActual}
                        bizum={hermandadPrincipal.bizumTelefono}
                        iban={hermandadPrincipal.iban}
                        nombreHermandad={nombreHermandadActiva}
                        hermano={hermanoPrincipal}
                        onComunicar={comunicarPago}
                        cuentaStripe={hermandadPrincipal.stripeCuenta}
                        intentos={intentosPago}
                      />
                    )}
                    <div className="assign-box__row" style={{ marginTop: '1rem' }}>
                      <button type="button" className="btn btn-outline" onClick={() => window.print()}>
                        Imprimir / descargar mi papeleta
                      </button>
                    </div>
                  </>
                )}

              </div>
            )}
          </section>
        )}

        {/* Su familia: los menores que lleva él. */}
        {esPrincipal && hermanoPrincipal && (
          <MiFamilia
            aCargo={aCargo}
            papeletas={papeletas}
            cuotas={cuotas}
            tramos={tramos}
            anioCampana={campana.anio}
            solicitudesFamilia={solicitudesFamilia}
            onSolicitarAlta={solicitarAltaFamilia}
            bloqueado={deBaja ? 'Tu ficha figura de baja: no se pueden pedir altas nuevas.' : null}
            tutor={miTutor}
          />
        )}

        {/* Su carné digital, con QR: para secretaría y para el día de la salida. */}
        {esPrincipal && hermanoPrincipal && (
          <CarneHermano
            hermano={hermanoPrincipal}
            hermandadNombre={nombreHermandadActiva}
            logo={hermandadPrincipal.logoDataUrl}
          />
        )}

        {/* Su histórico: papeletas y cuotas de todos los años, con sus recibos. */}
        {esPrincipal && hermanoPrincipal && (
          <HistorialHermano
            hermano={hermanoPrincipal}
            cuotas={misCuotas}
            papeletas={misPapeletas}
            tramos={tramos}
            hermandad={hermandadPrincipal}
            onPagar={deBaja ? undefined : comunicarPagoCuota}
            onAnularAviso={deBaja ? undefined : anularAvisoPago}
            intentosTarjeta={intentosPago}
          />
        )}

        {/*
          LOS DOCUMENTOS, ANTES DE «MIS DATOS». Es lo que el hermano viene a
          consultar —las reglas, un boletín—, y lo de abajo es lo que viene a
          cambiar. Primero lo que se lee, después lo que se toca.
        */}
        <DocumentosDelHermano documentos={documentos} />

        {/* Mis datos */}
        <section className="portal__section">
          <h2>Mi foto</h2>
          <p className="form-hint">
            Sale en tu carné y en el listado del cortejo. El día de la salida, el diputado de tramo
            busca caras, no números.
          </p>
          {esPrincipal && hermanoPrincipal ? (
            <FotoHermano
              nombre={hermanoPrincipal.nombre}
              foto={hermanoPrincipal.fotoDataUrl}
              consiente={hermanoPrincipal.consienteFoto}
              tamano={110}
              onCambiar={(foto, consiente) =>
                setHermanos((prev) =>
                  prev.map((h) =>
                    h.id === hermanoPrincipal.id ? { ...h, fotoDataUrl: foto, consienteFoto: consiente } : h,
                  ),
                )
              }
            />
          ) : (
            <p className="form-hint">
              En la hermandad de muestra la foto no se guarda: entra con tu cuenta para poder
              ponerla.
            </p>
          )}
        </section>

        <section className="portal__section">
          <h2>Mis datos de contacto</h2>
          <form className="app-form" onSubmit={guardarDatos}>
            <div className="form-row">
              <label htmlFor="miEmail">Correo electrónico</label>
              <input id="miEmail" name="email" type="email" defaultValue={hermanoActivo.email} />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="miTelefono">Teléfono</label>
                <input
                  id="miTelefono" name="telefono" type="tel" inputMode="tel"
                  placeholder="600 00 00 00"
                  defaultValue={siNoEsElHueco(hermanoActivo.telefono)}
                />
              </div>
              {hermanoPrincipal && (
                <div className="form-row">
                  <label htmlFor="miDireccion">Dirección</label>
                  <input
                    id="miDireccion" name="direccion" type="text"
                    placeholder="Calle y número"
                    defaultValue={siNoEsElHueco(hermanoPrincipal.direccion)}
                  />
                </div>
              )}
            </div>
            <div className="assign-box__row">
              <button type="submit" className="btn btn-primary">Guardar mis datos</button>
              {datosGuardados && <span className="alert-item alert-item--ok">Datos actualizados.</span>}
              {/* Antes, si el guardado fallaba, la pantalla decía «Datos
                  actualizados» igualmente y el hermano se iba tan tranquilo
                  con su teléfono viejo en el censo. */}
              {datosError && <span className="alert-item alert-item--alerta">{datosError}</span>}
            </div>
          </form>
        </section>

        {/* Domiciliación SEPA: solo aparece si es él mismo, con su propia ficha. */}
        {esPrincipal && hermanoPrincipal && (
          <section className="portal__section">
            <h2>Mi domiciliación bancaria (SEPA)</h2>
            {!hermanoPrincipal.iban ? (
              <p className="form-hint">
                Tu ficha no tiene ninguna cuenta bancaria apuntada. Pide a secretaría que te la
                añada y podrás firmar tu domiciliación desde aquí.
              </p>
            ) : miMandatoVigente ? (
              <div className="banner-inline banner-inline--ok">
                Domiciliación firmada el {formatDate(new Date(miMandatoVigente.firmadoEn))} para la
                cuenta {maskIban(hermanoPrincipal.iban)}. Referencia del mandato:{' '}
                {referenciaConfirmada[miMandatoVigente.id] || miMandatoVigente.referencia
                  || 'confirmando con el banco…'}
                .
              </div>
            ) : (
              <>
                <p className="form-hint">
                  Tu cuenta es {maskIban(hermanoPrincipal.iban)}. Todavía no has firmado la orden
                  que autoriza a {nombreHermandadActiva} a cobrarte los recibos domiciliados en
                  ella — sin esto, tus cuotas domiciliadas no entran en la remesa que se manda al
                  banco.
                </p>
                <p className="form-hint">{textoDelMandatoSepa(nombreHermandadActiva)}</p>
                <div className="assign-box__row">
                  <button type="button" className="btn btn-primary" onClick={firmarMandatoSepa} disabled={firmando}>
                    Firmar mi domiciliación
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* Cambiar contraseña */}
        <section className="portal__section">
          <h2>Cambiar mi contraseña</h2>
          <form className="app-form" onSubmit={cambiarClave}>
            <div className="form-row">
              <label htmlFor="claveActual">Contraseña actual</label>
              <input id="claveActual" name="claveActual" type="password" autoComplete="current-password" required />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="claveNueva">Nueva contraseña</label>
                <input id="claveNueva" name="claveNueva" type="password" autoComplete="new-password" required minLength={6} />
              </div>
              <div className="form-row">
                <label htmlFor="claveConfirmar">Repite la nueva contraseña</label>
                <input id="claveConfirmar" name="claveConfirmar" type="password" autoComplete="new-password" required minLength={6} />
              </div>
            </div>
            {claveError && <p className="form-hint form-hint--error">{claveError}</p>}
            <div className="assign-box__row">
              <button type="submit" className="btn btn-primary">Cambiar contraseña</button>
              {claveGuardada && <span className="alert-item alert-item--ok">Contraseña actualizada.</span>}
            </div>
          </form>
        </section>

        {/* RGPD */}
        <section className="portal__section">
          <h2>Mis datos y privacidad (RGPD)</h2>
          <p className="form-hint">
            Tienes derecho a acceder a tus datos y a solicitar su supresión. La baja la tramita la secretaría de {nombreHermandadActiva}.
          </p>
          {bajaPedida && (
            <div className="banner-inline banner-inline--warn" style={{ marginBottom: '0.8rem' }}>
              Has solicitado la baja. La secretaría de {nombreHermandadActiva} la tramitará; hasta
              entonces sigues siendo hermano/a de pleno derecho.
            </div>
          )}
          <div className="assign-box__row">
            <button className="btn btn-outline" onClick={descargarMisDatos}>Descargar mis datos</button>
            <button className="btn btn-ghost rgpd-borrar" onClick={() => setBajaOpen(true)} disabled={bajaPedida}>
              {bajaPedida ? 'Baja solicitada' : 'Solicitar la baja'}
            </button>
          </div>
        </section>

        <Drawer
          open={bajaOpen}
          onClose={() => { setBajaOpen(false); setMotivoBaja('') }}
          title="Solicitar la baja"
          subtitle={nombreHermandadActiva}
          footer={
            <>
              <button className="btn btn-ghost rgpd-borrar" onClick={() => confirmarBaja(motivoBaja)}>
                Sí, solicitar la baja
              </button>
              <button className="btn btn-primary" onClick={() => { setBajaOpen(false); setMotivoBaja('') }}>
                Seguir siendo hermano/a
              </button>
            </>
          }
        >
          <p className="form-hint">
            La baja no es automática: la tramita la secretaría de {nombreHermandadActiva}. Hasta
            entonces sigues siendo hermano/a de pleno derecho, con tu número y tu antigüedad.
          </p>
          <div className="form-row">
            <label htmlFor="motivoBaja">¿Quieres decirnos por qué? (opcional)</label>
            <textarea
              id="motivoBaja" rows={4} value={motivoBaja}
              onChange={(e) => setMotivoBaja(e.target.value)}
              placeholder="Me mudo fuera, no puedo con la cuota, no puedo salir…"
            />
            <p className="form-hint">
              No hace falta contestar para darte de baja. Pero si es algo que la hermandad pueda
              resolver —la cuota, los horarios—, decirlo es la única forma de que lo sepan.
            </p>
          </div>
        </Drawer>

        {(contactoActivo.telefono || contactoActivo.email) && (
          <p className="portal__contact">
            ¿Dudas? Contacta con la secretaría de {nombreHermandadActiva}
            {contactoActivo.telefono && <> · {contactoActivo.telefono}</>}
            {contactoActivo.email && (
              <>
                {' · '}
                <a href={`mailto:${contactoActivo.email}`}>{contactoActivo.email}</a>
              </>
            )}
          </p>
        )}
      </main>
    </div>
  )
}

/**
 * Pago de la papeleta desde el área del hermano. El dinero va directo a la
 * hermandad (su Bizum o su cuenta); aquí solo se le enseñan al hermano los
 * datos y él avisa de que ya ha pagado, para que la secretaría lo confirme
 * cuando vea el ingreso.
 *
 * Y CON TARJETA, si la hermandad ha enlazado su cuenta de cobro (C4). Ese sí
 * se cierra solo: no hace falta que nadie avise ni que nadie cotejo el
 * extracto. El dinero va igualmente directo a la hermandad — el cobro se crea
 * contra SU cuenta conectada, Gobergo no lo toca. Ver `lib/pagoTarjeta.ts`.
 */
