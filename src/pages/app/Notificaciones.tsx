import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CLAVES_DATOS } from '../../lib/persistencia'
import { useSupabaseTable } from '../../lib/supabaseSync'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import { CUOTAS_INICIALES, type Cuota } from '../../data/cuotas'
import { PAPELETAS_INICIALES, type Papeleta } from '../../data/papeletas'
import { hermanoToRow, rowToHermano } from '../../lib/db/hermanos'
import { cuotaToRow, rowToCuota } from '../../lib/db/cuotas'
import { papeletaToRow, rowToPapeleta } from '../../lib/db/papeletas'
import { useSolicitudes, saveSolicitudes, type SolicitudAlta } from '../../lib/solicitudes'
import { getSolicitudesPapeleta } from '../../lib/solicitudesPapeleta'
import { avisosPendientes, avisosPorTipo, type Aviso } from '../../lib/notificaciones'
import { hoyIso } from '../../lib/hoy'
import { useConceptosCuota } from '../../lib/conceptosCuota'
import { ultimoEjercicio } from '../../lib/cuotasEmision'

/**
 * NOTIFICACIONES — lo que espera a que la junta haga algo.
 *
 * Llegó dicho así: «he mandado una solicitud de crear nuevo hermano y no están
 * en ningún lado» y «hacemos panel de notificaciones donde van todo eso».
 *
 * Cada cosa que espera respuesta seguía viviendo en el módulo donde se
 * resuelve, que es lo lógico mientras trabajas y lo peor cuando no sabes que
 * hay algo esperando: para enterarse de que alguien pidió el alta había que
 * entrar en Hermanos a mirar. Un aviso que hay que ir a buscar no es un aviso.
 *
 * Esta pantalla NO mueve nada de su sitio. Cada cosa se sigue pudiendo
 * resolver donde estaba; aquí se juntan y se pueden despachar de una vez.
 *
 * La lista la arma `src/lib/notificaciones.ts`, que es puro y está probado
 * aparte: lo que decide qué entra y qué no —lo resuelto NO entra— no depende
 * de esta pantalla.
 */
