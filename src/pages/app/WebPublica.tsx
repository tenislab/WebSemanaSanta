/**
 * EL EDITOR DE LA WEB PÚBLICA. Solo el marco: la pantalla, su estado y el
 * reparto entre pestañas.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ ESTÁ PARTIDO EN `web/`
 * ----------------------------------------------------------------------------
 *
 * Este fichero tenía 4.770 líneas: el más grande del proyecto con mucha
 * diferencia —el segundo eran 2.900—. Y era justo donde toca seguir trabajando,
 * porque el editor de SEO va en la pestaña de Compartir, así que partirlo antes
 * sale más barato que partirlo después. Lo pedía la F22 del plan con esas
 * palabras.
 *
 * EL REPARTO NO ES POR TAMAÑO: ES POR PESTAÑA. Cada una de las veintitrés que
 * ve la hermandad (Diseño, Portada, Galería, Cultos…) es un fichero de
 * `src/pages/app/web/` con el nombre de su componente, así que lo que hay que
 * tocar se encuentra por el nombre de la pestaña que enseña el fallo — que es
 * lo único que se sabe cuando llega uno.
 *
 * Lo que se comparte está en tres sitios y solo tres:
 *
 *   · `web/comun.ts`     — los ayudantes (leer una imagen, hacer la miniatura,
 *                          duplicar un elemento de una lista) y los tres tipos
 *                          de función con que una pestaña edita la web.
 *   · `web/pestanas.tsx` — el catálogo: cuáles hay, cómo se agrupan en el menú,
 *                          a qué sección de la vista previa salta cada una.
 *   · `web/avisos.ts`    — las doce comprobaciones de «qué le falta a tu web».
 *
 * Aquí NO queda ninguna pestaña, y es a propósito: en cuanto vuelva a este
 * fichero algo que es de una pestaña concreta, el reparto se deshace solo.
 *
 * ----------------------------------------------------------------------------
 * LO QUE HAY QUE SABER SI SE TOCA
 * ----------------------------------------------------------------------------
 *
 * Doce ficheros de prueba vigilan esta pantalla LEYENDO SU FUENTE, y NO leen
 * este fichero: piden la pantalla entera con `fuenteDelEditorWeb()` (ver
 * `pruebas/fuentes.mjs`), que pega esto con todo lo de `web/`. Sin eso, un
 * trozo que se mueve de sitio deja a un guardia mirando donde ya no hay nada
 * —y los que comprueban que algo NO está se quedarían EN VERDE sin vigilar
 * nada, que es la peor de las dos formas de perder una prueba—.
 */
import { hayAlmacen, mudarImagenes, sustituirImagenes } from '../../lib/almacenImagenes'
import { cultosDelCalendario } from '../../lib/cultosDelCalendario'
import { asegurarFuentesDeLaWeb } from '../../lib/fuentesDeLaWeb'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { aSlug, contenidoVacio, getWebPublica, useWebPublica, type WebPublica } from '../../lib/webPublica'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ActualidadTab } from './web/ActualidadTab'
import { AvisosTab } from './web/AvisosTab'
import { BoletinesTab } from './web/BoletinesTab'
import { BuzonWebTab } from './web/BuzonWebTab'
import { CaridadTab } from './web/CaridadTab'
import { CartelTab } from './web/CartelTab'
import { CompartirTab } from './web/CompartirTab'
import { ContactoTab } from './web/ContactoTab'
import { CultosTab } from './web/CultosTab'
import { DisenoTab } from './web/DisenoTab'
import { GaleriaTab } from './web/GaleriaTab'
import { MarcoTab } from './web/MarcoTab'
import { PaginasTab } from './web/PaginasTab'
import { AvisosWeb } from './web/PanelDeAvisos'
import { PortadaTab } from './web/PortadaTab'
import { DonativosTab, LoteriaTab, TiendaTab } from './web/TabsDeDinero'
import { EstacionTab, HazteTab, HistoriaTab, JuntaTab } from './web/TabsDeLaHermandad'
import { TitularesTab } from './web/TitularesTab'
import { VisitasTab } from './web/VisitasTab'
import { VistaPrevia } from './web/VistaPrevia'
import { avisosDeLaWeb } from './web/avisos'
import { sinAcentos } from './web/comun'
import {
  GRUPOS_PESTANAS,
  NOMBRE_CAMPO,
  PALABRAS_PESTANA,
  SECCION_DE_PESTANA,
  esPestana,
  type Dispositivo,
  type Pestana,
} from './web/pestanas'

