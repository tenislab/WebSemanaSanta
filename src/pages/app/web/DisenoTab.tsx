/**
 * DISEÑO: plantilla, colores, tipografía, secciones y su orden.
 *
 * Es la pestaña más grande del editor, y con motivo: es la que decide cómo se
 * ve todo lo demás.
 */
import { avisosDeContraste } from '../../../lib/contraste'
import {
  explicarEstado,
  explicarProblema,
  limpiarDominio,
  problemaDelDominio,
  urlDeComprobacion,
  type EstadoDominio,
} from '../../../lib/dominio'
import { useHermandadSettings } from '../../../lib/hermandadSettings'
import { pedirActivarDominio } from '../../../lib/reporteFallo'
import { tieneCapacidad, useSuscripcion } from '../../../lib/suscripcion'
import {
  ESTILOS,
  PALETAS,
  PAREJAS_TIPOGRAFICAS,
  PLANTILLAS,
  SECCIONES_INFO,
  aSlug,
  cambiosDeEstilo,
  estiloActual,
  type EstiloWeb,
  type PlantillaWeb,
  type TemaWeb,
  type TipoSeccion,
  type WebPublica,
} from '../../../lib/webPublica'
import { useEffect, useState, type CSSProperties } from 'react'
import { leerImagen, type EditarFn, type EditarLoteFn } from './comun'