export default function Notificaciones() {
  const [hermanos] = useSupabaseTable<Hermano>(
    'hermanos', CLAVES_DATOS.hermanos, HERMANOS_INICIALES, hermanoToRow, rowToHermano, 'numero',
  )
  const [cuotas, setCuotas] = useSupabaseTable<Cuota>(
    'cuotas', CLAVES_DATOS.cuotas, CUOTAS_INICIALES, cuotaToRow, rowToCuota,
  )
  const [papeletas, setPapeletas] = useSupabaseTable<Papeleta>(
    'papeletas', CLAVES_DATOS.papeletas, PAPELETAS_INICIALES, papeletaToRow, rowToPapeleta,
  )
  const solicitudesRemotas = useSolicitudes()
  const [solicitudes, setSolicitudes] = useState<SolicitudAlta[]>(solicitudesRemotas)
  const peticionesPapeleta = useMemo(() => getSolicitudesPapeleta(), [])

  // Lo traído de la base manda sobre lo que hubiera en pantalla.
  const listaSolicitudes = solicitudes.length > 0 || solicitudesRemotas.length === 0
    ? solicitudes : solicitudesRemotas

  const [hecho, setHecho] = useState<string>('')

  /*
   * Para poder avisar de quién no tiene cuota hacen falta el ejercicio y el
   * concepto. Se toman del ÚLTIMO ejercicio con recibos emitidos y del primer
   * concepto del catálogo de la hermandad, que es el de la cuota anual.
   *
   * Si no hay ni uno ni otro, el aviso no sale. Es a propósito: una hermandad
   * que todavía no ha emitido nunca no tiene a nadie «sin cuota» —no le toca
   * aún—, y decirle que le faltan cuarenta cuotas el primer día sería
   * asustarla con un problema que no tiene.
   */
  const conceptos = useConceptosCuota()
  const ejercicio = useMemo(() => ultimoEjercicio(cuotas), [cuotas])
  const conceptoCuota = conceptos[0]?.nombre ?? null

  const avisos = useMemo(
    () => avisosPendientes({
      solicitudes: listaSolicitudes, cuotas, papeletas, peticionesPapeleta, hermanos,
      ejercicio, conceptoCuota,
    }),
    [listaSolicitudes, cuotas, papeletas, peticionesPapeleta, hermanos, ejercicio, conceptoCuota],
  )
  const grupos = useMemo(() => avisosPorTipo(avisos), [avisos])

  /**
   * Aceptar. Lo que hace depende de qué sea, y en los dos pagos es lo que se
   * pidió: «si ha llegado que le dé a aceptar y automáticamente se ponga como
   * pagada para ese hermano». Sin ir a buscarla.
   */
  function aceptar(a: Aviso) {
    if (a.tipo === 'pagoCuota') {
      setCuotas(cuotas.map((c) => (c.id === a.refId
        ? { ...c, estado: 'Pagada' as const, fechaPago: hoyIso(), pagoComunicado: null }
        : c)))
      setHecho(`Cuota de ${a.titulo.split(' ha pagado')[0]} dada por cobrada.`)
      return
    }
    if (a.tipo === 'pagoPapeleta') {
      setPapeletas(papeletas.map((p) => (p.id === a.refId
        ? { ...p, estado: 'Pagada' as const, pagoComunicado: null }
        : p)))
      setHecho(`Papeleta dada por pagada.`)
      return
    }
    /*
     * El alta y la petición de papeleta NO se resuelven aquí: crear un hermano
     * pide número, antigüedad y cuota, y asignar sitio pide ver el cortejo.
     * Meter aquí una versión reducida de esas dos pantallas sería tener el
     * mismo formulario en dos sitios, y uno de los dos se quedaría atrás.
     */
    setHecho('')
  }

  function rechazar(a: Aviso) {
    if (a.tipo !== 'altaHermano') return
    const next = listaSolicitudes.map((s) => (
      s.id === a.refId ? { ...s, estado: 'Rechazada' as const } : s
    ))
    setSolicitudes(next)
    void saveSolicitudes(next)
    setHecho('Solicitud rechazada.')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Notificaciones</p>
          <h1>{avisos.length === 0 ? 'No hay nada esperando' : 'Esto espera por vosotros'}</h1>
          <p className="page-lead">
            {avisos.length === 0
              ? 'Cuando alguien pida entrar en la hermandad, pida su papeleta o avise de que ha '
                + 'pagado, aparecerá aquí.'
              : `${avisos.length} ${avisos.length === 1 ? 'cosa' : 'cosas'} por resolver. `
                + 'Cada una se puede despachar desde aquí o abrirse en su pantalla.'}
          </p>
        </div>
      </header>

      {hecho && (
        <div className="banner-inline banner-inline--ok" role="status">
          <span>{hecho}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHecho('')}>Vale</button>
        </div>
      )}

      {grupos.map((g) => (
        <section className="card" key={g.tipo}>
          <h2 className="card-title">
            {g.titulo} <span className="pill pill--info">{g.avisos.length}</span>
          </h2>
          <ul className="avisos">
            {g.avisos.map((a) => (
              <li className="aviso" key={a.id}>
                <div className="aviso__que">
                  <b>{a.titulo}</b>
                  {a.detalle && <span className="table-subtle">{a.detalle}</span>}
                </div>
                <div className="aviso__acciones">
                  {a.rechazar && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => rechazar(a)}>
                      {a.rechazar}
                    </button>
                  )}
                  {/*
                    Los dos pagos se resuelven aquí de un clic. El alta y la
                    petición de papeleta llevan a su pantalla, porque hace falta
                    lo que allí se pide (número, antigüedad, sitio en el
                    cortejo) y no cabe en una fila.
                  */}
                  {a.tipo === 'pagoCuota' || a.tipo === 'pagoPapeleta' ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => aceptar(a)}>
                      {a.aceptar}
                    </button>
                  ) : (
                    <Link className="btn btn-primary btn-sm" to={a.donde}>{a.aceptar}</Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {avisos.length === 0 && (
        <section className="card">
          <p className="table-subtle" style={{ margin: 0 }}>
            Si esperabas ver aquí una solicitud de alta que mandaste y no está, puede que no
            llegara a guardarse. Revisa que no salga el aviso rojo de «no se ha podido guardar en
            la base de datos» al usar la aplicación.
          </p>
        </section>
      )}
    </div>
  )
}
