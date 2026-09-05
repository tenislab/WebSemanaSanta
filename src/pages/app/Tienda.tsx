/**
 * LA TIENDA DE LA HERMANDAD, EN UNA SOLA PANTALLA.
 *
 * Antes eran cinco entradas seguidas en el menú lateral —Tienda, Almacén y
 * artículos, Reservas de la web, Facturas de la tienda, Datos de la tienda— y
 * cinco pantallas que no se hablaban entre ellas. Cinco de las quince entradas
 * del menú entero para un módulo, con la misma cabecera repetida cinco veces y
 * ninguna forma de ver a la vez lo que hay que hacer hoy.
 *
 * Y sobre todo: eran cinco caras del mismo mostrador. Lo que se aparta por la
 * web sale del mismo estante que lo que se cobra a mano, y la factura de una
 * reserva entregada está en el mismo talonario. Enseñarlo como cinco sitios
 * distintos hacía que se leyera como cinco tiendas.
 *
 * ------------------------------------------------------------------------
 * CÓMO ESTÁ ARMADA
 * ------------------------------------------------------------------------
 *
 * · UNA CABECERA con las tres cifras que deciden si hay algo que hacer hoy, y
 *   las tres son botones: cada una lleva a la pestaña donde se arregla lo que
 *   dice. Enseñar un número en rojo y obligar a buscar dónde se toca es
 *   enseñarlo dos veces.
 *
 * · CINCO PESTAÑAS, cada una en su dirección de siempre. La pestaña sale de la
 *   dirección y no de un estado: así el enlace que alguien guardó en marcadores
 *   hace ocho meses sigue abriendo lo que abría, la flecha de atrás funciona, y
 *   «mira las reservas» sigue siendo pegar una dirección.
 *
 * · LOS PANELES NO SE DESMONTAN. Se montan la primera vez que se visitan y
 *   luego solo se ocultan. Cambiar de pestaña deja de relanzar consultas y no
 *   se pierden ni el buscador, ni los filtros, ni por dónde iba la lista.
 *
 * · UN SOLO `<Route path="tienda/*">`. Con cinco rutas distintas apuntando al
 *   mismo componente, React Router lo desmonta y lo vuelve a montar en cada
 *   cambio de pestaña, y se pierde todo lo del párrafo anterior. Con la ruta
 *   comodín el elemento no se mueve del árbol: solo cambia lo que dice
 *   `useLocation()`.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AvisoFalta from '../../components/AvisoFalta'
import { requisito } from '../../lib/requisitos'
import { formatCurrency } from '../../lib/format'
import { hoyIso } from '../../lib/hoy'
import { useAviso } from '../../lib/avisoEnPantalla'
import { useCajaDeHoy, useReservas } from '../../lib/tienda'
import { seLePasoElPlazo } from '../../data/tienda'
import { TiendaProvider, useTienda } from '../../context/TiendaContext'
import PanelVender from './tienda/PanelVender'
import PanelArticulos from './tienda/PanelArticulos'
import PanelReservas from './tienda/PanelReservas'
import PanelFacturas from './tienda/PanelFacturas'
import PanelDatos from './tienda/PanelDatos'

/*
 * LAS CINCO DIRECCIONES DE SIEMPRE. No se toca ninguna: están en el menú
 * lateral, en los enlaces del editor de la web y, sobre todo, en los marcadores
 * de quien las usa todos los días.
 */
const RUTAS = {
  vender: '/app/tienda',
  articulos: '/app/tienda/almacen',
  reservas: '/app/tienda/reservas',
  facturas: '/app/tienda/facturas',
  datos: '/app/tienda/datos',
} as const

export type Pestana = keyof typeof RUTAS

function pestanaDeRuta(pathname: string): Pestana {
  const limpia = pathname.replace(/\/+$/, '')
  const par = (Object.entries(RUTAS) as [Pestana, string][]).find(([, r]) => r === limpia)
  return par?.[0] ?? 'vender'
}