export function DisenoTab({
  web, editar, editarLote, copiado, copiarEnlace,
}: {
  web: WebPublica
  editar: EditarFn
  editarLote: EditarLoteFn
  copiado: boolean
  copiarEnlace: () => void
}) {
  // El dominio propio es un extra del pack «Todo» (capacidad premium).
  const { suscripcion } = useSuscripcion()
  const conDominioPropio = tieneCapacidad(suscripcion, 'premium')
  const problemaDominio = (web.dominio ?? '').trim() ? problemaDelDominio(web.dominio ?? '') : null
  const [estadoDominio, setEstadoDominio] = useState<EstadoDominio>('sinProbar')
  const hermandad = useHermandadSettings()
  const [avisoDominio, setAvisoDominio] = useState<'sinPedir' | 'mandando' | 'enviado'>('sinPedir')
  const [errorDominioAviso, setErrorDominioAviso] = useState<{ texto: string; reserva: string } | null>(null)

  /**
   * Pide que le den de alta el dominio. Es el paso que la hermandad no puede
   * dar por su cuenta, y el único que faltaba para que el circuito se cerrara
   * sin salir de la aplicación.
   */
  async function pedirDominio() {
    const dominio = (web.dominio ?? '').trim()
    if (!dominio) return
    setAvisoDominio('mandando')
    setErrorDominioAviso(null)
    const r = await pedirActivarDominio({
      dominio,
      hermandad: hermandad.nombreLegal || web.titulo || 'Sin nombre',
      slug: web.slug,
      quienLoPide: hermandad.email || undefined,
    })
    if (r.ok) { setAvisoDominio('enviado'); return }
    setAvisoDominio('sinPedir')
    setErrorDominioAviso({
      texto: r.error ?? 'No se ha podido avisar desde aquí.',
      reserva: r.reserva ?? '',
    })
  }

  /**
   * Comprueba de verdad si el dominio ya sirve esta web, en vez de fiarse de
   * que lo escribieron bien. Se pide una ruta que la propia aplicación sirve:
   * si contesta, está apuntado; si no contesta, o todavía no ha propagado el
   * DNS o el dominio no existe.
   */
  async function comprobarDominio() {
    const dominio = (web.dominio ?? '').trim()
    if (!dominio) return
    setEstadoDominio('comprobando')
    try {
      const r = await fetch(urlDeComprobacion(dominio), { cache: 'no-store' })
      if (!r.ok) { setEstadoDominio('otroSitio'); return }
      const texto = await r.text()
      // El robots.txt que servimos nombra nuestro sitemap: si está, es el nuestro.
      setEstadoDominio(/sitemap/i.test(texto) ? 'apunta' : 'otroSitio')
    } catch {
      // Un dominio que no existe, o que existe pero no deja consultarlo desde
      // otro origen. Las dos cosas se leen igual desde aquí, así que se cuenta
      // lo único seguro: que no ha contestado.
      setEstadoDominio('noResponde')
    }
  }
  const avisosColor = avisosDeContraste(web.colorPrimario, web.colorSecundario, web.tema)
  // Qué estilo está puesto ahora (null = combinación a medida).
  const puesto = estiloActual(web)

  /** Vuelca un estilo entero de golpe: plantilla, colores, letra, esquinas y aire. */
  function aplicarEstilo(e: EstiloWeb) {
    editarLote(`estilo:${e.id}`, cambiosDeEstilo(e))
  }

  /** Título a medida de una sección; vacío = el nombre de fábrica. */
  /*
   * La última sección movida y hacia dónde. Sirve para dos cosas: devolverle el
   * foco a su botón después de repintar, y marcarla un momento para que se vea
   * cuál se ha movido — sin eso, en una lista de quince filas iguales, un
   * intercambio no se distingue de que no haya pasado nada.
   */
  const [movida, setMovida] = useState<{ tipo: TipoSeccion; dir: -1 | 1 } | null>(null)
  useEffect(() => {
    if (!movida) return
    const boton = document.querySelector<HTMLButtonElement>(
      `[data-mover="${movida.tipo}:${movida.dir}"]`,
    )
    // Si ha llegado al extremo, su botón está desactivado y no puede recibir el
    // foco: se le da al del sentido contrario, que sigue ahí.
    const alterno = document.querySelector<HTMLButtonElement>(
      `[data-mover="${movida.tipo}:${movida.dir === -1 ? 1 : -1}"]`,
    )
    if (boton && !boton.disabled) boton.focus()
    else if (alterno && !alterno.disabled) alterno.focus()
    const t = setTimeout(() => setMovida(null), 900)
    return () => clearTimeout(t)
  }, [movida])

  function renombrarSeccion(i: number, nombre: string) {
    editar('secciones', (xs) => xs.map((s, idx) => (idx === i ? { ...s, nombre } : s)))
  }
  /*
   * MOVER UNA SECCIÓN ARRIBA O ABAJO.
   *
   * Con quince secciones, subir una desde el final son catorce pulsaciones —y
   * ahí estaba lo que se sentía «muy raro»: al intercambiar dos filas, el botón
   * que acabas de pulsar SE VA con su fila a la posición nueva. El cursor se
   * queda quieto, así que la segunda pulsación cae sobre el botón de OTRA
   * sección y mueves la que no era.
   *
   * Peor a teclado: al llegar arriba del todo el botón ▲ se desactiva, y un
   * botón desactivado pierde el foco — te devuelve al principio de la página.
   *
   * Se arregla recordando QUÉ sección se ha movido, no en qué posición estaba:
   * la posición cambia, la sección no. Después de repintar se le devuelve el
   * foco a su botón, así que pulsar cinco veces sube cinco puestos la misma
   * sección, como espera cualquiera.
   */
  function moverSeccion(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.secciones.length) return
    const secciones = [...web.secciones]
    ;[secciones[i], secciones[j]] = [secciones[j], secciones[i]]
    editar('secciones', secciones)
    setMovida({ tipo: web.secciones[i].tipo, dir })
  }
  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Publicación</h2></div>
        <label className={`interruptor${web.publicada ? ' interruptor--on' : ''}`}>
          <input type="checkbox" checked={web.publicada} onChange={(e) => editar('publicada', e.target.checked)} />
          <span className="interruptor__palanca" aria-hidden="true" />
          <span className="interruptor__texto">
            <b>{web.publicada ? 'Publicada' : 'Oculta'}</b>
            <small>{web.publicada ? 'Cualquiera con el enlace puede verla.' : 'Solo la ves tú desde aquí. Nadie más puede entrar.'}</small>
          </span>
        </label>
        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="slug">Enlace de tu web</label>
          <div className="assign-box__row">
            <span className="table-subtle">{window.location.origin}/w/</span>
            <input id="slug" type="text" value={web.slug} onChange={(e) => editar('slug', aSlug(e.target.value))} placeholder="mi-hermandad" />
            <button type="button" className="btn btn-outline btn-sm" onClick={copiarEnlace}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
        </div>

        <details className="afinar afinar--suelto">
          <summary className="afinar__cabeza">
            <span className="afinar__titulo">Usar un dominio propio</span>
            <span className="afinar__nota">{web.dominio || 'Opcional'}</span>
          </summary>
          <div className="afinar__cuerpo">
        <div className="form-row">
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
            // Se limpia lo que peguen: la gente copia la barra de direcciones
            // entera, con https:// y barra final, y eso es lo normal.
            onChange={(e) => editar('dominio', limpiarDominio(e.target.value))}
            placeholder="hermandaddetriana.es"
            aria-invalid={!!problemaDominio}
            aria-describedby={problemaDominio ? 'dominioError' : undefined}
          />
          {problemaDominio && (
            <p id="dominioError" className="aviso-falta__error-suelto">{explicarProblema(problemaDominio)}</p>
          )}
          {/* Con el campo vacío no había NADA: ni botón ni pista. Y como el
              ejemplo en gris parece un valor escrito, se queda uno esperando a
              que pase algo. Se dice cuál es el paso siguiente. */}
          {conDominioPropio && (web.dominio ?? '').trim() === '' && (
            <p className="form-hint">
              Escribe aquí vuestro dominio y guarda: entonces aparece el botón para avisarnos y
              darlo de alta.
            </p>
          )}
          {/* Comprobar de verdad que apunta aquí, en vez de fiarse de que lo
              escribieron bien: es lo único que despeja la duda de «¿ya está?». */}
          {conDominioPropio && (web.dominio ?? '').trim() !== '' && !problemaDominio && (
            <div className="dominio-check">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={estadoDominio === 'comprobando'}
                onClick={comprobarDominio}
              >
                {estadoDominio === 'comprobando' ? 'Comprobando…' : 'Comprobar si ya apunta aquí'}
              </button>
              {estadoDominio !== 'sinProbar' && estadoDominio !== 'comprobando' && (
                <p className={estadoDominio === 'apunta' ? 'form-hint form-hint--ok' : 'form-hint'}>
                  {estadoDominio === 'apunta' ? '✓ ' : ''}
                  {explicarEstado(estadoDominio, web.dominio ?? '')}
                </p>
              )}
              {/* Esto estaba dentro de dos desplegables cerrados, o sea que no
                  lo leía nadie, y es LA pega que se lleva todo el mundo.
                  Antes decía «añadidlos vosotros en Vercel», que es algo que la
                  hermandad NO puede hacer: ese paso es de quien lleva Gobergo.
                  Pedirle a alguien algo que no está en su mano es peor que no
                  decirle nada, porque se queda intentándolo. */}
              {/*
                * EL PASO QUE NO PUEDE DAR LA HERMANDAD.
                *
                * De los tres pasos del dominio, el de en medio —darlo de alta
                * en el servidor— solo lo puede hacer quien lleva Gobergo. La
                * pantalla decía «avísanos» y no daba forma de avisar: o no se
                * avisaba, o se avisaba por otro sitio y se perdía.
                */}
              <div className="dominio-aviso">
                {avisoDominio === 'enviado' ? (
                  <p className="form-hint form-hint--ok">
                    ✓ Avisado. Os damos de alta el dominio y os escribimos con los DNS que hay que
                    poner en vuestro registrador.
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={avisoDominio === 'mandando'}
                      onClick={pedirDominio}
                    >
                      {avisoDominio === 'mandando' ? 'Avisando…' : 'Avisar para que lo activen'}
                    </button>
                    <p className="form-hint">
                      Escrito el dominio, este es el siguiente paso: nos llega el aviso y lo damos
                      de alta.
                    </p>
                  </>
                )}
                {errorDominioAviso && (
                  <p className="aviso-falta__error-suelto">
                    {errorDominioAviso.texto}{' '}
                    <a href={errorDominioAviso.reserva}>Avisar desde mi correo</a>
                  </p>
                )}
              </div>
              <p className="form-hint">
                <b>El www va incluido.</b> Media España lo escribe, así que se dan de alta los dos
                (<code>{web.dominio}</code> y <code>www.{web.dominio}</code>) y uno lleva al otro.
                De eso nos encargamos nosotros.
              </p>
            </div>
          )}
          <details className="form-hint" style={{ marginTop: '0.5rem' }}>
            <summary>Cómo poner tu dominio propio (p. ej. hermandaddetriana.es)</summary>
            <ol style={{ margin: '0.5rem 0 0 1rem', lineHeight: 1.7 }}>
              <li><b>Vosotros:</b> comprad el dominio en un registrador (IONOS, GoDaddy, Namecheap…).</li>
              <li><b>Vosotros:</b> escribidlo aquí arriba y guardad.</li>
              <li><b>Vosotros:</b> dadle al botón de avisarnos, aquí mismo.</li>
              <li><b>Nosotros:</b> lo damos de alta en el servidor y os mandamos los DNS que hay que poner.</li>
              <li><b>Vosotros:</b> ponéis esos DNS en vuestro registrador.</li>
              <li>En unos minutos, quien escriba <b>vuestro dominio</b> ve vuestra web directamente.</li>
            </ol>
            <p style={{ marginTop: '0.4rem' }}>
              El candado de seguridad (HTTPS) se emite solo. No tenéis que comprar nada aparte ni
              renovarlo nunca.
            </p>
          </details>
        </div>
          </div>
        </details>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Estilo de tu web</h2></div>
        <p className="form-hint">
          Pulsa uno y la web queda hecha: plantilla, colores, letra, esquinas y aire, todo a la vez.
          Es lo único que hace falta tocar para que se vea bien.
        </p>
        <div className="estilos-grid">
          {ESTILOS.map((e) => {
            const c = cambiosDeEstilo(e)
            const par = PAREJAS_TIPOGRAFICAS.find((x) => x.id === e.pareja) ?? PAREJAS_TIPOGRAFICAS[0]
            const sel = puesto?.id === e.id
            return (
              <button
                type="button"
                key={e.id}
                className={`estilo-card${sel ? ' estilo-card--sel' : ''}`}
                onClick={() => aplicarEstilo(e)}
                aria-pressed={sel}
                title={e.descripcion}
              >
                <span
                  className={`estilo-card__previa estilo-card__previa--${e.tema} estilo-card__previa--${e.redondeo} estilo-card__previa--${e.plantilla} estilo-card__previa--aire-${e.densidad}`}
                  style={{ '--e1': c.colorPrimario, '--e2': c.colorSecundario } as CSSProperties}
                  aria-hidden="true"
                >
                  <span className="estilo-card__barra"><i /><i /><i /></span>
                  <span className="estilo-card__cuerpo">
                    <span className="estilo-card__titular" style={{ fontFamily: par.titulos }}>Hermandad</span>
                    <span className="estilo-card__linea" />
                    <span className="estilo-card__linea estilo-card__linea--corta" />
                    <span className="estilo-card__boton" />
                  </span>
                </span>
                <span className="estilo-card__pie">
                  <b>{e.nombre}{sel && <span className="estilo-card__marca" aria-hidden="true">✓</span>}</b>
                  <small>{e.descripcion}</small>
                </span>
              </button>
            )
          })}
        </div>
        {!puesto && (
          <p className="form-hint estilo-medida">
            Ahora mismo tienes una combinación <b>a medida</b>. Pulsa un estilo si prefieres volver a
            uno de los preparados.
          </p>
        )}
      </section>

      {/* Todo lo de abajo es opcional: con el estilo de arriba la web ya está.
          Va plegado para que la pantalla no asuste a quien entra por primera vez. */}
      <details className="afinar">
        <summary className="afinar__cabeza">
          <span className="afinar__titulo">Afinar a mano</span>
          <span className="afinar__nota">Plantilla, colores exactos, tipografía, esquinas y aire</span>
        </summary>
        <div className="afinar__cuerpo">
          <div className="afinar__bloque">
            <h3 className="afinar__h">Plantilla</h3>
            <div className="plantillas-grid">
              {PLANTILLAS.map((pl) => (
                <button type="button" key={pl.id} className={`plantilla-card${web.plantilla === pl.id ? ' plantilla-card--sel' : ''}`} onClick={() => editar('plantilla', pl.id as PlantillaWeb)}>
                  <span className={`plantilla-card__mini plantilla-card__mini--${pl.id}`} aria-hidden="true"><span /><span /><span /></span>
                  <b>{pl.nombre}</b><small>{pl.descripcion}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="afinar__bloque">
            <h3 className="afinar__h">Paleta de color</h3>
            <div className="paletas-grid">
              {PALETAS.map((pal) => {
                const puesta = web.colorPrimario.toLowerCase() === pal.primario.toLowerCase()
                  && web.colorSecundario.toLowerCase() === pal.secundario.toLowerCase()
                return (
                  <button
                    type="button"
                    key={pal.id}
                    className={`paleta-card${puesta ? ' paleta-card--sel' : ''}`}
                    onClick={() => editarLote(`paleta:${pal.id}`, { colorPrimario: pal.primario, colorSecundario: pal.secundario })}
                    aria-pressed={puesta}
                  >
                    <span className="paleta-card__muestra">
                      <span style={{ background: pal.primario }} />
                      <span style={{ background: pal.secundario }} />
                    </span>
                    <b>{pal.nombre}</b>
                  </button>
                )
              })}
            </div>

            <div className="form-grid-2" style={{ marginTop: '0.8rem' }}>
              <div className="form-row"><label htmlFor="c1">Color principal</label><input id="c1" type="color" value={web.colorPrimario} onChange={(e) => editar('colorPrimario', e.target.value)} /></div>
              <div className="form-row"><label htmlFor="c2">Color secundario</label><input id="c2" type="color" value={web.colorSecundario} onChange={(e) => editar('colorSecundario', e.target.value)} /></div>
            </div>
            {/* Aviso de legibilidad: eligiendo a mano es facilísimo dejar la web
                ilegible sin darse cuenta, y no se ve hasta que alguien se queja. */}
            {avisosColor.length > 0 ? (
              <ul className="contraste-avisos">
                {avisosColor.map((a) => <li key={a}>{a}</li>)}
              </ul>
            ) : (
              <p className="contraste-ok">✓ Con estos colores se lee bien sobre el fondo {web.tema}.</p>
            )}
          </div>

          <div className="afinar__bloque">
            <h3 className="afinar__h">Tipografía</h3>
            <div className="parejas-grid">
              {PAREJAS_TIPOGRAFICAS.map((par) => (
                <button
                  type="button"
                  key={par.id}
                  className={`pareja-card${web.pareja === par.id ? ' pareja-card--sel' : ''}`}
                  onClick={() => editar('pareja', par.id)}
                  aria-pressed={web.pareja === par.id}
                >
                  <span className="pareja-card__muestra">
                    <span style={{ fontFamily: par.titulos }}>Hermandad</span>
                    <small style={{ fontFamily: par.texto }}>Estación de penitencia</small>
                  </span>
                  <b>{par.nombre}</b>
                  <small>{par.nota}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="afinar__bloque">
            <h3 className="afinar__h">Fondo, esquinas y aire</h3>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="tema">Fondo</label>
                <select id="tema" value={web.tema} onChange={(e) => editar('tema', e.target.value as TemaWeb)}>
                  <option value="claro">Claro</option>
                  <option value="oscuro">Oscuro</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="redondeo">Esquinas</label>
                <select id="redondeo" value={web.redondeo} onChange={(e) => editar('redondeo', e.target.value as WebPublica['redondeo'])}>
                  <option value="recto">Rectas (sobrio)</option>
                  <option value="suave">Suaves</option>
                  <option value="redondo">Muy redondeadas</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="densidad">Aire entre secciones</label>
              <select id="densidad" value={web.densidad} onChange={(e) => editar('densidad', e.target.value as WebPublica['densidad'])}>
                <option value="compacta">Compacta (cabe más en pantalla)</option>
                <option value="normal">Normal</option>
                <option value="amplia">Amplia (más elegante)</option>
              </select>
            </div>
          </div>

          <div className="afinar__bloque">
            <h3 className="afinar__h">Ritmo de la página</h3>
            <p className="form-hint">
              Lo que evita que la web sea una columna de texto centrado, una sección detrás de otra.
            </p>
            <label className="checkbox">
              <input type="checkbox" checked={web.fondosAlternos} onChange={(e) => editar('fondosAlternos', e.target.checked)} />
              <span>Franjas de fondo alternas, para que las secciones se separen solas</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={web.letraCapital} onChange={(e) => editar('letraCapital', e.target.checked)} />
              <span>Letra capital al empezar cada sección, como en el boletín impreso</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={web.animaciones} onChange={(e) => editar('animaciones', e.target.checked)} />
              <span>Los bloques entran suavemente al bajar</span>
            </label>
            <p className="form-hint">
              A quien tenga puesto «reducir movimiento» en su móvil u ordenador no se le anima nada,
              lo marques o no.
            </p>
          </div>
        </div>
      </details>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Identidad</h2></div>
        <div className="form-row">
          <label>Escudo o logo</label>
          <div className="assign-box__row">
            {web.logoDataUrl && <img src={web.logoDataUrl} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />}
            <label className="btn btn-outline btn-sm">{web.logoDataUrl ? 'Cambiar' : 'Subir logo'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('logoDataUrl', d))} /></label>
            {web.logoDataUrl && <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('logoDataUrl', null)}>Quitar</button>}
          </div>
        </div>
        <div className="form-row"><label htmlFor="titulo">Nombre</label><input id="titulo" type="text" value={web.titulo} onChange={(e) => editar('titulo', e.target.value)} /></div>
        <div className="form-row"><label htmlFor="lema">Lema</label><input id="lema" type="text" value={web.lema} onChange={(e) => editar('lema', e.target.value)} placeholder="Fe, tradición y caridad" /></div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Secciones (orden y visibilidad)</h2>
          {web.secciones.some((s) => s.visible && s.borrador) && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => editarLote('secciones', { secciones: web.secciones.map((s) => ({ ...s, borrador: false })) })}
            >
              Publicar los borradores
            </button>
          )}
        </div>
        <ul className="secciones-lista">
          {web.secciones.map((s, i) => (
            <li
              key={s.tipo}
              className={`seccion-item${movida?.tipo === s.tipo ? ' seccion-item--movida' : ''}`}
            >
              <span className="seccion-item__nom">
                {SECCIONES_INFO[s.tipo].nombre}
                {s.visible && s.borrador && <span className="cms-borrador">Borrador</span>}
              </span>
              {/* Tres estados en vez de un interruptor: publicada, en borrador
                  (se ve aquí pero no en la web) y oculta del todo. */}
              <select
                className="seccion-item__estado"
                value={!s.visible ? 'oculta' : s.borrador ? 'borrador' : 'publicada'}
                onChange={(e) => {
                  const v = e.target.value
                  editar('secciones', (xs) => xs.map((x, j) => (
                    j !== i ? x : { ...x, visible: v !== 'oculta', borrador: v === 'borrador' }
                  )))
                }}
                aria-label={`Estado de ${SECCIONES_INFO[s.tipo].nombre}`}
              >
                <option value="publicada">Publicada</option>
                <option value="borrador">En borrador</option>
                <option value="oculta">Oculta</option>
              </select>
              <input
                className="seccion-item__nombre"
                type="text"
                value={s.nombre ?? ''}
                onChange={(e) => renombrarSeccion(i, e.target.value)}
                placeholder={`Se verá como «${SECCIONES_INFO[s.tipo].publico}»`}
                aria-label={`Título a medida para ${SECCIONES_INFO[s.tipo].nombre}`}
              />
              <span className="seccion-item__orden">
                {/* La marca lleva el TIPO, no la posición: la posición es justo
                    lo que acaba de cambiar. */}
                <button
                  type="button" className="icon-btn" data-mover={`${s.tipo}:-1`}
                  onClick={() => moverSeccion(i, -1)} disabled={i === 0}
                  aria-label={`Subir ${SECCIONES_INFO[s.tipo].nombre}`}
                >▲</button>
                <button
                  type="button" className="icon-btn" data-mover={`${s.tipo}:1`}
                  onClick={() => moverSeccion(i, 1)} disabled={i === web.secciones.length - 1}
                  aria-label={`Bajar ${SECCIONES_INFO[s.tipo].nombre}`}
                >▼</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

    </>
  )
}

/* ----------------------------- Hazte hermano ----------------------------- */
/** Una lista de líneas sueltas (requisitos, pasos) se edita como un textarea. */