export default function WebPublica() {
  // Las doce letras del catálogo, solo aquí: ver lib/fuentesDeLaWeb.ts.
  useEffect(() => { asegurarFuentesDeLaWeb() }, [])
  const [web, setWeb] = useWebPublica()
  const hermandad = useHermandadSettings()
  /*
   * A ESTA PANTALLA SE PUEDE LLEGAR APUNTANDO A UNA PESTAÑA.
   *
   * «Leerlo», en Notificaciones, abría `/app/web` a secas, y como la pestaña
   * se recuerda en la sesión, caías en Diseño o en Portada: parecía que el
   * botón te sacaba a la web pública en vez de enseñarte el mensaje. Con
   * `?ir=buzon` se dice a dónde, y manda sobre lo recordado.
   */
  const [params, setParams] = useSearchParams()
  const pedida = params.get('ir')
  /*
   * El mensaje que se pidió abrir se guarda AL ENTRAR, porque los parámetros
   * se limpian de la barra de direcciones en cuanto se usan y el buzón tarda
   * un pintado en tener la lista cargada: si se leyera de la URL en ese
   * momento, ya no habría nada que leer.
   */
  const [mensajePedido] = useState(() => params.get('mensaje'))
  const [pestana, setPestanaState] = useState<Pestana>(
    () => (esPestana(pedida) ? pedida : ((sessionStorage.getItem('cabildo-web-pestana') as Pestana | null) ?? 'diseno')),
  )
  /*
   * Y se quita de la barra de direcciones en cuanto se ha usado: si se queda,
   * cambias de pestaña, recargas y te devuelve al buzón sin venir a cuento.
   */
  useEffect(() => {
    if (!pedida) return
    if (esPestana(pedida)) setPestana(pedida)
    const limpio = new URLSearchParams(params)
    limpio.delete('ir')
    limpio.delete('mensaje')
    setParams(limpio, { replace: true })
    // Solo cuando cambia lo pedido: si se mete `params` entero, se repite sola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida])
  /** Se recuerda durante la sesión: se entra y se sale del módulo muchas veces. */
  function setPestana(p: Pestana) {
    setPestanaState(p)
    try { sessionStorage.setItem('cabildo-web-pestana', p) } catch { /* sin sessionStorage */ }
  }
  const [copiado, setCopiado] = useState(false)
  const [noSePudoCopiar, setNoSePudoCopiar] = useState(false)
  const [paginaSel, setPaginaSel] = useState<string | null>(null)
  // Dentro de «Cabecera y pie» hay dos sitios muy separados de la web: la vista
  // previa sigue al que se esté tocando.
  const [focoMarco, setFocoMarco] = useState<'cabecera' | 'pie'>('cabecera')
  const [dispositivo, setDispositivo] = useState<Dispositivo>('movil')
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null)
  const [mostrarGuardado, setMostrarGuardado] = useState(false)
  const [mudadas, setMudadas] = useState(0)

  /*
   * LA MUDANZA DE LAS FOTOS, una vez y sin preguntar.
   *
   * Las webs escritas antes del almacén llevan las fotos dentro del propio
   * contenido, y así no las lee WhatsApp ni las guarda el navegador en caché
   * (ver `lib/almacenImagenes.ts`). Al abrir el editor se suben y se cambia
   * cada foto por su dirección.
   *
   * Se hace SOLO al montar y no en cada guardado: guardar pasa en cada tecla
   * que se escribe. Y no hace falta repetirlo, porque la segunda vez ya no
   * queda ninguna dentro — el recorrido se da cuenta solo y no sube nada.
   *
   * Si falla, no se toca nada: la web se queda como estaba, con las fotos
   * dentro, funcionando igual que ayer.
   */
  useEffect(() => {
    if (!hayAlmacen()) return
    let vivo = true
    void (async () => {
      const { subidas, mapa } = await mudarImagenes(getWebPublica())
      if (!vivo || subidas === 0) return
      /*
       * SOBRE LO QUE HAY AHORA, no sobre la copia con la que empezó.
       *
       * Subir veinte fotos tarda segundos, y en esos segundos la hermandad
       * está escribiendo. Guardando el resultado de la mudanza tal cual se
       * guardaría una fotocopia de la web de hace cinco segundos: lo escrito
       * mientras tanto desaparecía delante de sus ojos, sin aviso.
       */
      setWeb((actual) => sustituirImagenes(actual, mapa))
      setMudadas(subidas)
    })()
    return () => { vivo = false }
  }, [setWeb])
  useEffect(() => {
    if (guardadoEn === null) return
    setMostrarGuardado(true)
    const t = setTimeout(() => setMostrarGuardado(false), 1800)
    return () => clearTimeout(t)
  }, [guardadoEn])

  // Los datos de la hermandad llegan de Supabase DESPUÉS de montar: con las
  // dependencias vacías, la web se quedaba sin nombre y con los colores de
  // fábrica la primera vez que se abría en un navegador limpio.
  useEffect(() => {
    setWeb((actual) => {
      const parche: Partial<WebPublica> = {}
      if (!actual.titulo && hermandad.nombreLegal) parche.titulo = hermandad.nombreLegal
      if (actual.colorPrimario === '#6A1A23' && hermandad.colorPrimario) parche.colorPrimario = hermandad.colorPrimario
      if (actual.colorSecundario === '#C5A059' && hermandad.colorSecundario) parche.colorSecundario = hermandad.colorSecundario
      if (!actual.slug && hermandad.nombreLegal) parche.slug = aSlug(hermandad.nombreLegal)
      // Devolver el mismo objeto si no hay nada que cambiar evita un guardado
      // (y un re-render) en cada carga.
      return Object.keys(parche).length ? { ...actual, ...parche } : actual
    })
    // Las dependencias son los CAMPOS, no el objeto: `useHermandadSettings`
    // devuelve un objeto nuevo en cada render y con él el efecto se disparaba
    // sin parar («Maximum update depth exceeded»).
  }, [hermandad.nombreLegal, hermandad.colorPrimario, hermandad.colorSecundario, setWeb])

  // Ctrl/⌘+Z y Ctrl/⌘+Mayús+Z, como en cualquier editor.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      // Dentro de un campo de texto, el navegador ya deshace lo escrito: no se
      // le quita el atajo, o se perdería el deshacer normal de la caja.
      const dentro = document.activeElement
      const enCampo = dentro instanceof HTMLInputElement || dentro instanceof HTMLTextAreaElement
      if (enCampo) return
      e.preventDefault()
      if (e.shiftKey) rehacer()
      else deshacer()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const enlace = `${window.location.origin}/w/${web.slug}`
  const avisos = avisosDeLaWeb(web)
  /**
   * Secciones que todavía no tienen nada. Se marcan con un punto en el raíl:
   * enseña lo que queda por hacer sin echar la bronca por escrito.
   */
  const vacias = useMemo(() => {
    const s = new Set<Pestana>()
    if (web.heroFotos.length === 0) s.add('portada')
    if (!web.albumes.some((a) => a.fotos.length > 0)) s.add('galeria')
    if (web.noticias.length === 0) s.add('actualidad')
    if (web.cultos.length === 0) s.add('cultos')
    // Un cartel sin imagen no cuenta: la ficha sola no se publica.
    if (!web.carteles.some((c) => c.imagenDataUrl)) s.add('cartel')
    if (!web.caridad.entradilla.trim() && web.caridad.cifras.length === 0) s.add('caridad')
    if (web.paginas.length === 0) s.add('paginas')
    if (web.titulares.length === 0) s.add('titulares')
    if (!web.estacion.dia.trim() && web.estacion.itinerario.length === 0) s.add('estacion')
    if (web.junta.length === 0) s.add('junta')
    if (contenidoVacio(web.historia)) s.add('historia')
    if (web.boletines.length === 0) s.add('boletines')
    if (!web.donativos.bizum.trim() && !web.donativos.iban.trim() && !web.donativos.enlacePasarela.trim()) s.add('donativos')
    if (!web.loteria.numero.trim()) s.add('loteria')
    if (!web.direccion && !web.telefono) s.add('contacto')
    if (!web.seo.descripcion.trim()) s.add('compartir')
    if (!web.pie.textoLegal.trim()) s.add('marco')
    return s
  }, [web])
  // Los próximos cultos del módulo de Eventos, para verlos ya en la vista previa.
  const cultosCalendario = useMemo(() => cultosDelCalendario(), [])

  /**
   * Cambio calculado sobre el estado MÁS RECIENTE. Hace falta para lo que llega
   * tarde: al subir treinta fotos, cada una se guarda cuando termina de
   * comprimirse, y con la lista del render se perdían casi todas.
   */
  function actualizar(cambio: (actual: WebPublica) => WebPublica) {
    setWeb(cambio)
  }

  /**
   * Historial para deshacer. Se guarda el estado ANTERIOR a cada cambio; los
   * cambios seguidos en el mismo campo (escribir en un input) se agrupan, o
   * cada tecla sería un paso atrás.
   */
  const historial = useRef<{ pila: WebPublica[]; rehacer: WebPublica[]; ultimoCampo: string; ultimoMs: number }>({
    pila: [], rehacer: [], ultimoCampo: '', ultimoMs: 0,
  })
  const [pasos, setPasos] = useState({ atras: 0, adelante: 0 })
  /** Qué se deshace: «Deshacer» a secas no dice si vas a perder el color o el texto. */
  const [ultimoCambio, setUltimoCambio] = useState('')

  function apuntar(campo: string, anterior: WebPublica) {
    const h = historial.current
    const ahora = performance.now()
    const seguido = campo === h.ultimoCampo && ahora - h.ultimoMs < 900
    setUltimoCambio(NOMBRE_CAMPO[campo] ?? campo)
    if (!seguido) {
      h.pila = [...h.pila.slice(-49), anterior]
      h.rehacer = []
    }
    h.ultimoCampo = campo
    h.ultimoMs = ahora
    setPasos({ atras: h.pila.length, adelante: h.rehacer.length })
  }

  function deshacer() {
    const h = historial.current
    const previo = h.pila.pop()
    if (!previo) return
    h.rehacer = [...h.rehacer, web]
    h.ultimoCampo = ''
    setWeb(previo)
    setPasos({ atras: h.pila.length, adelante: h.rehacer.length })
  }

  function rehacer() {
    const h = historial.current
    const siguiente = h.rehacer.pop()
    if (!siguiente) return
    h.pila = [...h.pila, web]
    h.ultimoCampo = ''
    setWeb(siguiente)
    setPasos({ atras: h.pila.length, adelante: h.rehacer.length })
  }

  function editar<K extends keyof WebPublica>(
    campo: K,
    valor: WebPublica[K] | ((actual: WebPublica[K]) => WebPublica[K]),
  ) {
    // El historial se apunta FUERA del updater: dentro, React puede ejecutar
    // el updater dos veces (o descartarlo) y el historial salía duplicado o
    // directamente vacío.
    apuntar(String(campo), web)
    // Señal de «se ha guardado»: el editor guarda solo y sin esto la gente
    // buscaba un botón de guardar que no existe.
    setGuardadoEn(Date.now())
    setWeb((actual) => ({
      ...actual,
      [campo]: typeof valor === 'function' ? (valor as (v: WebPublica[K]) => WebPublica[K])(actual[campo]) : valor,
    }))
  }

  /**
   * Varios campos de una vez con UNA sola entrada en el historial: aplicar un
   * estilo toca siete campos y con `editar` siete veces hacían falta siete
   * «deshacer» para volver atrás.
   */
  function editarLote(etiqueta: string, cambios: Partial<WebPublica>) {
    apuntar(etiqueta, web)
    setGuardadoEn(Date.now())
    setWeb((actual) => ({ ...actual, ...cambios }))
  }

  const [busca, setBusca] = useState('')
  /** El raíl filtrado por lo que se busque: por el nombre o por sus palabras. */
  const gruposFiltrados = useMemo(() => {
    const q = sinAcentos(busca)
    if (!q) return GRUPOS_PESTANAS
    return GRUPOS_PESTANAS
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) => sinAcentos(it.label).includes(q) || sinAcentos(PALABRAS_PESTANA[it.id] ?? '').includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [busca])

  async function copiarEnlace() {
    // Si el navegador no deja copiar, se enseña el enlace para copiarlo a
    // mano. Antes el botón simplemente no hacía nada y la persona se iba al
    // grupo de WhatsApp a pegar lo que tuviera antes en el portapapeles.
    if (await copiarAlPortapapeles(enlace)) {
      setCopiado(true)
      setNoSePudoCopiar(false)
      setTimeout(() => setCopiado(false), 2000)
    } else {
      setNoSePudoCopiar(true)
    }
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Web pública</p>
          <h1>Tu web</h1>
          <p className="dash-head__lead">Elige un estilo, escribe el contenido y publica. A la derecha la ves cambiar en directo.</p>
        </div>
        <div className="dash-head__actions">
          <span className={`cms-guardado${mostrarGuardado || mudadas > 0 ? ' cms-guardado--visible' : ''}`} role="status">
            {mudadas > 0
              ? `✓ ${mudadas} ${mudadas === 1 ? 'foto guardada' : 'fotos guardadas'} en el almacén`
              : '✓ Guardado'}
          </span>
          {/* Los dos iguales: antes uno llevaba texto y el otro solo la flecha,
              y parecían dos controles distintos. */}
          <div className="cms-deshacer" role="group" aria-label="Deshacer y rehacer">
            <button
              type="button"
              className="icon-btn"
              onClick={deshacer}
              disabled={pasos.atras === 0}
              title={`Deshacer${ultimoCambio ? ` «${ultimoCambio}»` : ''}${pasos.atras ? ` (${pasos.atras})` : ''} · Ctrl+Z`}
              aria-label="Deshacer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10H9" /></svg>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={rehacer}
              disabled={pasos.adelante === 0}
              title={`Rehacer${pasos.adelante ? ` (${pasos.adelante})` : ''} · Ctrl+Mayús+Z`}
              aria-label="Rehacer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h6" /></svg>
            </button>
          </div>
          <button type="button" className="btn btn-outline" onClick={copiarEnlace}>
            {copiado ? '✓ Enlace copiado' : 'Copiar enlace'}
          </button>
          {noSePudoCopiar && (
            <label className="cms-copiar-a-mano">
              <span>Tu navegador no deja copiar solo. Cópialo de aquí:</span>
              <input
                type="text"
                readOnly
                value={enlace}
                aria-label="Enlace de tu web, para copiar a mano"
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          )}
          <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Ver mi web</a>
        </div>
      </div>

      <AvisosWeb avisos={avisos} irA={setPestana} />

      <div className="cms-layout">
        {/* Raíl de secciones. En pantalla estrecha se vuelve una fila que se
            desplaza a lo ancho, sin partirse en dos líneas. */}
        <nav className="cms-rail" aria-label="Secciones de la web">
          <div className="cms-rail__buscar">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar sección…"
              aria-label="Buscar una sección del editor"
              onKeyDown={(e) => {
                // Enter abre la primera que salga: buscar y tener que apuntar
                // con el ratón es media búsqueda.
                if (e.key !== 'Enter') return
                const primera = gruposFiltrados[0]?.items[0]
                if (primera) { setPestana(primera.id); setBusca('') }
              }}
            />
          </div>
          {gruposFiltrados.length === 0 && <p className="cms-rail__vacio">Nada con «{busca}».</p>}
          {gruposFiltrados.map((g) => (
            <div className="cms-rail__grupo" key={g.titulo}>
              <p className="cms-rail__titulo">{g.titulo}</p>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`cms-rail__item${pestana === it.id ? ' cms-rail__item--on' : ''}`}
                  onClick={() => setPestana(it.id)}
                  aria-current={pestana === it.id ? 'true' : undefined}
                >
                  <span className="cms-rail__ic" aria-hidden="true">{it.icono}</span>
                  <span className="cms-rail__label">{it.label}</span>
                  {vacias.has(it.id) && <span className="cms-rail__punto" title="Todavía sin contenido" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="cms-editor">
          {pestana === 'diseno' && (
            <DisenoTab web={web} editar={editar} editarLote={editarLote} copiado={copiado} copiarEnlace={copiarEnlace} />
          )}
          {pestana === 'marco' && <MarcoTab web={web} editar={editar} onFoco={setFocoMarco} />}
          {pestana === 'historia' && <HistoriaTab web={web} editar={editar} />}
          {pestana === 'hazte' && <HazteTab web={web} editar={editar} />}
          {pestana === 'estacion' && <EstacionTab web={web} editar={editar} />}
          {pestana === 'junta' && <JuntaTab web={web} editar={editar} />}
          {pestana === 'titulares' && <TitularesTab web={web} editar={editar} hermandad={hermandad} />}
          {pestana === 'portada' && <PortadaTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'galeria' && <GaleriaTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'actualidad' && <ActualidadTab web={web} editar={editar} />}
          {pestana === 'cultos' && <CultosTab web={web} editar={editar} delCalendario={cultosCalendario} />}
          {pestana === 'cartel' && <CartelTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'caridad' && <CaridadTab web={web} editar={editar} />}
          {pestana === 'paginas' && <PaginasTab web={web} editar={editar} paginaSel={paginaSel} setPaginaSel={setPaginaSel} />}
          {pestana === 'boletines' && <BoletinesTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'donativos' && <DonativosTab web={web} hermandad={hermandad} editar={editar} />}
          {pestana === 'loteria' && <LoteriaTab web={web} editar={editar} />}
          {pestana === 'tienda' && <TiendaTab />}
          {pestana === 'buzon' && <BuzonWebTab abrirId={mensajePedido} />}
          {pestana === 'visitas' && <VisitasTab />}
          {pestana === 'avisos' && <AvisosTab web={web} editar={editar} />}
          {pestana === 'contacto' && <ContactoTab web={web} hermandad={hermandad} editar={editar} />}
          {pestana === 'compartir' && <CompartirTab web={web} hermandad={hermandad} editar={editar} enlace={enlace} />}
        </div>

        <VistaPrevia
          web={web}
          hermandad={hermandad}
          cultosDelCalendario={cultosCalendario}
          seccionActiva={pestana === 'marco' ? focoMarco : SECCION_DE_PESTANA[pestana]}
          dispositivo={dispositivo}
          setDispositivo={setDispositivo}
          enlace={enlace}
        />
      </div>
    </div>
  )
}

/* ----------------------------- Vista previa ----------------------------- */
/**
 * La web tal cual se ve, en el tamaño que se elija. Para tableta y escritorio
 * el sitio se pinta a su ancho de verdad y se ESCALA para que quepa en la
 * columna: si no, se vería el diseño de móvil siempre y no habría forma de
 * comprobar cómo queda en un ordenador.
 */
