import type { ErrorTraducido } from '../lib/errorDeBaseDeDatos'
import { useEffect, useMemo, useState, useRef } from 'react'
import { copiaSemanalSiTocaba } from '../lib/copiaAutomatica'
import { cargarCampanaDeLaBase } from '../lib/campana'
import { NavLink, Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import BarraDeshacer from './BarraDeshacer'
import { papelesDeLaCuenta, type PapelesDeLaCuenta } from '../lib/multiHermandad'
import Logo, { LogoMark } from './Logo'
import AltaHermandad from './AltaHermandad'
import { altaPendiente } from '../lib/altaHermandad'
import { useHermandadSettingsConEstado } from '../lib/hermandadSettings'
import ThemeToggle from './ThemeToggle'
import PaletaComandos, { type DestinoPaleta } from './PaletaComandos'
import { useAuth } from '../context/AuthContext'
import { useCargoDeLaSesionConEstado, puedeVerModulo, usePermisosSincronizados, cargoEnCristiano } from '../lib/permisos'
import { useSuscripcion, moduloPermitidoPorPack } from '../lib/suscripcion'
import PantallaSuscripcion from './PantallaSuscripcion'
import ReportarFallo from './ReportarFallo'

interface NavItem {
  to: string
  label: string
  icon: JSX.Element
  /** Módulo de lib/permisos.ts que gobierna este enlace; sin él, siempre visible (p. ej. Inicio). */
  modulo?: string
}
interface NavGroup {
  label?: string
  items: NavItem[]
}

/** De la ruta actual al módulo que la gobierna, para bloquear el acceso directo por URL. null = sin restricción (Inicio). */
function moduloIdDeRuta(pathname: string): string | null {
  const rutas: { prefix: string; modulo: string }[] = [
    { prefix: '/app/hermanos', modulo: 'hermanos' },
    { prefix: '/app/cortejo', modulo: 'cortejo' },
    { prefix: '/app/cuotas', modulo: 'cuotas' },
    { prefix: '/app/papeletas', modulo: 'papeletas' },
    { prefix: '/app/tesoreria', modulo: 'tesoreria' },
    { prefix: '/app/inventario', modulo: 'inventario' },
    // La tienda va con el módulo de inventario: quien lleva el almacén de
    // la hermandad lleva también el género. Sin abrir un módulo nuevo, que
    // obligaría a cada hermandad a repartir permisos otra vez.
    { prefix: '/app/tienda', modulo: 'inventario' },
    { prefix: '/app/archivo', modulo: 'archivo' },
    { prefix: '/app/eventos', modulo: 'eventos' },
    { prefix: '/app/campanas', modulo: 'campanas' },
    { prefix: '/app/comunicados', modulo: 'comunicados' },
    { prefix: '/app/web', modulo: 'web' },
    { prefix: '/app/informes', modulo: 'informes' },
    { prefix: '/app/personal', modulo: 'personal' },
    { prefix: '/app/configuracion', modulo: 'configuracion' },
  ]
  return rutas.find((r) => pathname.startsWith(r.prefix))?.modulo ?? null
}

const ic = {
  inicio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9.5h12V10" /></svg>
  ),
  hermanos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3" /><path d="M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M16 8a3 3 0 0 1 0 6M21 21v-2a4 4 0 0 0-3-3.8" /></svg>
  ),
  cortejo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v18M6 8v13M18 8v13M4 21h16" /><circle cx="12" cy="3" r="1.4" /></svg>
  ),
  cuotas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
  ),
  papeletas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" /><path d="M10 6v12" strokeDasharray="2 2" /></svg>
  ),
  tesoreria: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h18v12H3z" /><path d="M3 10h18M7 15h4" /></svg>
  ),
  inventario: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
  ),
  // La tienda: una bolsa. Se distingue de la caja del inventario de un
  // vistazo, que es lo que hace falta en un menú con trece entradas.
  tienda: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
  ),
  archivo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4h10l6 6v10H4Z" /><path d="M14 4v6h6" /></svg>
  ),
  eventos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 15l2.2 2.2L15 12.5" /></svg>
  ),
  comunicados: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></svg>
  ),
  campanas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /><path d="M12 4V2M12 22v-2M4 12H2M22 12h-2" /></svg>
  ),
  /* «Web pública» llevaba el mismo bocadillo que «Comunicados»: en el menú
     lateral salían dos entradas seguidas con el mismo dibujo, y de un vistazo
     parecían la misma cosa. Un globo terráqueo dice de qué va. */
  web: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></svg>
  ),
  informes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 21V9M12 21V4M19 21v-6" /></svg>
  ),
  personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M8 14h.01M12 14h4" /></svg>
  ),
  configuracion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10c.14.42.42.78 1.55 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></svg>
  ),
  seguridad: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l8 3.5v5c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5v-5L12 3Z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
}

