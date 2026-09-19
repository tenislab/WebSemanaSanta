import { fechaBonita, recorta } from './texto'
import { BotonEntrar, FotoConMarca } from './piezas'
import { diasHasta as diasHastaFecha, estadoDeLaCampana, getCampana, ventanaAbierta } from '../../lib/campana'
import { diasHasta, slugNoticia, slugTitular, titularConFicha, type CultoWeb, type Noticia, type Titular, type WebPublica } from '../../lib/webPublica'

/**
 * LA PORTADA: LOS BLOQUES DE ARRIBA Y LAS TARJETAS.
 *
 * Los bloques que la hermandad coloca en la portada, la ficha de un titular y
 * la tarjeta de una noticia. Igual que en el editor, donde «Portada» y
 * «Titulares» son sus dos pestañas.
 */

/**
 * Los tres bloques de la portada: la cuenta atrás a la salida, el próximo culto
 * y las cifras de la hermandad. Es lo que se pregunta la gente al entrar («¿qué
 * día salen?», «¿cuándo es el próximo culto?») y hasta ahora había que bajar a
 * buscarlo, si es que estaba.
 */
export function BloquesPortada({
  web,
  cultos,
  interactivo,
}: {
  web: WebPublica
  cultos: CultoWeb[]
  interactivo: boolean
}) {
  // Si la hermandad no ha escrito la fecha en la web, se usa la de la campaña
  // del panel: ya la tienen puesta ahí y no hay por qué pedirla dos veces.
  const dias = diasHasta(web.estacion.fechaSalida || getCampana().fechaSalida || undefined)
  // Solo cuentan los cultos con fecha de verdad: los escritos a mano llevan
  // texto libre («del 3 al 7 de marzo») y no se pueden ordenar.
  const proximo = cultos.find((c) => c.fechaIso)
  const cifras = web.cifras.filter((c) => c.numero.trim() || c.texto.trim())
  const hayCuenta = web.cuentaAtras && dias !== null && dias >= 0
  const hayProximo = web.proximoCulto && Boolean(proximo)
  // El reparto de papeletas es LO que la gente busca en la web esas semanas.
  // Sale solo mientras la ventana está abierta, con los días que quedan: un
  // aviso que sigue puesto en mayo no lo lee nadie el año siguiente.
  const campana = getCampana()
  /*
   * En la web pública, igual: el aviso de «ya puedes sacar tu papeleta» no
   * puede salir por unas fechas de ejemplo. Ahí lo lee cualquiera.
   */
  const hayCampana = estadoDeLaCampana() === 'creada'
  const abierta = web.avisoPapeletas && ventanaAbierta(campana, hayCampana)
  const diasPapeleta = abierta ? diasHastaFecha(campana.fechaLimiteRenovacion) : -1
  if (!hayCuenta && !hayProximo && cifras.length === 0 && !abierta) return null
  return (
    <div className="sitio__portada">
      {abierta && (
        <div className="sitio__papeletas">
          <span className="sitio__papeletas-ante">Papeleta de sitio</span>
          <h3>El reparto está abierto</h3>
          <p>
            {diasPapeleta === 0
              ? 'Hoy es el último día para sacarla.'
              : diasPapeleta === 1
                ? 'Queda un día para sacarla.'
                : `Quedan ${diasPapeleta} días para sacarla.`}
          </p>
          <BotonEntrar interactivo={interactivo} clase="sitio-btn sitio-btn--sm">
            Sacar mi papeleta
          </BotonEntrar>
        </div>
      )}
      {hayCuenta && (
        <div className="sitio__cuenta">
          <span className="sitio__cuenta-num">{dias}</span>
          <span className="sitio__cuenta-txt">
            {dias === 0 ? 'Hoy es el día' : dias === 1 ? 'día para la salida' : 'días para la salida'}
          </span>
          {(web.estacion.dia.trim() || web.estacion.horaSalida.trim()) && (
            <span className="sitio__cuenta-pie">
              {[web.estacion.dia.trim(), web.estacion.horaSalida.trim()].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}
      {hayProximo && proximo && (
        <div className="sitio__proximo">
          <span className="sitio__proximo-ante">Próximo culto</span>
          <h3>{proximo.titulo}</h3>
          <p className="sitio__proximo-cuando">{proximo.fecha}</p>
          {proximo.lugar.trim() && <p className="sitio__proximo-donde">{proximo.lugar}</p>}
          <a className="sitio__seguir" href={interactivo ? '#cultos' : undefined}>Ver todos los cultos →</a>
        </div>
      )}
      {cifras.length > 0 && (
        <div className="sitio__cifras">
          {cifras.map((c) => (
            <div key={c.id}>
              <strong>{c.numero}</strong>
              <span>{c.texto}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Una noticia en el listado. Con enlace propio: es lo que se pega en redes, y
 * hasta ahora la única forma de compartir una noticia era mandar la web entera.
 */
/**
 * Un titular a lo ancho: foto grande a un lado y su texto al otro, alternando
 * el lado en cada uno. Antes eran tres líneas centradas en una rejilla de
 * tarjetas, y es la sección con más devoción detrás de toda la web.
 */
export function BloqueTitular({
  titular: t,
  vuelto,
  baseWeb,
  marca,
  interactivo,
}: {
  titular: Titular
  /** La foto a la derecha en vez de a la izquierda. */
  vuelto?: boolean
  /** De dónde cuelgan las páginas de esta web: '' con dominio propio, '/w/<slug>' si no. */
  baseWeb: string
  /** Texto de la marca de agua; vacío = sin marca. */
  marca: string
  interactivo: boolean
}) {
  const parrafos = (t.parrafos ?? []).filter((p) => p.texto.trim() || p.subtitulo.trim())
  const conFicha = titularConFicha(t)
  const enlace = `${baseWeb}/t/${slugTitular(t)}`
  // En la portada se asoma el arranque de su historia; el resto vive en la
  // ficha, para que la sección no se convierta en un muro de texto.
  const asomo = parrafos.find((p) => p.texto.trim())?.texto ?? ''
  return (
    <article className={`sitio__titular${vuelto ? ' sitio__titular--vuelto' : ''}`}>
      {t.fotoDataUrl && (
        <figure className="sitio__titular-foto">
          <FotoConMarca src={t.fotoDataUrl} alt={t.alt?.trim() || t.nombre} marca={marca} />
          {t.credito?.trim() && <figcaption>Foto: {t.credito}</figcaption>}
        </figure>
      )}
      <div className="sitio__titular-texto">
        <h3>{t.nombre}</h3>
        {t.autoria?.trim() && <p className="sitio__autoria">{t.autoria}</p>}
        {t.descripcion.trim() && <p className="sitio__entradilla">{t.descripcion}</p>}
        {asomo && <p className="sitio__texto">{recorta(asomo, 300)}</p>}
        {conFicha && (
          <a className="sitio__seguir" href={interactivo ? enlace : undefined}>
            Conoce su historia →
          </a>
        )}
      </div>
    </article>
  )
}

export function TarjetaNoticia({
  noticia: n,
  interactivo,
  baseWeb,
  grande = false,
}: {
  noticia: Noticia
  interactivo: boolean
  /** De dónde cuelgan las páginas de esta web: '' con dominio propio, '/w/<slug>' si no. */
  baseWeb: string
  grande?: boolean
}) {
  const enlace = `${baseWeb}/n/${slugNoticia(n)}`
  const tieneCuerpo = (n.parrafos ?? []).some((p) => p.texto.trim())
  return (
    <article className={`sitio__noticia${grande ? ' sitio__noticia--grande' : ''}`}>
      {n.fotoDataUrl && <img src={n.fotoDataUrl} alt={n.altFoto ?? ''} loading="lazy" decoding="async" />}
      <div>
        <span className="sitio__noticia-fecha">{fechaBonita(n.fecha)}</span>
        <h3>
          {tieneCuerpo && interactivo ? <a href={enlace}>{n.titulo}</a> : n.titulo}
        </h3>
        <p>{n.resumen}</p>
        {tieneCuerpo && (
          <a className="sitio__seguir" href={interactivo ? enlace : undefined}>Seguir leyendo →</a>
        )}
      </div>
    </article>
  )
}
