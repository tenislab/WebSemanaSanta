import { useState } from 'react'
import { useDocumentosWeb, descargarDocumentoWeb } from '../../lib/documentosWeb'
import { formatearTamano } from '../../lib/filestore'
import { type WebPublica } from '../../lib/webPublica'

/**
 * LOS DOCUMENTOS QUE LA HERMANDAD PUBLICA EN SU WEB.
 *
 * Salen del ARCHIVO DOCUMENTAL, no de una lista aparte: se suben una vez en el
 * panel y ahí mismo se dice hasta dónde llegan. Es la diferencia con la
 * sección de «Boletines», que tiene su propia lista en el editor de la web y
 * su portada; esto son las reglas, el reglamento de régimen interno y lo que la
 * hermandad quiera colgar sin tener que volver a subirlo.
 *
 * NO HACE FALTA CUENTA. Lo que llega aquí es lo que la hermandad ha marcado
 * para la web, y lo sirve una función de la base que solo responde por una web
 * publicada. Un acta no llega nunca: ni a la lista, ni a la descarga.
 *
 * EL PDF NO SE ENLAZA, SE BAJA. El cubo de archivos no es público, así que una
 * dirección directa daría «not found» al pulsarla — que es peor que no ofrecer
 * el enlace. Se pide al cliente, que es lo que le da algo que autorizar a la
 * política del visitante.
 */
export function Documentos({ web, interactivo }: { web: WebPublica; interactivo: boolean }) {
  const { documentos, cargando } = useDocumentosWeb(web.slug)
  const [bajando, setBajando] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  if (cargando) return <p className="sitio__entradilla">Cargando los documentos…</p>
  if (documentos.length === 0) {
    /*
     * EN LA VISTA PREVIA DEL PANEL se dice qué falta; en la web de verdad no
     * se pinta nada. Una hermandad que enciende la sección y no ve nada no
     * tiene forma de saber si está mal la sección o es que no ha marcado
     * ningún documento — y es siempre lo segundo.
     */
    /* `interactivo` es la web de verdad; `!interactivo`, la vista previa. Ahí
       se dice qué falta; en la web no se pinta nada. */
    return interactivo ? null : (
      <p className="sitio__entradilla">
        Todavía no has marcado ningún documento para la web. Se hace en «Archivo documental»: abre
        el documento y pon «Hasta dónde sale → La web pública».
      </p>
    )
  }

  async function bajar(id: string, comoSeLlama: string) {
    setFallo(null)
    setBajando(id)
    try {
      const blob = await descargarDocumentoWeb(web.slug, id)
      if (!blob) {
        setFallo('Ese documento no se ha podido descargar. Inténtalo de nuevo en un rato.')
        return
      }
      /*
       * SE DESCARGA CON SU NOMBRE, no con el identificador de la base: un PDF
       * llamado `44444444-0000-...` en la carpeta de descargas de alguien no
       * se vuelve a abrir nunca.
       */
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = comoSeLlama
      a.rel = 'noopener'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setFallo('Ese documento no se ha podido descargar. Inténtalo de nuevo en un rato.')
    } finally {
      setBajando(null)
    }
  }

  return (
    <>
      <ul className="sitio-documentos">
        {documentos.map((d) => (
          <li key={d.id} className="sitio-documentos__item">
            <div className="sitio-documentos__que">
              <b>{d.nombre}</b>
              <span className="sitio-documentos__dato">
                {d.categoria}
                {d.fecha && ` · ${d.fecha}`}
                {d.archivoTamano ? ` · ${formatearTamano(d.archivoTamano)}` : ''}
              </span>
              {d.descripcion && <p className="sitio-documentos__nota">{d.descripcion}</p>}
            </div>
            {d.archivoNombre ? (
              <button
                type="button"
                className="sitio-btn sitio-btn--suave"
                /*
                  OJO CON EL SENTIDO DE `interactivo`: es `true` en la web DE
                  VERDAD —donde los enlaces navegan— y `false` en la vista
                  previa del panel. Lo escribí al revés en la primera versión y
                  el resultado era un botón «Descargar» apagado para todos los
                  visitantes y activo solo en la vista previa, donde no hay nada
                  que descargar. Se vio comprobando el valor en vez de
                  suponerlo: la sonda decía que en la vista previa el botón
                  estaba encendido, y eso era justo la señal.
                */
                disabled={!interactivo || bajando === d.id}
                onClick={() => void bajar(d.id, d.archivoNombre ?? `${d.nombre}.pdf`)}
              >
                {bajando === d.id ? 'Descargando…' : 'Descargar'}
              </button>
            ) : (
              <span className="sitio-documentos__dato">Sin archivo</span>
            )}
          </li>
        ))}
      </ul>
      {fallo && <p className="sitio__entradilla">{fallo}</p>}
    </>
  )
}