export default function Tienda() {
  return (
    <TiendaProvider>
      <Pantalla />
    </TiendaProvider>
  )
}

function Pantalla() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pestana = pestanaDeRuta(pathname)

  const { bajoMinimo, agotados } = useTienda()
  const caja = useCajaDeHoy()
  const { reservas, cargando: cargandoReservas, recargar: recargarReservas } = useReservas()

  const reqBase = requisito('supabase')
  const [hecho, avisar] = useAviso()

  /*
   * LAS PESTAÑAS VISITADAS. Se guarda cuáles se han abierto para montarlas solo
   * entonces: quien entra a cobrar no tiene por qué esperar a que se traigan
   * las facturas de cinco años y los datos del ejercicio.
   *
   * Una vez montada, se queda. Es lo contrario de lo que hace React Router con
   * rutas hermanas, y es justo lo que se busca aquí.
   */
  const [vistas, setVistas] = useState<Set<Pestana>>(() => new Set([pestana]))
  function irA(p: Pestana) {
    setVistas((v) => (v.has(p) ? v : new Set(v).add(p)))
    // Sin `replace`: la flecha de atrás del navegador tiene que volver a la
    // pestaña anterior, que es lo que espera cualquiera.
    navigate(RUTAS[p])
  }
  // Y también cuando se llega por una dirección pegada a pelo, sin pulsar nada.
  if (!vistas.has(pestana)) setVistas((v) => new Set(v).add(pestana))

  const hoy = hoyIso()
  const reservasResumen = useMemo(() => {
    const pendientes = reservas.filter((r) => r.estado === 'pendiente')
    return {
      pendientes: pendientes.length,
      comprometido: pendientes.reduce((n, r) => n + r.total, 0),
      vencidas: reservas.filter((r) => seLePasoElPlazo(r, hoy)).length,
    }
  }, [reservas, hoy])

  const PESTANAS: { id: Pestana; texto: string; cuenta: number | null }[] = [
    { id: 'vender', texto: 'Vender', cuenta: null },
    { id: 'articulos', texto: 'Artículos', cuenta: bajoMinimo || null },
    { id: 'reservas', texto: 'Reservas', cuenta: reservasResumen.pendientes || null },
    { id: 'facturas', texto: 'Ventas y facturas', cuenta: null },
    { id: 'datos', texto: 'Cómo va', cuenta: null },
  ]

  /*
   * Las acciones de la cabecera son las de la pestaña que se está mirando, y
   * las pone el propio panel: `Tienda.tsx` no sabe qué es un artículo ni qué es
   * un ejercicio. Cada panel escribe aquí lo suyo al montarse.
   */
  const [acciones, setAcciones] = useState<Partial<Record<Pestana, ReactNode>>>({})
  const ponerAcciones = useMemo(
    () => (p: Pestana, nodo: ReactNode) => setAcciones((a) => ({ ...a, [p]: nodo })),
    [],
  )

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Tienda</p>
          <h1>Tienda de la hermandad</h1>
          <p className="dash-head__lead">
            Cobra en el mostrador, lleva el almacén y entrega lo que se aparta por la web.
            Todo sale del mismo género y se apunta en el mismo libro.
          </p>
        </div>
        <div className="dash-head__actions">{acciones[pestana]}</div>
      </div>

      {!reqBase.listo && <AvisoFalta requisito={reqBase} />}
      {hecho && <div className="banner-inline banner-inline--ok" role="status">{hecho}</div>}

      {/* ------------------------------------------------------------------
          LAS TRES CIFRAS QUE DICEN SI HAY ALGO QUE HACER HOY.

          Son botones y no rótulos: cada una lleva a donde se arregla lo que
          dice. Y son tres y no seis — de un vistazo se leen tres números; con
          seis ya hay que buscar cuál era el importante.
          ------------------------------------------------------------------ */}
      <section className="stat-grid stat-grid--vitales" aria-label="Cómo va la tienda hoy">
        <button type="button" className="stat-tile stat-tile--accion" onClick={() => irA('facturas')}>
          <span className="stat-tile__label">Caja de hoy</span>
          <span className="stat-tile__value">{formatCurrency(caja.total)}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">
            {caja.ventas === 0
              ? 'Todavía no se ha cobrado nada'
              : `${caja.ventas} ${caja.ventas === 1 ? 'factura' : 'facturas'} · verlas`}
          </span>
        </button>

        <button type="button" className="stat-tile stat-tile--accion" onClick={() => irA('reservas')}>
          <span className="stat-tile__label">Sin recoger</span>
          <span className="stat-tile__value">{reservasResumen.pendientes}</span>
          <span className={`stat-tile__trend stat-tile__trend--${reservasResumen.vencidas > 0 ? 'warn' : 'neutral'}`}>
            {cargandoReservas
              ? 'Mirando lo apartado…'
              : reservasResumen.vencidas > 0
                ? `${reservasResumen.vencidas} fuera de plazo · soltarlas`
                : reservasResumen.pendientes === 0
                  ? 'Nadie tiene nada apartado'
                  : `${formatCurrency(reservasResumen.comprometido)} comprometidos`}
          </span>
        </button>

        <button type="button" className="stat-tile stat-tile--accion" onClick={() => irA('articulos')}>
          <span className="stat-tile__label">Bajo mínimo</span>
          <span className="stat-tile__value">{bajoMinimo}</span>
          <span className={`stat-tile__trend stat-tile__trend--${bajoMinimo > 0 ? 'warn' : 'ok'}`}>
            {bajoMinimo === 0
              ? 'No hay nada por reponer'
              : agotados > 0
                ? `${agotados} ${agotados === 1 ? 'agotado' : 'agotados'} · reponer`
                : 'Por debajo del mínimo · reponer'}
          </span>
        </button>
      </section>

      {/* Las pestañas van separadas de los filtros de cada panel con una línea:
          no son un filtro más, cambian lo que se está mirando. */}
      <div className="filters filters--vista filters--tienda" role="tablist" aria-label="Qué parte de la tienda">
        {PESTANAS.map(({ id, texto, cuenta }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-controls={`panel-${id}`}
            aria-selected={pestana === id}
            className={`chip${pestana === id ? ' chip--active' : ''}`}
            onClick={() => irA(id)}
          >
            {texto}
            {cuenta !== null && <small>{cuenta}</small>}
          </button>
        ))}
      </div>

      <Panel id="vender" activa={pestana} vistas={vistas}>
        <PanelVender avisar={avisar} acciones={ponerAcciones} alCobrar={caja.recargar} />
      </Panel>
      <Panel id="articulos" activa={pestana} vistas={vistas}>
        <PanelArticulos avisar={avisar} acciones={ponerAcciones} />
      </Panel>
      <Panel id="reservas" activa={pestana} vistas={vistas}>
        <PanelReservas
          avisar={avisar}
          reservas={reservas}
          cargando={cargandoReservas}
          recargar={() => { recargarReservas(); caja.recargar() }}
        />
      </Panel>
      <Panel id="facturas" activa={pestana} vistas={vistas}>
        <PanelFacturas avisar={avisar} />
      </Panel>
      <Panel id="datos" activa={pestana} vistas={vistas}>
        <PanelDatos acciones={ponerAcciones} />
      </Panel>
    </div>
  )
}

/**
 * Un panel montado pero escondido.
 *
 * `hidden` y no `display: none` a mano, y sin estilo propio en el contenedor:
 * `hidden` implica `display: none`, y eso es lo que hace que `window.print()`
 * —que usan la factura y el ticket— no imprima a la vez lo que hay en las otras
 * pestañas. Ponerle `display` a este div rompería justo eso.
 */
function Panel({ id, activa, vistas, children }: {
  id: Pestana
  activa: Pestana
  vistas: Set<Pestana>
  children: ReactNode
}) {
  if (!vistas.has(id)) return null
  return (
    <div id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} hidden={activa !== id}>
      {children}
    </div>
  )
}
