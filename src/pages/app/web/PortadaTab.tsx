/** La portada: el hero, sus fotos y lo que se ve al entrar. */
import { getCampana } from '../../../lib/campana'
import { useMoverConElFoco } from '../../../lib/foco'
import { nuevoId } from '../../../lib/supabaseSync'
import {
  IDIOMAS,
  nombreSeccion,
  type AlturaHero,
  type TipoSeccion,
  type WebPublica,
} from '../../../lib/webPublica'
import { leerImagen, leerImagenGrande, leerImagenes, type ActualizarFn, type EditarFn } from './comun'
import { ALTURAS } from './pestanas'

export function PortadaTab({ web, editar, actualizar }: { web: WebPublica; editar: EditarFn; actualizar: ActualizarFn }) {
  const conFoco = useMoverConElFoco('portada')
  /*
   * Una foto no tiene identificador: la lista son direcciones de imagen. Se usa
   * el final de la dirección, que es lo único distinto entre dos fotos y cabe
   * en un atributo — una foto escrita dentro del contenido mide megas.
   */
  const claveFoto = (foto: string) => foto.slice(-24)
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.heroFotos.length) return
    const arr = [...web.heroFotos]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('heroFotos', arr)
    conFoco.movida(claveFoto(web.heroFotos[i]), dir)
  }
  /** Sobre el estado más reciente: al subir varias, cada una llega cuando acaba de comprimirse. */
  function anadir(dataUrl: string) {
    actualizar((actual) => ({ ...actual, heroFotos: [...actual.heroFotos, dataUrl] }))
  }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Fotos de portada</h2>
        <label className="btn btn-primary btn-sm">
          + Añadir fotos
          <input type="file" accept="image/*" multiple hidden onChange={(e) => leerImagenes(e, anadir, 1920)} />
        </label>
      </div>
      <p className="form-hint">
        Se van alternando de fondo en la cabecera, una cada cinco segundos, en el orden que pongas
        aquí. La primera es la que se ve al entrar.
      </p>
      {web.heroFotos.length === 0 ? <p className="form-hint">Sin fotos aún. Sube al menos una para la portada.</p> : (
        <div className="galeria-editor">
          {web.heroFotos.map((f, i) => (
            <div className="galeria-editor__item" key={i}>
              <img src={f} alt="" />
              {i === 0 && <span className="galeria-editor__marca">Primera</span>}
              <div className="galeria-editor__acciones">
                <button type="button" className="icon-btn" title="Antes" {...conFoco.boton(claveFoto(f), -1)} disabled={i === 0} onClick={() => mover(i, -1)}>◀</button>
                <button type="button" className="icon-btn" title="Después" {...conFoco.boton(claveFoto(f), 1)} disabled={i === web.heroFotos.length - 1} onClick={() => mover(i, 1)}>▶</button>
                <label className="icon-btn" title="Cambiar esta foto">
                  ⟳
                  <input type="file" accept="image/*" hidden onChange={(e) => leerImagenGrande(e, (d) => editar('heroFotos', (xs) => xs.map((x, j) => (j === i ? d : x))))} />
                </label>
                <button type="button" className="icon-btn rgpd-borrar" title="Quitar" onClick={() => editar('heroFotos', (xs) => xs.filter((_, j) => j !== i))}>✕</button>
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

      <div className="settings-card__head" style={{ marginTop: '1.4rem' }}>
        <h2 className="settings-card__title">Lo primero que se ve</h2>
      </div>
      <p className="form-hint">
        Tres bloques bajo la portada con lo que pregunta todo el que entra: cuándo salís, cuál es el
        próximo culto y quiénes sois.
      </p>
      <label className="checkbox">
        <input type="checkbox" checked={web.cuentaAtras} onChange={(e) => editar('cuentaAtras', e.target.checked)} />
        <span>Cuenta atrás para la estación de penitencia</span>
      </label>
      <p className="form-hint">
        {web.estacion.fechaSalida
          ? `Cuenta hasta el ${web.estacion.fechaSalida}. La fecha se pone en «Estación de penitencia».`
          : getCampana().fechaSalida
            ? `Sin fecha propia usa la de la campaña (${getCampana().fechaSalida}), que ya tienes puesta en Papeletas.`
            : 'Necesita la fecha exacta de la salida: ponla en «Estación de penitencia» o en la campaña de Papeletas.'}
      </p>
      <label className="checkbox">
        <input type="checkbox" checked={web.proximoCulto} onChange={(e) => editar('proximoCulto', e.target.checked)} />
        <span>El próximo culto, destacado</span>
      </label>
      <p className="form-hint">Sale el primero del calendario que aún no haya pasado. Si no hay ninguno, no se enseña.</p>

      <div className="settings-card__head" style={{ marginTop: '1rem' }}>
        <h3 className="settings-card__title" style={{ fontSize: '0.95rem' }}>Cifras de la hermandad</h3>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => editar('cifras', (xs) => [...xs, { id: nuevoId(), numero: '', texto: '' }])}
        >
          + Añadir cifra
        </button>
      </div>
      {web.cifras.length === 0 ? (
        <p className="form-hint">Por ejemplo: «1.240 · hermanos», «1595 · desde», «3 · pasos».</p>
      ) : (
        web.cifras.map((c) => (
          <div className="assign-box__row" key={c.id}>
            <input
              type="text"
              value={c.numero}
              onChange={(e) => editar('cifras', (xs) => xs.map((x) => (x.id === c.id ? { ...x, numero: e.target.value } : x)))}
              placeholder="1.240"
              aria-label="La cifra"
              style={{ maxWidth: '9rem' }}
            />
            <input
              type="text"
              value={c.texto}
              onChange={(e) => editar('cifras', (xs) => xs.map((x) => (x.id === c.id ? { ...x, texto: e.target.value } : x)))}
              placeholder="hermanos"
              aria-label="Qué es esa cifra"
            />
            <button
              type="button"
              className="icon-btn rgpd-borrar"
              title="Quitar"
              onClick={() => editar('cifras', (xs) => xs.filter((x) => x.id !== c.id))}
            >
              ✕
            </button>
          </div>
        ))
      )}

      <div className="settings-card__head" style={{ marginTop: '1.4rem' }}>
        <h2 className="settings-card__title">Idioma</h2>
      </div>
      <div className="form-row">
        <label htmlFor="idiomaWeb">La web está escrita en</label>
        <select id="idiomaWeb" value={web.idioma} onChange={(e) => editar('idioma', e.target.value)}>
          {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <p className="form-hint">
          Sin esto, un lector de pantalla lee el castellano con voz inglesa y no hay quien lo
          entienda. Google también lo usa para saber a quién enseñar tu web.
        </p>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="otroIdioma">Unas líneas en otra lengua</label>
          <select
            id="otroIdioma"
            value={web.resumenOtroIdioma.idioma}
            onChange={(e) => editar('resumenOtroIdioma', (v) => ({ ...v, idioma: e.target.value }))}
          >
            {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="otroIdiomaTitulo">Título</label>
          <input
            id="otroIdiomaTitulo"
            type="text"
            value={web.resumenOtroIdioma.titulo}
            onChange={(e) => editar('resumenOtroIdioma', (v) => ({ ...v, titulo: e.target.value }))}
            placeholder="About our brotherhood"
          />
        </div>
      </div>
      <div className="form-row">
        <textarea
          rows={3}
          value={web.resumenOtroIdioma.texto}
          onChange={(e) => editar('resumenOtroIdioma', (v) => ({ ...v, texto: e.target.value }))}
          placeholder="Founded in 1595, our brotherhood walks the streets of the old quarter every Good Friday…"
          aria-label="Resumen en otra lengua"
        />
        <p className="form-hint">
          Cuatro líneas bajo la portada para el visitante de fuera. Traducir la web entera no es
          realista; esto sí, y es lo que busca quien viene de turismo en Semana Santa.
        </p>
      </div>

      <div className="settings-card__head" style={{ marginTop: '1.4rem' }}>
        <h2 className="settings-card__title">Foto a sangre</h2>
        <label className="btn btn-outline btn-sm">
          {web.sangre.fotoDataUrl ? 'Cambiar foto' : 'Subir foto'}
          <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('sangre', (v) => ({ ...v, fotoDataUrl: d })))} />
        </label>
      </div>
      <p className="form-hint">
        Una foto de borde a borde que corta la página en dos. Es lo que da respiro entre tanta
        sección seguida. Elige una apaisada y con aire abajo, que ahí va la frase.
      </p>
      {web.sangre.fotoDataUrl && (
        <>
          <div className="assign-box__row">
            <img src={web.sangre.fotoDataUrl} alt="" style={{ width: 120, height: 60, objectFit: 'cover', borderRadius: 8 }} />
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('sangre', (v) => ({ ...v, fotoDataUrl: null }))}>Quitar</button>
          </div>
          <div className="form-row">
            <label htmlFor="sangreTexto">Frase encima (opcional)</label>
            <input
              id="sangreTexto"
              type="text"
              value={web.sangre.texto}
              onChange={(e) => editar('sangre', (v) => ({ ...v, texto: e.target.value }))}
              placeholder="Desde 1595 por las calles de nuestro barrio"
            />
          </div>
          <div className="form-row">
            <label htmlFor="sangreDonde">Dónde va</label>
            <select
              id="sangreDonde"
              value={web.sangre.despuesDe}
              onChange={(e) => editar('sangre', (v) => ({ ...v, despuesDe: e.target.value as TipoSeccion | '' }))}
            >
              <option value="">Detrás de la primera sección</option>
              {web.secciones.filter((x) => x.visible).map((x) => (
                <option key={x.tipo} value={x.tipo}>Detrás de «{nombreSeccion(x)}»</option>
              ))}
            </select>
          </div>
        </>
      )}
    </section>
  )
}

/* ------------------------------- Galería ------------------------------- */
