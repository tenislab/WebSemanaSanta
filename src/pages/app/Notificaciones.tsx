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
import { useSolicitudesPapeleta } from '../../lib/solicitudesPapeleta'
import { avisosPendientes, avisosPorTipo, type Aviso } from '../../lib/notificaciones'
import { hoyIso } from '../../lib/hoy'
import { useConceptosCuota } from '../../lib/conceptosCuota'
import { ejercicioDeCuotas } from '../../lib/cuotasEmision'
import { resolverSolicitud, MOTIVOS_DE_RECHAZO } from '../../lib/familia'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { conApunteDeCobro, origenDeCuota, origenDePapeleta } from '../../lib/apuntes'

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
  /*
   * EL LIBRO DE CUENTAS, porque desde aquí se da dinero por cobrado.
   *
   * Aceptar el aviso de «he pagado por Bizum» dejaba la cuota en Pagada y no
   * apuntaba nada: el dinero entraba y Tesorería no lo veía. Es el mismo
   * agujero que ya se tapó en Papeletas, en otra pantalla.
   */
  const [, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento,
  )
  const solicitudesRemotas = useSolicitudes()
  const [solicitudes, setSolicitudes] = useState<SolicitudAlta[]>(solicitudesRemotas)
  /*
   * DE LA BASE, NO DE LA COPIA DE ESTE NAVEGADOR.
   *
   * Esto era `useMemo(() => getSolicitudesPapeleta(), [])`, que lee lo que
   * hubiera guardado ESTE ordenador la última vez, una sola vez al montar. Y la
   * solicitud la manda el hermano DESDE SU MÓVIL: en el navegador de secretaría
   * no ha estado nunca.
   *
   * Resultado exacto de lo que se reportó: «se solicita papeleta a través de
   * cuenta de hermano y la notificación no llega a Notificaciones, si llega al
   * apartado Papeletas». Papeletas montaba el hook de verdad; esta pantalla no.
   *
   * Y el aviso que no sale es peor que en otros sitios: esta pantalla existe
   * precisamente para no tener que ir a buscar a cada módulo si hay algo
   * esperando. Un aviso que no aparece aquí es un hermano sin sitio en la
   * cofradía porque nadie vio su petición.
   */
  const [peticionesPapeleta] = useSolicitudesPapeleta()

  // Lo traído de la base manda sobre lo que hubiera en pantalla.
  const listaSolicitudes = solicitudes.length > 0 || solicitudesRemotas.length === 0
    ? solicitudes : solicitudesRemotas

  const [hecho, setHecho] = useState<string>('')
  /* Qué aviso se está rechazando y con qué motivo. */
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

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
  /*
   * El último ejercicio con recibos, y si no hay NINGUNO, el año en curso.
   *
   * Ese respaldo es el que arregla el caso peor. Dije que una hermandad sin
   * cuotas emitidas «no tiene a nadie sin cuota porque no le toca aún», y es
   * falso: una hermandad con el censo metido y cero recibos es EXACTAMENTE la
   * que necesita que se lo digan. Sin el respaldo, el aviso callaba justo ahí
   * —que es donde llegó reportado como «cuotas sigue sin actualizarse bien»—.
   *
   * Y no aparece de la nada en una hermandad recién creada: sin hermanos,
   * `hermanosSinCuota()` no devuelve a nadie y no hay aviso.
   */
  const ejercicio = useMemo(() => ejercicioDeCuotas(cuotas), [cuotas])
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
      /*
       * Y AL LIBRO. El método es el que dijo el hermano al avisar —Bizum,
       * transferencia, en mano—, no uno inventado: de él depende si el dinero
       * entra en Caja o en el banco, y de eso depende que el tesorero lo
       * encuentre al conciliar.
       */
      const c = cuotas.find((x) => x.id === a.refId)
      if (c) {
        setMovimientos((prev) => conApunteDeCobro(prev, {
          origen: origenDeCuota(c.id),
          concepto: `${c.concepto} — ${hermanos.find((h) => h.id === c.hermanoId)?.nombre ?? 'hermano/a'}`,
          categoria: 'Cuotas Hermanos/as',
          importe: c.importe,
          fecha: hoyIso(),
          metodo: c.pagoComunicado?.metodo ?? c.metodoCobro,
        }))
      }
      setHecho(`Cuota de ${a.titulo.split(' ha pagado')[0]} dada por cobrada.`)
      return
    }
    if (a.tipo === 'pagoPapeleta') {
      setPapeletas(papeletas.map((p) => (p.id === a.refId
        ? { ...p, estado: 'Pagada' as const, pagoComunicado: null }
        : p)))
      const p = papeletas.find((x) => x.id === a.refId)
      if (p) {
        setMovimientos((prev) => conApunteDeCobro(prev, {
          origen: origenDePapeleta(p.id),
          concepto: `Papeleta de sitio ${p.anio} — ${hermanos.find((h) => h.id === p.hermanoId)?.nombre ?? 'hermano/a'}`,
          categoria: 'Papeletas de Sitio',
          importe: p.importe,
          fecha: hoyIso(),
          metodo: p.pagoComunicado?.metodo ?? p.metodoPago,
        }))
      }
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

  /**
   * Rechazar PIDE EL PORQUÉ, igual que en Hermanos.
   *
   * Que las dos pantallas se comporten igual no es un capricho: si una de las
   * dos rechazara sin preguntar, el hermano recibiría un «no» mudo o
   * explicado según por dónde hubiera pasado la secretaría ese día. Las dos
   * llaman a `resolverSolicitud`, que es quien decide qué se guarda.
   */
  function rechazar(a: Aviso, motivo: string) {
    if (a.tipo !== 'altaHermano') return
    const next = listaSolicitudes.map((s) => (
      s.id === a.refId ? resolverSolicitud(s, 'Rechazada', motivo) : s
    ))
    setSolicitudes(next)
    void saveSolicitudes(next)
    setRechazando(null)
    setMotivo('')
    setHecho('Solicitud rechazada. Quien la mandó verá el motivo en su área.')
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
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setRechazando(a.id); setMotivo('') }}
                    >
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
                    /*
                      El alta se completa de verdad: se va a Hermanos con el
                      identificador y allí se aprueba sola, reutilizando la
                      misma función que ya lo hacía —número correlativo,
                      control de DNI repetido, cuenta de acceso y correo de
                      bienvenida—. Copiar aquí esa lógica sería tener dos altas
                      distintas y una se quedaría atrás.
                    */
                    <Link
                      className="btn btn-primary btn-sm"
                      to={a.tipo === 'altaHermano' ? `${a.donde}?aprobar=${a.refId}` : a.donde}
                    >
                      {a.aceptar}
                    </Link>
                  )}
                </div>
                {/*
                  EL PORQUÉ DEL RECHAZO. Lo va a leer quien mandó la solicitud,
                  en «Mi familia» de su propia área: un «rechazada» a secas le
                  obliga a llamar a la hermandad a preguntar qué ha pasado.
                */}
                {rechazando === a.id && (
                  <div className="aviso__rechazo">
                    <label htmlFor={`motivo-${a.id}`}>¿Por qué se rechaza?</label>
                    <div className="filters">
                      {MOTIVOS_DE_RECHAZO.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`chip${motivo === m ? ' chip--active' : ''}`}
                          onClick={() => setMotivo(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <input
                      id={`motivo-${a.id}`}
                      type="text"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="O escríbelo tú"
                    />
                    <div className="aviso__acciones">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!motivo.trim()}
                        onClick={() => rechazar(a, motivo)}
                      >
                        Rechazar y avisar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setRechazando(null); setMotivo('') }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
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
