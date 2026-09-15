/** Cabecera y pie de la web: el menú de arriba y las columnas de abajo. */
import { nuevoId } from '../../../lib/supabaseSync'
import {
  nombreSeccion,
  urlSegura,
  type ColumnaPie,
  type EnlacePie,
  type WebPublica,
} from '../../../lib/webPublica'
import { type EditarFn } from './comun'

export function MarcoTab({ web, editar, onFoco }: { web: WebPublica; editar: EditarFn; onFoco: (f: 'cabecera' | 'pie') => void }) {
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
