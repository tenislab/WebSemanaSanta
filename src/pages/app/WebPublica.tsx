import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  PLANTILLAS,
  SECCIONES_INFO,
  TIPOGRAFIAS,
  aSlug,
  contenidoVacio,
  esDeGoogleMaps,
  nombreSeccion,
  urlMapaIncrustado,
  urlSegura,
  useWebPublica,
  type AlturaHero,
  type Boletin,
  type ColumnaPie,
  type CultoWeb,
  type EnlacePie,
  type FotoGaleria,
  type Noticia,
  type PaginaWeb,
  type PlantillaWeb,
  type RedWeb,
  type TemaWeb,
  type TipoRed,
  type TipografiaWeb,
  type Titular,
  type WebPublica,
} from '../../lib/webPublica'
import type { HermandadSettings } from '../../lib/hermandadSettings'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { useSuscripcion, tieneCapacidad } from '../../lib/suscripcion'
import { nuevoId } from '../../lib/supabaseSync'
import SitioContenido, { type FocoPreview } from '../../components/SitioContenido'
import { EditorParrafos, EditorFotos } from '../../components/EditorContenido'

function comprimirImagen(dataUrl: string, maxLado = 1600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
      if (escala >= 1) return resolve(dataUrl)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function leerImagen(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) {
  const file = e.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const lector = new FileReader()
  lector.onload = async () => cb(await comprimirImagen(String(lector.result)))
  lector.readAsDataURL(file)
  e.target.value = ''
}

/** Fecha de hoy en ISO pero en hora LOCAL: con toISOString, de madrugada en
 *  España la noticia salía fechada el día anterior (UTC). */
function fechaHoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const REDES: TipoRed[] = ['Instagram', 'Facebook', 'X', 'YouTube', 'TikTok', 'Web']
const ALTURAS: { id: AlturaHero; label: string }[] = [
  { id: 'compacta', label: 'Compacta' },
  { id: 'media', label: 'Media' },
  { id: 'completa', label: 'Pantalla completa' },
]

type Pestana = 'diseno' | 'marco' | 'contacto' | 'portada' | 'actualidad' | 'cultos' | 'paginas' | 'boletines'

/**
 * A qué sección de la web corresponde cada pestaña del editor: la vista previa
 * salta a ella y la resalta, para no perder de vista qué se está tocando.
 */
const SECCION_DE_PESTANA: Partial<Record<Pestana, FocoPreview>> = {
  actualidad: 'actualidad',
  cultos: 'cultos',
  paginas: 'paginas',
  boletines: 'boletines',
  contacto: 'contacto',
}
/**
 * El orden importa: primero lo que da forma a TODA la web (diseño, cabecera y
 * pie, contacto) y después el contenido. «Contacto» estaba la última y casi
 * nadie llegaba a ella: la dirección y las redes se quedaban sin poner.
 */
const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'diseno', label: 'Diseño y secciones' },
  { id: 'marco', label: 'Cabecera y pie' },
  { id: 'contacto', label: 'Contacto y mapa' },
  { id: 'portada', label: 'Fotos de portada' },
  { id: 'actualidad', label: 'Actualidad' },
  { id: 'cultos', label: 'Cultos' },
  { id: 'paginas', label: 'Páginas y textos' },
  { id: 'boletines', label: 'Boletines' },
]

interface AvisoWeb {
  id: string
  texto: string
  /** A dónde lleva el botón «Arreglar». */
  pestana: Pestana
  /** Los graves salen marcados: la web se ve mal o coja sin esto. */
  grave?: boolean
}

/**
 * Lo que le falta a la web para estar presentable. Se enseña arriba del todo
 * porque el problema real no era no saber configurarlo, sino no enterarse de
 * que faltaba: se publicaban webs sin dirección, sin portada y sin un solo
 * culto.
 */
function avisosDeLaWeb(web: WebPublica, hermandad: HermandadSettings): AvisoWeb[] {
  const avisos: AvisoWeb[] = []
  const dir = web.direccion || hermandad.direccion
  const tel = web.telefono || hermandad.telefono
  const email = web.email || hermandad.email

  if (!dir) avisos.push({ id: 'dir', texto: 'Tu web no dice dónde estáis: falta la dirección de la sede.', pestana: 'contacto', grave: true })
  if (!tel && !email) avisos.push({ id: 'contacto', texto: 'No hay forma de contactar: pon al menos un teléfono o un correo.', pestana: 'contacto', grave: true })
  if (web.heroFotos.length === 0) avisos.push({ id: 'portada', texto: 'La portada no tiene ninguna foto (se ve un degradado de color).', pestana: 'portada' })
  if (contenidoVacio(web.historia)) avisos.push({ id: 'historia', texto: 'La sección «Historia» está vacía y no se publica.', pestana: 'diseno' })
  if (web.titulares.length === 0) avisos.push({ id: 'titulares', texto: 'No has puesto ningún titular.', pestana: 'diseno' })
  if (web.cultos.length === 0) avisos.push({ id: 'cultos', texto: 'No hay cultos publicados: es lo que más se busca en una web de hermandad.', pestana: 'cultos' })
  if (web.redes.length === 0) avisos.push({ id: 'redes', texto: 'No has enlazado ninguna red social.', pestana: 'contacto' })
  const enlacesRotos = web.pie.columnas.flatMap((c) => c.enlaces).filter((e) => (e.texto.trim() || e.url.trim()) && !urlSegura(e.url)).length
  if (enlacesRotos > 0) {
    avisos.push({
      id: 'enlaces',
      texto: `${enlacesRotos === 1 ? 'Un enlace del pie no lleva' : `${enlacesRotos} enlaces del pie no llevan`} a ninguna parte: no se publican.`,
      pestana: 'marco',
    })
  }
  if (!web.pie.textoLegal.trim()) avisos.push({ id: 'legal', texto: 'El pie no tiene aviso legal ni política de privacidad (es obligatorio si recoges datos).', pestana: 'marco' })
  if (!web.publicada) avisos.push({ id: 'publicada', texto: 'La web está oculta: solo la ves tú.', pestana: 'diseno' })

  return avisos
}