const NAV: NavGroup[] = [
  {
    items: [
      { to: '/app', label: 'Inicio', icon: ic.inicio },
      { to: '/app/notificaciones', label: 'Notificaciones', icon: ic.comunicados },
      { to: '/app/hermanos', label: 'Hermanos', icon: ic.hermanos, modulo: 'hermanos' },
      { to: '/app/cortejo', label: 'Cortejo', icon: ic.cortejo, modulo: 'cortejo' },
      { to: '/app/cuotas', label: 'Cuotas', icon: ic.cuotas, modulo: 'cuotas' },
      { to: '/app/papeletas', label: 'Papeletas de sitio', icon: ic.papeletas, modulo: 'papeletas' },
    ],
  },
  {
    label: 'Economía',
    items: [
      { to: '/app/tesoreria', label: 'Tesorería', icon: ic.tesoreria, modulo: 'tesoreria' },
      { to: '/app/inventario', label: 'Inventario', icon: ic.inventario, modulo: 'inventario' },
      /*
       * UNA ENTRADA Y NO CINCO. La tienda ocupaba cinco de las quince líneas
       * del menú —Tienda, Almacén y artículos, Reservas de la web, Facturas de
       * la tienda, Datos de la tienda— para un módulo que se usa dos veces al
       * año. Y las cinco eran caras del mismo mostrador: lo que se aparta por
       * la web sale del mismo estante que lo que se cobra a mano.
       *
       * Ahora son pestañas dentro de la pantalla, y las cinco direcciones de
       * siempre siguen abriendo su pestaña.
       */
      { to: '/app/tienda', label: 'Tienda', icon: ic.tienda, modulo: 'inventario' },
    ],
  },
  {
    label: 'Vida de hermandad',
    items: [
      { to: '/app/eventos', label: 'Eventos y tareas', icon: ic.eventos, modulo: 'eventos' },
      { to: '/app/campanas', label: 'Campañas y proyectos', icon: ic.campanas, modulo: 'campanas' },
      { to: '/app/archivo', label: 'Archivo documental', icon: ic.archivo, modulo: 'archivo' },
      { to: '/app/comunicados', label: 'Comunicados', icon: ic.comunicados, modulo: 'comunicados' },
      { to: '/app/web', label: 'Web pública', icon: ic.web, modulo: 'web' },
      { to: '/app/informes', label: 'Informes', icon: ic.informes, modulo: 'informes' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/app/personal', label: 'Personal y permisos', icon: ic.personal, modulo: 'personal' },
      { to: '/app/configuracion', label: 'Configuración', icon: ic.configuracion, modulo: 'configuracion' },
      // Sin `modulo`: es la seguridad de la propia cuenta, no un módulo de gestión de la
      // hermandad, así que se ve pase lo que pase tenga el cargo que tenga permitido.
      { to: '/app/seguridad', label: 'Seguridad', icon: ic.seguridad },
    ],
  },
]

/** Fecha de hoy en ISO con la hora local (toISOString daría el día anterior de madrugada). */
function fechaHoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function initialsOf(input: string | undefined): string {
  if (!input) return '?'
  const parts = input.trim().split(/\s+/)
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
  return letters.join('') || input[0]?.toUpperCase() || '?'
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  // Aviso cuando un guardado no llega a la base de datos (ver supabaseSync).
  const [errorSync, setErrorSync] = useState<string | null>(null)
  /* El mismo fallo, dicho en cristiano y con el siguiente paso. Ver
     `src/lib/errorDeBaseDeDatos.ts`: el texto de Postgres es exacto e inútil. */
  const [explicacion, setExplicacion] = useState<ErrorTraducido | null>(null)
  /*
   * EL MOTIVO, no solo la tabla.
   *
   * Esto costó tres rondas de idas y venidas. El aviso decía «no se ha podido
   * guardar (papeletas)» y se quedaba ahí; el mensaje de Postgres —que decía
   * exactamente qué columna faltaba o qué referencia no existía— se iba a la
   * consola, donde nadie mira. Sin él hay que adivinar, y adivinar sobre una
   * base de datos que no se puede abrir es perder el día.
   *
   * Va plegado: quien lleva la hermandad no tiene por qué leer esto, pero
   * puede abrirlo y copiarlo tal cual para mandarlo, que es lo que hace falta.
   */
  const [detalleSync, setDetalleSync] = useState<string>('')
  /** El último error de la base en toda la sesión, para adjuntarlo a un reporte. */
  const [ultimoErrorBd, setUltimoErrorBd] = useState<string | null>(null)
  const [reporteAbierto, setReporteAbierto] = useState(false)
  // Si esta cuenta tiene además ficha en el censo, se le ofrece su área.
  const [papeles, setPapeles] = useState<PapelesDeLaCuenta>({ esHermano: false, gestiona: true, seguro: false })
  useEffect(() => {
    void papelesDeLaCuenta().then(setPapeles)
  }, [])
  useEffect(() => {
    function alFallar(e: Event) {
      const detalle = (e as CustomEvent<{ tabla: string; fallos?: string[]; traducidos?: ErrorTraducido[] }>).detail
      setErrorSync(detalle?.tabla ?? '')
      // El primero traducido: si hay varios fallos suelen ser el mismo motivo
      // repetido por fila, y tres párrafos iguales no informan más que uno.
      setExplicacion(detalle?.traducidos?.[0] ?? null)
      const texto = (detalle?.fallos ?? []).join('\n')
      setDetalleSync(texto)
      // Se guarda aparte y NO se borra al dar a «Entendido»: cuando alguien se
      // decide a contar el fallo, el aviso ya lo cerró hace rato, y ese texto
      // es justo el dato que hace falta.
      if (texto) setUltimoErrorBd(`${detalle?.tabla ?? ''} · ${texto}`)
    }
    window.addEventListener('cabildo-sync-error', alFallar)
    return () => window.removeEventListener('cabildo-sync-error', alFallar)
  }, [])

  /*
   * LA COPIA DE SEGURIDAD DE LA SEMANA.
   *
   * Se lanza al entrar en el panel, y solo hace algo si la última tiene más de
   * una semana. No hay servidor que la programe —no hay `pg_cron` en el plan
   * gratuito de Supabase— así que la lanza quien entre, que en una hermandad es
   * alguien casi todas las semanas. Y si nadie entra en un mes, tampoco hay
   * datos nuevos que perder.
   *
   * En segundo plano y sin decir nada: quien acaba de entrar viene a hacer algo,
   * no a esperar. Si falla, no se le interrumpe — el aviso de «lleva un mes sin
   * copia» está en Configuración y salta solo.
   */
  useEffect(() => {
    void copiaSemanalSiTocaba()
  }, [])
  /*
   * LA CAMPAÑA DE PAPELETAS, DE LA BASE, AL ARRANCAR.
   *
   * `getCampana()` es síncrona y la leen quince pantallas —el cortejo, los
   * informes, los comunicados por tramo, el censo—. Traerla aquí una vez deja
   * la copia de este navegador al día para todas ellas antes de que ninguna se
   * pinte, en vez de que cada una tire de lo que hubiera guardado.
   */
  useEffect(() => {
    void cargarCampanaDeLaBase()
  }, [])
  const navigate = useNavigate()
  const location = useLocation()
  const { settings: ajustesHermandad, resuelto: ajustesResueltos } = useHermandadSettingsConEstado()
  const [mostrarAlta, setMostrarAlta] = useState(() => false)
  /*
   * Cuándo sale el asistente de «vamos a dejarlo listo».
   *
   * Se decide UNA vez, y no antes de saber la respuesta. Las dos partes
   * importan, y cada una arregla un fallo distinto:
   *
   *   · Una vez: si se recalculara en cada pintado, al guardar el primer dato
   *     del asistente dejaría de cumplirse la condición y el asistente se
   *     cerraría solo a mitad de rellenarlo.
   *
   *   · No antes de saber: antes se miraba lo que hubiera en ESTE navegador,
   *     al montar el panel. Y en un navegador nuevo —el ordenador de la casa
   *     de hermandad, el móvil, una ventana de incógnito— todavía no hay nada,
   *     porque la fila de la base tarda unas décimas en llegar. Así que al
   *     Hermano Mayor que ya había rellenado el CIF, la dirección y la cuenta
   *     se los volvía a pedir DESDE EL PRINCIPIO cada vez que entraba desde
   *     otro sitio, con sus datos guardados por debajo.
   */
  const yaSeDecidio = useRef(false)
  useEffect(() => {
    if (!ajustesResueltos || yaSeDecidio.current) return
    yaSeDecidio.current = true
    if (altaPendiente(ajustesHermandad)) setMostrarAlta(true)
  }, [ajustesResueltos, ajustesHermandad])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { suscripcion, activar, error: errorSuscripcion } = useSuscripcion()

  const hermandad = (user?.user_metadata?.hermandad as string | undefined) ?? 'Tu hermandad'
  const nombre = (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Hermano/a'
  /**
   * El cargo se resuelve contra la lista REAL de personal, no contra el
   * metadata de la sesión: ese valor lo puede reescribir el propio usuario
   * (`auth.updateUser({ data: { cargo: null } })`) y borrarlo abría el panel
   * entero. El metadata solo se usa para saber QUÉ cuenta de personal es.
   */
  const { cargo, resuelto: cargoResuelto } = useCargoDeLaSesionConEstado()
  // Trae los permisos reales de Supabase en cuanto cargan (no solo los que hubiera en este navegador).
  const permisosVersion = usePermisosSincronizados()

  const navFiltrado = useMemo(
    () =>
      NAV.map((group) => ({
        ...group,
        // Un enlace se ve si el cargo tiene permiso Y el pack contratado incluye
        // ese módulo (p. ej. la Web pública solo con un pack que traiga la web).
        items: group.items.filter(
          (item) =>
            (!item.modulo || puedeVerModulo(cargo, item.modulo)) &&
            moduloPermitidoPorPack(suscripcion, item.modulo),
        ),
      })).filter((group) => group.items.length > 0),
    // `permisosVersion` no se usa dentro a propósito: es un contador que sube
    // cuando llegan los permisos reales desde la base de datos, y está aquí
    // justamente para recalcular el menú en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cargo, permisosVersion, suscripcion],
  )

  /** Los destinos que ve este cargo, para la paleta de comandos (Ctrl+K). */
  const destinosPaleta = useMemo<DestinoPaleta[]>(
    () =>
      navFiltrado.flatMap((g) =>
        g.items.map((i) => ({ to: i.to, label: i.label, grupo: g.label ?? 'Ir a', icon: i.icon })),
      ),
    [navFiltrado],
  )

  const moduloActual = moduloIdDeRuta(location.pathname)

  useEffect(() => {
    // Con varias pestañas abiertas, todas ponían «Gobergo» y no se distinguían.
    // Se busca el enlace más largo que encaje: así «/app/hermanos/lo-que-sea»
    // sigue diciendo «Hermanos», y «/app» a secas cae en «Inicio».
    const enlace = NAV.flatMap((g) => g.items)
      .filter((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0]
    const nombre = enlace?.label ?? 'Inicio'
    document.title = `${nombre} · ${hermandad} · Gobergo`
  }, [location.pathname, hermandad])
  /**
   * Solo se bloquea CUANDO SE SABE que no puede.
   *
   * Sin `cargoResuelto`, la redirección a Inicio saltaba en el primer pintado
   * —cuando el cargo aún es «no lo sé»— así que pulsar cualquier sección
   * devolvía a Inicio. Todas, siempre, para todo el mundo.
   */
  const accesoBloqueado =
    cargoResuelto &&
    moduloActual !== null &&
    (!puedeVerModulo(cargo, moduloActual) || !moduloPermitidoPorPack(suscripcion, moduloActual))

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  // Muro de suscripción: sin suscripción activa, el panel queda bloqueado.
  if (!suscripcion.activa) {
    return (
      /* `avisoGuardado`: si la activación no llegó a la base, se dice. Si no,
         la hermandad se queda creyendo que está dada de alta y desde el
         ordenador de al lado le vuelve a salir este mismo muro. */
      <PantallaSuscripcion
        nombreHermandad={hermandad}
        onActivar={(pack, periodo) => { void activar(pack, periodo, fechaHoyLocal()) }}
        onSalir={handleSignOut}
        avisoGuardado={errorSuscripcion}
      />
    )
  }

  // El alta de la hermandad: sale una vez, al entrar por primera vez con la
  // hermandad recién creada y sin ninguno de los datos que hacen falta.
  if (mostrarAlta) {
    return (
      <AltaHermandad
        settings={ajustesHermandad}
        onTerminar={() => setMostrarAlta(false)}
      />
    )
  }

  return (
    <div className="app-shell">
      {/* Con teclado había que pasar por los quince enlaces del menú en cada
          página antes de llegar al contenido. */}
      <a className="saltar-al-contenido" href="#contenido">Saltar al contenido</a>
      <aside className={`app-side${drawerOpen ? ' app-side--open' : ''}`}>
        <div className="app-side__brand">
          {/* La barra lateral es granate oscura: la G va en marfil o se pierde. */}
          <LogoMark size={30} claro />
          <span>
            <b>{hermandad}</b>
            <small>Panel de gestión</small>
          </span>
        </div>

        <nav className="app-nav">
          {navFiltrado.map((group, gi) => (
            <div className="app-nav__group" key={group.label ?? gi}>
              {group.label && <p className="app-nav__label">{group.label}</p>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/app'}
                  className={({ isActive }) => `app-nav__link${isActive ? ' is-active' : ''}`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="app-nav__ic">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/*
          CON QUÉ CUENTA SE ESTÁ DENTRO, escrito y siempre.

          Aquí ponía el nombre y el cargo, y con eso no se puede saber en qué
          cuenta estás. El nombre sale de `user_metadata.nombre`, así que dos
          cuentas distintas de la misma persona —la del titular y la del
          tesorero, o la de pruebas y la de verdad— se ven EXACTAMENTE IGUAL:
          «Jaime Rivas · Titular de la hermandad» las dos.

          Y la sesión se queda guardada en el navegador, que es lo normal y lo
          que todo el mundo espera. Así que al abrir la aplicación te devuelve a
          la última cuenta con la que entraste, sea cual sea — y sin el correo
          delante, eso se lee como que la aplicación ha hecho algo raro.

          El correo es lo único que distingue una cuenta de otra, así que va
          escrito. No es un dato de más: es la respuesta a «¿quién soy aquí?».
        */}
        <div className="app-side__foot">
          <span className="app-avatar">{initialsOf(nombre)}</span>
          <span className="app-side__who">
            <b>{nombre}</b>
            <small>{cargoEnCristiano(cargo, user?.email)}</small>
            {/* Solo si no lo está diciendo ya la línea de arriba: a quien no se
                le reconoce el cargo, `cargoEnCristiano` ya devuelve el correo. */}
            {user?.email && cargoEnCristiano(cargo, user.email) !== user.email && (
              <small className="app-side__correo" title={user.email}>{user.email}</small>
            )}
          </span>
        </div>
      </aside>

      <PaletaComandos destinos={destinosPaleta} onCerrarSesion={handleSignOut} />

      {drawerOpen && <button className="app-scrim" aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)} />}

      <div className="app-main">
        <header className="app-topbar">
          <button
            className="app-menu-btn"
            aria-label="Abrir menú"
            onClick={() => setDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <Logo size={26} withText={false} />
          {/* Ir a cualquier módulo sin buscar el menú: el atajo se enseña aquí
              porque si no, nadie descubre que existe. */}
          <button
            type="button"
            className="app-buscar"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
            <span>Ir a…</span>
            <kbd>Ctrl</kbd><kbd>K</kbd>
          </button>
          <div className="app-topbar__right">
            {/* Quien además es hermano —el Hermano Mayor, la secretaria, el
                tesorero: casi todos— tiene que poder ver SU papeleta y SUS
                cuotas sin cerrar sesión ni tener una segunda cuenta. */}
            {/*
              Cada uno con SU ICONO, y el texto envuelto en `app-topbar__texto`.
              En el móvil el texto se esconde y queda el icono: a 390 px los
              cuatro botones no caben, y sin esto la barra empujaba la página
              entera 58 px a lo ancho —en todas las pantallas, no solo aquí—.
              El `title` y el `aria-label` se quedan, así que quien navega con
              lector de pantalla sigue oyendo lo que hace cada uno.
            */}
            {papeles.esHermano && (
              <Link
                to="/hermano"
                className="btn btn-ghost btn-sm"
                title="Tus cuotas, tu papeleta y tus datos"
                aria-label="Mi área de hermano"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
                </svg>
                <span className="app-topbar__texto">Mi área de hermano</span>
              </Link>
            )}
            {/* Contar un fallo, desde cualquier pantalla. Si hay que buscarlo
                en un menú, no se cuenta: se deja pasar y se pierde. */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setReporteAbierto(true)}
              title="Contar un fallo a quien mantiene Gobergo"
              aria-label="Contar un fallo"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M12 9v4" strokeLinecap="round" />
                <path d="M12 17h.01" strokeLinecap="round" />
                <path d="M10.3 3.9 2.6 17.3A1.6 1.6 0 0 0 4 19.7h16a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" strokeLinejoin="round" />
              </svg>
              <span className="app-topbar__texto">Contar un fallo</span>
            </button>
            <ThemeToggle />
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleSignOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
                <path d="M10 17 5 12l5-5M5 12h11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="app-topbar__texto">Cerrar sesión</span>
            </button>
          </div>
        </header>

        {errorSync !== null && (
          <div className="banner-inline banner-inline--warn app-sync-error" role="alert">
            <span>
              <b>No se ha podido guardar en la base de datos</b>
              {errorSync ? ` (${errorSync})` : ''}.{' '}
              {explicacion
                ? <>{explicacion.mensaje}<br />{explicacion.queHacer}</>
                : 'Lo que ves en pantalla puede no estar guardado: revisa tu conexión y vuelve a intentarlo.'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setErrorSync(null)}>
              Entendido
            </button>
            {detalleSync && (
              <details className="sync-error-detalle">
                <summary>Ver el motivo exacto</summary>
                <p>Si tienes que pedir ayuda, copia esto tal cual:</p>
                <pre>{detalleSync}</pre>
              </details>
            )}
          </div>
        )}

        <main className="app-content" id="contenido" tabIndex={-1}>
          {/* Sin acceso a este módulo por cargo: no se muestra "bloqueado", sino que
              se redirige a Inicio, de modo que la sección simplemente no aparece. */}
          {accesoBloqueado ? <Navigate to="/app" replace /> : <Outlet />}
        </main>

        {/* Una sola para toda la aplicación: la usan todas las pantallas que
            borran algo. Va fuera de <main> porque no es contenido de la
            página, es un aviso sobre lo que se acaba de hacer. */}
        <BarraDeshacer />

        <ReportarFallo
          abierto={reporteAbierto}
          onCerrar={() => setReporteAbierto(false)}
          contexto={{
            ruta: location.pathname,
            hermandad: ajustesHermandad.nombreLegal || undefined,
            cargo: cargoResuelto ? (cargo ?? null) : null,
            ultimoErrorBd,
            navegador: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            tamanoPantalla:
              typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : undefined,
          }}
        />
      </div>
    </div>
  )
}