export default function WebPublica() {
  const [web, setWeb] = useWebPublica()
  const hermandad = useHermandadSettings()
  const [pestana, setPestana] = useState<Pestana>('diseno')
  const [copiado, setCopiado] = useState(false)
  const [paginaSel, setPaginaSel] = useState<string | null>(null)
  // Dentro de «Cabecera y pie» hay dos sitios muy separados de la web: la vista
  // previa sigue al que se esté tocando.
  const [focoMarco, setFocoMarco] = useState<'cabecera' | 'pie'>('cabecera')

  useEffect(() => {
    const parche: Partial<WebPublica> = {}
    if (!web.titulo && hermandad.nombreLegal) parche.titulo = hermandad.nombreLegal
    if (web.colorPrimario === '#6A1A23' && hermandad.colorPrimario) parche.colorPrimario = hermandad.colorPrimario
    if (web.colorSecundario === '#C5A059' && hermandad.colorSecundario) parche.colorSecundario = hermandad.colorSecundario
    if (!web.slug && hermandad.nombreLegal) parche.slug = aSlug(hermandad.nombreLegal)
    if (Object.keys(parche).length) setWeb({ ...web, ...parche })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enlace = `${window.location.origin}/w/${web.slug}`
  const avisos = avisosDeLaWeb(web, hermandad)

  function editar<K extends keyof WebPublica>(campo: K, valor: WebPublica[K]) {
    // Actualización funcional: al subir una imagen el cambio llega más tarde
    // (lectura + compresión) y con el objeto capturado se perdía lo editado
    // entretanto.
    setWeb((actual) => ({ ...actual, [campo]: valor }))
  }

  function copiarEnlace() {
    navigator.clipboard?.writeText(enlace).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Web pública</p>
          <h1>Contenido web</h1>
          <p className="dash-head__lead">Personaliza tu web por secciones. A la derecha ves cómo va quedando.</p>
        </div>
        <div className="dash-head__actions">
          <button type="button" className="btn btn-outline" onClick={copiarEnlace}>
            {copiado ? '✓ Enlace copiado' : 'Copiar enlace'}
          </button>
          <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Ver mi web</a>
        </div>
      </div>

      <AvisosWeb avisos={avisos} irA={setPestana} />

      {/* Pestañas */}
      <div className="cms-tabs">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" className={`cms-tab${pestana === p.id ? ' cms-tab--active' : ''}`} onClick={() => setPestana(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="cms-layout">
        <div className="cms-editor">
          {pestana === 'diseno' && (
            <DisenoTab web={web} hermandad={hermandad} editar={editar} copiado={copiado} copiarEnlace={copiarEnlace} />
          )}
          {pestana === 'marco' && <MarcoTab web={web} editar={editar} onFoco={setFocoMarco} />}
          {pestana === 'portada' && <PortadaTab web={web} editar={editar} />}
          {pestana === 'actualidad' && <ActualidadTab web={web} editar={editar} />}
          {pestana === 'cultos' && <CultosTab web={web} editar={editar} />}
          {pestana === 'paginas' && <PaginasTab web={web} editar={editar} paginaSel={paginaSel} setPaginaSel={setPaginaSel} />}
          {pestana === 'boletines' && <BoletinesTab web={web} editar={editar} />}
          {pestana === 'contacto' && <ContactoTab web={web} hermandad={hermandad} editar={editar} />}
        </div>

        {/* Vista previa en vivo (render React real, sin iframe: sin parpadeo) */}
        <aside className="cms-preview">
          <div className="cms-preview__head">
            <span>Vista previa</span>
            <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Abrir</a>
          </div>
          <div className="cms-preview__frame">
            <div className="cms-preview__stage">
              <SitioContenido
                web={web}
                hermandad={hermandad}
                interactivo={false}
                seccionActiva={pestana === 'marco' ? focoMarco : SECCION_DE_PESTANA[pestana]}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

type EditarFn = <K extends keyof WebPublica>(campo: K, valor: WebPublica[K]) => void

/* ------------------------- Avisos de lo que falta ------------------------- */
function AvisosWeb({ avisos, irA }: { avisos: AvisoWeb[]; irA: (p: Pestana) => void }) {
  // Plegado por defecto si solo quedan detalles: no queremos una lista de
  // reproches ocupando media pantalla cada vez que se entra a escribir.
  const graves = avisos.filter((a) => a.grave)
  const [abierto, setAbierto] = useState(graves.length > 0)

  if (avisos.length === 0) {
    return (
      <p className="cms-avisos cms-avisos--ok">
        <span className="cms-avisos__icono" aria-hidden="true">✓</span>
        Tu web está completa: portada, historia, titulares, cultos, contacto y aviso legal.
      </p>
    )
  }

  return (
    <section className={`cms-avisos${graves.length ? ' cms-avisos--grave' : ''}`}>
      <button type="button" className="cms-avisos__head" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <span className="cms-avisos__icono" aria-hidden="true">{graves.length ? '!' : 'i'}</span>
        <b>
          {graves.length > 0
            ? `Falta algo importante en tu web (${avisos.length})`
            : `Puedes rematar ${avisos.length} ${avisos.length === 1 ? 'detalle' : 'detalles'}`}
        </b>
        <span className="cms-avisos__flecha">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <ul className="cms-avisos__lista">
          {avisos.map((a) => (
            <li key={a.id}>
              <span>{a.texto}</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => irA(a.pestana)}>Arreglar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* --------------------------- Cabecera y pie --------------------------- */
function MarcoTab({ web, editar, onFoco }: { web: WebPublica; editar: EditarFn; onFoco: (f: 'cabecera' | 'pie') => void }) {
  const { cabecera, pie } = web

  function editarCabecera(c: Partial<typeof cabecera>) { editar('cabecera', { ...cabecera, ...c }) }
  function editarPie(c: Partial<typeof pie>) { editar('pie', { ...pie, ...c }) }
  function editarColumna(id: string, c: Partial<ColumnaPie>) {
    editarPie({ columnas: pie.columnas.map((col) => (col.id === id ? { ...col, ...c } : col)) })
  }
  function editarEnlace(colId: string, id: string, c: Partial<EnlacePie>) {
    editarColumna(colId, {
      enlaces: (pie.columnas.find((x) => x.id === colId)?.enlaces ?? []).map((e) => (e.id === id ? { ...e, ...c } : e)),
    })
  }
  function moverColumna(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= pie.columnas.length) return
    const cols = [...pie.columnas]
    ;[cols[i], cols[j]] = [cols[j], cols[i]]
    editarPie({ columnas: cols })
  }
  /**
   * Los sitios de la propia web a los que se puede enlazar. Se ofrecen como
   * sugerencia al escribir la dirección: nadie se sabe de memoria que una
   * página suya es `#pagina-a1b2c3`.
   */
  const destinosPropios: { texto: string; url: string }[] = [
    ...web.secciones
      .filter((s) => s.visible && s.tipo !== 'paginas')
      .map((s) => ({ texto: nombreSeccion(s), url: `#${s.tipo}` })),
    ...web.paginas
      .filter((p) => p.enMenu !== false)
      .map((p) => ({ texto: p.titulo || 'Página', url: `#pagina-${p.id}` })),
  ]

  /** Atajo: una columna con enlaces a las secciones y páginas que ya existen. */
  function columnaDeSecciones() {
    const enlaces: EnlacePie[] = destinosPropios
      .filter((d) => d.url !== '#contacto')
      .map((d) => ({ id: nuevoId(), texto: d.texto, url: d.url }))
    editarPie({ columnas: [...pie.columnas, { id: nuevoId(), titulo: 'La Hermandad', enlaces }] })
  }

  return (
    <>
      {/* onFocus burbujea: basta con marcarlo en la tarjeta para que la vista
          previa salte a la barra de arriba al tocar cualquier control suyo. */}
      <section className="settings-card" onFocus={() => onFoco('cabecera')}>
        <div className="settings-card__head"><h2 className="settings-card__title">Cabecera</h2></div>
        <p className="form-hint">La barra de arriba, la que se ve en todas las páginas de tu web.</p>
        <label className="checkbox">
          <input type="checkbox" checked={cabecera.mostrarLogo} onChange={(e) => editarCabecera({ mostrarLogo: e.target.checked })} />
          <span>Enseñar el escudo o logo</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={cabecera.mostrarNombre} onChange={(e) => editarCabecera({ mostrarNombre: e.target.checked })} />
          <span>Enseñar el nombre de la hermandad</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={cabecera.mostrarLema} onChange={(e) => editarCabecera({ mostrarLema: e.target.checked })} />
          <span>Enseñar el lema debajo del nombre</span>
        </label>
        {cabecera.mostrarLema && !web.lema && (
          <p className="form-hint">Todavía no hay lema escrito: se pone en <b>Diseño y secciones → Colores y tipografía</b>.</p>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={cabecera.fija} onChange={(e) => editarCabecera({ fija: e.target.checked })} />
          <span>La barra se queda arriba al bajar por la página</span>
        </label>
        {!cabecera.mostrarLogo && !cabecera.mostrarNombre && (
          <p className="form-hint form-hint--alerta">
            Sin logo ni nombre, la parte izquierda de la barra queda en blanco. Deja al menos uno.
          </p>
        )}
        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="botonCabecera">Botón de la derecha</label>
          <input
            id="botonCabecera"
            type="text"
            value={cabecera.textoBoton}
            onChange={(e) => editarCabecera({ textoBoton: e.target.value })}
            placeholder="Entrar"
          />
          <p className="form-hint">Lleva al área del hermano. Déjalo vacío si no quieres ningún botón.</p>
        </div>
      </section>

      <section className="settings-card" onFocus={() => onFoco('pie')}>
        <div className="settings-card__head">
          <h2 className="settings-card__title">Pie de página</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editarPie({ columnas: [...pie.columnas, { id: nuevoId(), titulo: 'Enlaces', enlaces: [] }] })}>
            + Añadir columna
          </button>
        </div>
        <p className="form-hint">
          Columnas de enlaces al final de la web. Puedes enlazar a una sección de tu propia web
          (<code>#cultos</code>), a una página tuya o a una dirección de fuera.
        </p>
        {/* Al escribir la dirección se despliegan los sitios de la propia web. */}
        <datalist id="destinos-web">
          {destinosPropios.map((d) => <option key={d.url} value={d.url}>{d.texto}</option>)}
        </datalist>
        {pie.columnas.length === 0 && (
          <div className="assign-box__row" style={{ marginBottom: '0.6rem' }}>
            <span className="table-subtle">Sin columnas: el pie es solo una línea con el copyright.</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={columnaDeSecciones}>
              Crear una con mis secciones
            </button>
          </div>
        )}
        {pie.columnas.map((col, i) => (
          <div className="assign-box" key={col.id}>
            <div className="assign-box__row">
              <input
                type="text"
                value={col.titulo}
                onChange={(e) => editarColumna(col.id, { titulo: e.target.value })}
                placeholder="Título de la columna"
                aria-label="Título de la columna"
              />
              <button type="button" className="icon-btn" title="Subir" disabled={i === 0} onClick={() => moverColumna(i, -1)}>▲</button>
              <button type="button" className="icon-btn" title="Bajar" disabled={i === pie.columnas.length - 1} onClick={() => moverColumna(i, 1)}>▼</button>
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editarPie({ columnas: pie.columnas.filter((x) => x.id !== col.id) })}>Quitar</button>
            </div>
            {col.enlaces.map((e) => {
              // Un enlace mal escrito no se publica y desaparece sin decir nada:
              // aquí se avisa en el momento, no cuando ya está la web fuera.
              const roto = Boolean(e.url.trim()) && !urlSegura(e.url)
              const sinTexto = Boolean(e.url.trim()) && !e.texto.trim()
              return (
                <div key={e.id} style={{ marginTop: '0.4rem' }}>
                  <div className="assign-box__row">
                    <input type="text" value={e.texto} onChange={(ev) => editarEnlace(col.id, e.id, { texto: ev.target.value })} placeholder="Texto" aria-label="Texto del enlace" />
                    <input
                      type="text"
                      list="destinos-web"
                      value={e.url}
                      onChange={(ev) => editarEnlace(col.id, e.id, { url: ev.target.value })}
                      placeholder="#cultos o https://…"
                      aria-label="Dirección del enlace"
                      aria-invalid={roto}
                    />
                    <button type="button" className="icon-btn rgpd-borrar" title="Quitar enlace" onClick={() => editarColumna(col.id, { enlaces: col.enlaces.filter((x) => x.id !== e.id) })}>✕</button>
                  </div>
                  {roto && <p className="form-hint form-hint--alerta">Esa dirección no vale: pon «#cultos» para una sección tuya o una dirección que empiece por https://</p>}
                  {!roto && sinTexto && <p className="form-hint form-hint--alerta">Ponle un texto o no se publicará.</p>}
                </div>
              )
            })}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: '0.4rem' }}
              onClick={() => editarColumna(col.id, { enlaces: [...col.enlaces, { id: nuevoId(), texto: '', url: '' }] })}
            >
              + Añadir enlace
            </button>
            {col.enlaces.length === 0 && (
              <p className="form-hint">Una columna sin enlaces no se publica.</p>
            )}
          </div>
        ))}

        <label className="checkbox" style={{ marginTop: '0.8rem' }}>
          <input type="checkbox" checked={pie.mostrarContacto} onChange={(e) => editarPie({ mostrarContacto: e.target.checked })} />
          <span>Repetir los datos de contacto en el pie</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={pie.mostrarRedes} onChange={(e) => editarPie({ mostrarRedes: e.target.checked })} />
          <span>Enseñar las redes sociales en el pie</span>
        </label>

        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="textoPie">Línea de copyright</label>
          <input id="textoPie" type="text" value={web.textoPie} onChange={(e) => editar('textoPie', e.target.value)} placeholder={`© ${web.titulo || 'Tu hermandad'}`} />
        </div>
        <div className="form-row">
          <label htmlFor="textoLegal">Aviso legal y protección de datos</label>
          <textarea
            id="textoLegal"
            rows={3}
            value={pie.textoLegal}
            onChange={(e) => editarPie({ textoLegal: e.target.value })}
            placeholder="Hermandad inscrita en el Registro de Entidades Religiosas nº … · Responsable del tratamiento de datos: … · Puedes ejercer tus derechos escribiendo a …"
          />
          <p className="form-hint">
            Sale en letra pequeña al final de todo. Si en la web recoges datos personales, este texto
            es obligatorio.
          </p>
        </div>
      </section>
    </>
  )
}

/* ------------------------------ Diseño ------------------------------ */
function DisenoTab({
  web, hermandad, editar, copiado, copiarEnlace,
}: {
  web: WebPublica
  hermandad: ReturnType<typeof useHermandadSettings>
  editar: EditarFn
  copiado: boolean
  copiarEnlace: () => void
}) {
  // El dominio propio es un extra del pack «Todo» (capacidad premium).
  const { suscripcion } = useSuscripcion()
  const conDominioPropio = tieneCapacidad(suscripcion, 'premium')

  function toggleSeccion(i: number) {
    editar('secciones', web.secciones.map((s, idx) => (idx === i ? { ...s, visible: !s.visible } : s)))
  }
  /** Título a medida de una sección; vacío = el nombre de fábrica. */
  function renombrarSeccion(i: number, nombre: string) {
    editar('secciones', web.secciones.map((s, idx) => (idx === i ? { ...s, nombre } : s)))
  }
  function moverSeccion(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.secciones.length) return
    const secciones = [...web.secciones]
    ;[secciones[i], secciones[j]] = [secciones[j], secciones[i]]
    editar('secciones', secciones)
  }
  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Publicación</h2></div>
        <label className="checkbox">
          <input type="checkbox" checked={web.publicada} onChange={(e) => editar('publicada', e.target.checked)} />
          <span>{web.publicada ? 'Web publicada (visible para todos)' : 'Web oculta (solo tú la ves)'}</span>
        </label>
        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="slug">Enlace de tu web</label>
          <div className="assign-box__row">
            <span className="table-subtle">{window.location.origin}/w/</span>
            <input id="slug" type="text" value={web.slug} onChange={(e) => editar('slug', aSlug(e.target.value))} placeholder="mi-hermandad" />
            <button type="button" className="btn btn-outline btn-sm" onClick={copiarEnlace}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="dominio">
            Dominio personalizado {!conDominioPropio && <span className="pill pill--info">Pack Todo</span>}
          </label>
          {!conDominioPropio && (
            <p className="form-hint">
              Tu web vive en el enlace de arriba. Para usar un dominio propio
              (hermandaddetriana.es) hace falta el pack <b>Todo</b>.
            </p>
          )}
          <input
            id="dominio"
            type="text"
            value={web.dominio ?? ''}
            disabled={!conDominioPropio}
            onChange={(e) => editar('dominio', e.target.value.trim().toLowerCase())}
            placeholder="hermandaddetriana.es"
          />
          <details className="form-hint" style={{ marginTop: '0.5rem' }}>
            <summary>Cómo poner tu dominio propio (p. ej. hermandaddetriana.es)</summary>
            <ol style={{ margin: '0.5rem 0 0 1rem', lineHeight: 1.7 }}>
              <li>Compra el dominio en un registrador (IONOS, GoDaddy, Namecheap…).</li>
              <li>Escríbelo aquí arriba y guarda.</li>
              <li>En el panel de despliegue (Vercel) → <b>Domains</b> → añade tu dominio.</li>
              <li>En tu registrador, apunta los DNS a Vercel (un registro <code>A</code> a la IP que te indica, o un <code>CNAME</code>).</li>
              <li>En unos minutos tu web se verá en <b>tu dominio</b> en vez de en el enlace largo.</li>
            </ol>
            <p style={{ marginTop: '0.4rem' }}>
              El enlace real al dominio se activa al conectar la base de datos y el despliegue; por
              ahora este campo lo guarda para tenerlo listo.
            </p>
          </details>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Plantilla</h2></div>
        <div className="plantillas-grid">
          {PLANTILLAS.map((pl) => (
            <button type="button" key={pl.id} className={`plantilla-card${web.plantilla === pl.id ? ' plantilla-card--sel' : ''}`} onClick={() => editar('plantilla', pl.id as PlantillaWeb)}>
              <span className={`plantilla-card__mini plantilla-card__mini--${pl.id}`} aria-hidden="true"><span /><span /><span /></span>
              <b>{pl.nombre}</b><small>{pl.descripcion}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Colores y tipografía</h2></div>
        <div className="form-grid-2">
          <div className="form-row"><label>Color principal</label><input type="color" value={web.colorPrimario} onChange={(e) => editar('colorPrimario', e.target.value)} /></div>
          <div className="form-row"><label>Color secundario</label><input type="color" value={web.colorSecundario} onChange={(e) => editar('colorSecundario', e.target.value)} /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label>Tema</label>
            <select value={web.tema} onChange={(e) => editar('tema', e.target.value as TemaWeb)}><option value="claro">Claro</option><option value="oscuro">Oscuro</option></select>
          </div>
          <div className="form-row">
            <label>Tipografía</label>
            <select value={web.tipografia} onChange={(e) => editar('tipografia', e.target.value as TipografiaWeb)}>
              {TIPOGRAFIAS.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <label>Logo de la web</label>
          <div className="assign-box__row">
            {web.logoDataUrl && <img src={web.logoDataUrl} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />}
            <label className="btn btn-outline btn-sm">{web.logoDataUrl ? 'Cambiar' : 'Subir logo'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('logoDataUrl', d))} /></label>
            {web.logoDataUrl && <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('logoDataUrl', null)}>Quitar</button>}
          </div>
        </div>
        <div className="form-row"><label htmlFor="titulo">Nombre</label><input id="titulo" type="text" value={web.titulo} onChange={(e) => editar('titulo', e.target.value)} /></div>
        <div className="form-row"><label htmlFor="lema">Lema</label><input id="lema" type="text" value={web.lema} onChange={(e) => editar('lema', e.target.value)} /></div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Historia</h2></div>
        <p className="form-hint">
          Se publica como una sección con formato: una entradilla, los párrafos que quieras (con su
          subtítulo) y fotos. Lo que tuvieras escrito antes está en el primer párrafo.
        </p>
        <div className="form-row">
          <label htmlFor="historiaEntradilla">Entradilla</label>
          <input
            id="historiaEntradilla"
            type="text"
            value={web.historia.entradilla}
            onChange={(e) => editar('historia', { ...web.historia, entradilla: e.target.value })}
            placeholder="Una frase que resuma la historia de la hermandad"
          />
        </div>
        <EditorParrafos
          parrafos={web.historia.parrafos}
          onChange={(parrafos) => editar('historia', { ...web.historia, parrafos })}
          ayuda="Por ejemplo: «Fundación», «Los titulares», «La sede», «Hoy»."
        />
        <EditorFotos
          fotos={web.historia.fotos}
          onChange={(fotos) => editar('historia', { ...web.historia, fotos })}
          onSubir={leerImagen}
          titulo="Fotos de la sección"
        />
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Secciones (orden y visibilidad)</h2></div>
        <ul className="secciones-lista">
          {web.secciones.map((s, i) => (
            <li key={s.tipo} className="seccion-item">
              <label className="checkbox">
                <input type="checkbox" checked={s.visible} onChange={() => toggleSeccion(i)} />
                <span>{SECCIONES_INFO[s.tipo].nombre}</span>
              </label>
              <input
                className="seccion-item__nombre"
                type="text"
                value={s.nombre ?? ''}
                onChange={(e) => renombrarSeccion(i, e.target.value)}
                placeholder={`Se verá como «${SECCIONES_INFO[s.tipo].publico}»`}
                aria-label={`Título a medida para ${SECCIONES_INFO[s.tipo].nombre}`}
              />
              <span className="seccion-item__orden">
                <button type="button" className="icon-btn" onClick={() => moverSeccion(i, -1)} disabled={i === 0}>▲</button>
                <button type="button" className="icon-btn" onClick={() => moverSeccion(i, 1)} disabled={i === web.secciones.length - 1}>▼</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <TitularesGaleria web={web} editar={editar} hermandad={hermandad} />
    </>
  )
}

/* --------------------- Titulares y galería (en Diseño) --------------------- */
function TitularesGaleria({ web, editar }: { web: WebPublica; editar: EditarFn; hermandad: ReturnType<typeof useHermandadSettings> }) {
  function editarTitular(id: string, c: Partial<Titular>) { editar('titulares', web.titulares.map((t) => (t.id === id ? { ...t, ...c } : t))) }
  function anadirFoto(dataUrl: string) { editar('galeria', [...web.galeria, { id: nuevoId(), fotoDataUrl: dataUrl, pie: '' } as FotoGaleria]) }
  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Titulares</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('titulares', [...web.titulares, { id: nuevoId(), nombre: 'Nuevo titular', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: [] }])}>+ Añadir</button>
        </div>
        {web.titulares.map((t) => (
          <div className="assign-box" key={t.id}>
            <div className="assign-box__row">
              {t.fotoDataUrl && <img src={t.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
              <label className="btn btn-outline btn-sm">{t.fotoDataUrl ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarTitular(t.id, { fotoDataUrl: d }))} /></label>
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" style={{ marginLeft: 'auto' }} onClick={() => editar('titulares', web.titulares.filter((x) => x.id !== t.id))}>Quitar titular</button>
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label>Nombre</label>
                <input type="text" value={t.nombre} onChange={(e) => editarTitular(t.id, { nombre: e.target.value })} placeholder="Ntro. Padre Jesús…" />
              </div>
              <div className="form-row">
                <label>Autoría</label>
                <input type="text" value={t.autoria} onChange={(e) => editarTitular(t.id, { autoria: e.target.value })} placeholder="Juan de Mesa, 1620" />
              </div>
            </div>
            <div className="form-row">
              <label>Una línea de presentación</label>
              <input type="text" value={t.descripcion} onChange={(e) => editarTitular(t.id, { descripcion: e.target.value })} placeholder="Sagrada imagen del Señor." />
            </div>
            <EditorParrafos
              parrafos={t.parrafos}
              onChange={(parrafos) => editarTitular(t.id, { parrafos })}
              titulo="Texto de la imagen"
              ayuda="Su historia, restauraciones, la devoción que despierta… Se publica bajo la foto."
            />
          </div>
        ))}
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Galería de fotos</h2>
          <label className="btn btn-outline btn-sm">+ Añadir foto<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, anadirFoto)} /></label>
        </div>
        {web.galeria.length === 0 ? <p className="form-hint">Aún no hay fotos.</p> : (
          <div className="galeria-editor">
            {web.galeria.map((g) => (
              <div className="galeria-editor__item" key={g.id}>
                <img src={g.fotoDataUrl} alt="" />
                <input type="text" value={g.pie} onChange={(e) => editar('galeria', web.galeria.map((x) => (x.id === g.id ? { ...x, pie: e.target.value } : x)))} placeholder="Pie" />
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('galeria', web.galeria.filter((x) => x.id !== g.id))}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ------------------------------ Portada ------------------------------ */
function PortadaTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Fotos de portada</h2>
        <label className="btn btn-primary btn-sm">+ Añadir foto<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('heroFotos', [...web.heroFotos, d]))} /></label>
      </div>
      <p className="form-hint">Se alternan de fondo en la cabecera. Cámbialas o elimínalas.</p>
      {web.heroFotos.length === 0 ? <p className="form-hint">Sin fotos aún. Sube al menos una para la portada.</p> : (
        <div className="galeria-editor">
          {web.heroFotos.map((f, i) => (
            <div className="galeria-editor__item" key={i}>
              <img src={f} alt="" />
              <div className="assign-box__row">
                <label className="btn btn-outline btn-sm">Cambiar<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('heroFotos', web.heroFotos.map((x, j) => (j === i ? d : x))))} /></label>
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('heroFotos', web.heroFotos.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-grid-2" style={{ marginTop: '1rem' }}>
        <div className="form-row">
          <label>Altura de la portada</label>
          <select value={web.heroAltura} onChange={(e) => editar('heroAltura', e.target.value as AlturaHero)}>{ALTURAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        </div>
        <div className="form-row">
          <label>Oscurecido ({web.heroOverlay}%)</label>
          <input type="range" min={0} max={80} value={web.heroOverlay} onChange={(e) => editar('heroOverlay', Number(e.target.value))} />
        </div>
      </div>
      <div className="form-row"><label>Texto del botón de portada</label><input type="text" value={web.heroTextoBoton} onChange={(e) => editar('heroTextoBoton', e.target.value)} placeholder="Portal del hermano" /></div>
    </section>
  )
}

/* ------------------------------ Actualidad ------------------------------ */
function ActualidadTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarNoticia(id: string, c: Partial<Noticia>) { editar('noticias', web.noticias.map((n) => (n.id === id ? { ...n, ...c } : n))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Noticias publicadas en la web</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('noticias', [{ id: nuevoId(), titulo: 'Nueva noticia', fecha: fechaHoyLocal(), resumen: '', fotoDataUrl: null, publicada: true }, ...web.noticias])}>+ Nueva noticia</button>
      </div>
      {web.noticias.length === 0 && <p className="form-hint">Aún no hay noticias.</p>}
      {web.noticias.map((n) => (
        <div className="assign-box" key={n.id}>
          <div className="assign-box__row">
            {n.fotoDataUrl && <img src={n.fotoDataUrl} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />}
            <label className="btn btn-outline btn-sm">{n.fotoDataUrl ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarNoticia(n.id, { fotoDataUrl: d }))} /></label>
            <label className="checkbox"><input type="checkbox" checked={n.publicada} onChange={(e) => editarNoticia(n.id, { publicada: e.target.checked })} /><span>{n.publicada ? 'Publicada' : 'Oculta'}</span></label>
          </div>
          <div className="form-grid-2">
            <div className="form-row"><label>Título</label><input type="text" value={n.titulo} onChange={(e) => editarNoticia(n.id, { titulo: e.target.value })} /></div>
            <div className="form-row"><label>Fecha</label><input type="date" value={n.fecha} onChange={(e) => editarNoticia(n.id, { fecha: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Resumen</label><textarea rows={2} value={n.resumen} onChange={(e) => editarNoticia(n.id, { resumen: e.target.value })} /></div>
          <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('noticias', web.noticias.filter((x) => x.id !== n.id))}>Eliminar noticia</button>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------ Cultos ------------------------------ */
function CultosTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarCulto(id: string, c: Partial<CultoWeb>) { editar('cultos', web.cultos.map((x) => (x.id === id ? { ...x, ...c } : x))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Cultos y actos</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('cultos', [...web.cultos, { id: nuevoId(), titulo: 'Nuevo culto', detalle: '', fecha: '', lugar: '', fotoDataUrl: null }])}>+ Añadir culto</button>
      </div>
      {web.cultos.map((c) => (
        <div className="assign-box" key={c.id}>
          <div className="assign-box__row">
            {c.fotoDataUrl && <img src={c.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
            <label className="btn btn-outline btn-sm">
              {c.fotoDataUrl ? 'Cambiar foto' : 'Foto (opcional)'}
              <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarCulto(c.id, { fotoDataUrl: d }))} />
            </label>
            {c.fotoDataUrl && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => editarCulto(c.id, { fotoDataUrl: null })}>Quitar foto</button>
            )}
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" style={{ marginLeft: 'auto' }} onClick={() => editar('cultos', web.cultos.filter((x) => x.id !== c.id))}>Quitar culto</button>
          </div>
          <div className="form-row">
            <label>Título</label>
            <input type="text" value={c.titulo} onChange={(e) => editarCulto(c.id, { titulo: e.target.value })} placeholder="Quinario, Función Principal, Besamanos…" />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label>Cuándo</label>
              <input type="text" value={c.fecha} onChange={(e) => editarCulto(c.id, { fecha: e.target.value })} placeholder="Del 3 al 7 de marzo, 20:30" />
            </div>
            <div className="form-row">
              <label>Dónde</label>
              <input type="text" value={c.lugar} onChange={(e) => editarCulto(c.id, { lugar: e.target.value })} placeholder="Sede canónica" />
            </div>
          </div>
          <div className="form-row">
            <label>Detalle</label>
            <textarea rows={2} value={c.detalle} onChange={(e) => editarCulto(c.id, { detalle: e.target.value })} placeholder="Quién predica, intenciones, avisos…" />
          </div>
        </div>
      ))}
    </section>
  )
}

/* --------------------------- Páginas y textos --------------------------- */
function PaginasTab({ web, editar, paginaSel, setPaginaSel }: { web: WebPublica; editar: EditarFn; paginaSel: string | null; setPaginaSel: (id: string | null) => void }) {
  const sel = web.paginas.find((p) => p.id === (paginaSel ?? web.paginas[0]?.id)) ?? null
  function editarPagina(id: string, c: Partial<PaginaWeb>) { editar('paginas', web.paginas.map((p) => (p.id === id ? { ...p, ...c } : p))) }
  function moverPagina(id: string, dir: -1 | 1) {
    const i = web.paginas.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= web.paginas.length) return
    const arr = [...web.paginas]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('paginas', arr)
  }
  function nuevaPagina() {
    const p: PaginaWeb = { id: nuevoId(), icono: '📄', antetitulo: '', titulo: 'Nueva página', entradilla: '', parrafos: [], fotos: [], enMenu: true }
    editar('paginas', [...web.paginas, p])
    setPaginaSel(p.id)
  }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Páginas y textos</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={nuevaPagina}>+ Nueva página</button>
      </div>
      <div className="cms-chips">
        {web.paginas.map((p) => (
          <button key={p.id} type="button" className={`chip${sel?.id === p.id ? ' chip--active' : ''}`} onClick={() => setPaginaSel(p.id)}>{p.icono} {p.titulo}</button>
        ))}
      </div>
      {sel && (
        <div className="assign-box" style={{ marginTop: '1rem' }}>
          <div className="form-grid-2">
            <div className="form-row"><label>Icono</label><input type="text" value={sel.icono} onChange={(e) => editarPagina(sel.id, { icono: e.target.value })} placeholder="✝️" /></div>
            <div className="form-row"><label>Antetítulo</label><input type="text" value={sel.antetitulo} onChange={(e) => editarPagina(sel.id, { antetitulo: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Título de la página</label><input type="text" value={sel.titulo} onChange={(e) => editarPagina(sel.id, { titulo: e.target.value })} /></div>
          <div className="form-row"><label>Entradilla</label><textarea rows={2} value={sel.entradilla} onChange={(e) => editarPagina(sel.id, { entradilla: e.target.value })} /></div>

          <div className="assign-box__row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="checkbox">
              <input type="checkbox" checked={sel.enMenu !== false} onChange={(e) => editarPagina(sel.id, { enMenu: e.target.checked })} />
              <span>Mostrar esta página en la web (y en su menú)</span>
            </label>
            <div className="assign-box__row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverPagina(sel.id, -1)}>▲ Subir</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverPagina(sel.id, 1)}>▼ Bajar</button>
            </div>
          </div>

          {/* Mismos editores que la Historia y los titulares: un solo sitio que
              mantener y las mismas posibilidades (reordenar) en todas partes. */}
          <EditorParrafos
            parrafos={sel.parrafos}
            onChange={(parrafos) => editarPagina(sel.id, { parrafos })}
          />
          <EditorFotos
            fotos={sel.fotos}
            onChange={(fotos) => editarPagina(sel.id, { fotos })}
            onSubir={leerImagen}
            titulo="Fotos de la página"
          />

          <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" style={{ marginTop: '0.6rem' }} onClick={() => { editar('paginas', web.paginas.filter((p) => p.id !== sel.id)); setPaginaSel(null) }}>Eliminar página</button>
        </div>
      )}
    </section>
  )
}

/* ------------------------------ Boletines ------------------------------ */
function BoletinesTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarBoletin(id: string, c: Partial<Boletin>) { editar('boletines', web.boletines.map((b) => (b.id === id ? { ...b, ...c } : b))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Boletines (PDF)</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('boletines', [{ id: nuevoId(), titulo: 'Nuevo boletín', subtitulo: '', pdfNombre: null }, ...web.boletines])}>+ Subir boletín</button>
      </div>
      {web.boletines.length === 0 && <p className="form-hint">Aún no hay boletines.</p>}
      {web.boletines.map((b) => (
        <div className="assign-box" key={b.id}>
          <div className="form-row"><input type="text" value={b.titulo} onChange={(e) => editarBoletin(b.id, { titulo: e.target.value })} placeholder="Título" /></div>
          <div className="assign-box__row">
            <input type="text" value={b.subtitulo} onChange={(e) => editarBoletin(b.id, { subtitulo: e.target.value })} placeholder="Subtítulo (Cuaresma, nº páginas…)" />
            <span className="table-subtle">{b.pdfNombre ?? 'Sin PDF'}</span>
            <label className="btn btn-outline btn-sm">Subir PDF<input type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) editarBoletin(b.id, { pdfNombre: f.name }); e.target.value = '' }} /></label>
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('boletines', web.boletines.filter((x) => x.id !== b.id))}>Quitar</button>
          </div>
        </div>
      ))}
      <p className="form-hint">Por ahora se guarda el nombre del PDF; el archivo se subirá cuando conectemos el almacenamiento (Supabase).</p>
    </section>
  )
}

/* ------------------------------ Contacto ------------------------------ */
function ContactoTab({ web, hermandad, editar }: { web: WebPublica; hermandad: HermandadSettings; editar: EditarFn }) {
  function editarRed(id: string, c: Partial<RedWeb>) { editar('redes', web.redes.map((r) => (r.id === id ? { ...r, ...c } : r))) }
  const direccion = web.direccion || hermandad.direccion
  const mapa = urlMapaIncrustado(web.mapaUrl, direccion)
  // Un enlace que no es de Google Maps no se incrusta a propósito: un iframe a
  // cualquier sitio es un agujero en la web pública.
  const enlaceNoIncrustable = Boolean(web.mapaUrl.trim()) && !esDeGoogleMaps(web.mapaUrl)

  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Dónde estáis y cómo contactar</h2></div>
        <p className="form-hint">Si dejas un campo vacío, se usan los datos de <Link to="/app/configuracion">Configuración</Link>.</p>
        <div className="form-row"><label htmlFor="direccion">Dirección</label><input id="direccion" type="text" value={web.direccion} onChange={(e) => editar('direccion', e.target.value)} placeholder={hermandad.direccion || 'Calle, número, ciudad'} /></div>
        <div className="form-grid-2">
          <div className="form-row"><label htmlFor="telefono">Teléfono</label><input id="telefono" type="text" value={web.telefono} onChange={(e) => editar('telefono', e.target.value)} placeholder={hermandad.telefono || '954 00 00 00'} /></div>
          <div className="form-row"><label htmlFor="email">Correo</label><input id="email" type="email" value={web.email} onChange={(e) => editar('email', e.target.value)} placeholder={hermandad.email || 'secretaria@…'} /></div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Mapa</h2></div>
        <label className="checkbox">
          <input type="checkbox" checked={web.mapaIncrustado} onChange={(e) => editar('mapaIncrustado', e.target.checked)} />
          <span>Enseñar el mapa dentro de la web</span>
        </label>
        <p className="form-hint">
          Con la dirección de arriba ya se dibuja el mapa: no hace falta poner nada más. El enlace
          solo hace falta si quieres apuntar a un sitio concreto de Google Maps.
        </p>
        <div className="form-row">
          <label htmlFor="mapaUrl">Enlace de Google Maps (opcional)</label>
          <input id="mapaUrl" type="text" value={web.mapaUrl} onChange={(e) => editar('mapaUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" />
        </div>
        {enlaceNoIncrustable && (
          <p className="form-hint form-hint--alerta">
            Ese enlace no es de Google Maps: se publicará como botón «Cómo llegar», pero el mapa
            dibujado se saca de la dirección. Por seguridad no incrustamos páginas de fuera.
          </p>
        )}
        {web.mapaIncrustado && !mapa && !web.mapaUrl.trim() && (
          <p className="form-hint form-hint--alerta">Sin dirección no hay mapa que enseñar.</p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Redes sociales</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('redes', [...web.redes, { id: nuevoId(), tipo: 'Instagram', url: '' }])}>+ Añadir red</button>
        </div>
        {web.redes.length === 0 && <p className="form-hint">Salen en el pie de la web y en la sección de contacto.</p>}
        {web.redes.map((r) => (
          <div className="assign-box__row" key={r.id} style={{ marginTop: '0.5rem' }}>
            <select value={r.tipo} onChange={(e) => editarRed(r.id, { tipo: e.target.value as TipoRed })} aria-label="Red social">{REDES.map((red) => <option key={red} value={red}>{red}</option>)}</select>
            <input type="text" value={r.url} onChange={(e) => editarRed(r.id, { url: e.target.value })} placeholder="https://instagram.com/…" aria-label="Dirección del perfil" />
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('redes', web.redes.filter((x) => x.id !== r.id))}>Quitar</button>
          </div>
        ))}
        <p className="form-hint" style={{ marginTop: '0.8rem' }}>
          El texto del pie y el aviso legal están en <b>Cabecera y pie</b>.
        </p>
      </section>
    </>
  )
}
