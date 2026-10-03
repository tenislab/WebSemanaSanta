import type { Hermano } from '../../../data/hermanos'

/**
 * LA PARTE DE ADMINISTRACIÓN DE LA FICHA: dar de baja, reactivar, mandarle el
 * acceso y los dos botones del RGPD.
 *
 * Sale de `Hermanos.tsx` con ocho props para ciento veintitrés líneas, y
 * ninguna de las ocho es estado que se pueda mover aquí: el censo, el dar de
 * baja y el reactivar son de la pantalla, no de este bloque. Medido antes de
 * cortar, que es la única forma de saber si un corte mejora algo o solo mueve
 * el bulto.
 *
 * VA PLEGADO, y eso no es decoración: son las tres acciones que no se
 * deshacen. Una ficha que las enseña abiertas al lado del teléfono y la
 * dirección invita a pulsarlas mientras se consulta otra cosa.
 */
export default function FichaAdmin({
  selected, enviandoAcceso, mandarAcceso, darDeBaja, reactivar,
  descargarDatosRgpd, borrarHermanoRgpd,
}: {
  selected: Hermano
  /** Id del hermano al que se le está mandando el acceso ahora mismo. */
  enviandoAcceso: string | null
  mandarAcceso: (h: Hermano) => void
  darDeBaja: (id: string) => void
  /* Con el segundo parámetro: reactivar recuperando la antigüedad NO es lo
     mismo que entrar al final del censo, y son dos botones distintos. */
  reactivar: (id: string, recuperarAntiguedad: boolean) => void
  descargarDatosRgpd: (h: Hermano) => void
  borrarHermanoRgpd: (h: Hermano) => void
}) {
  return (
        <details className="afinar afinar--suelto ficha-admin">
          <summary className="afinar__cabeza">
            <span className="afinar__titulo">Administración</span>
            <span className="afinar__nota">Baja, reactivación y protección de datos</span>
          </summary>
          <div className="afinar__cuerpo">
        <div className="assign-box">
          <label>Situación en la hermandad</label>
          {selected.bajaSolicitada && selected.estado !== 'Baja' && (
            <div className="banner-inline banner-inline--warn" style={{ marginBottom: '0.7rem' }}>
              <b>{selected.nombre.split(' ')[0]} ha solicitado la baja</b> desde su área de
              hermano. Tramítala aquí abajo si procede.
            </div>
          )}
          {/*
            * DARLE ACCESO A SU ÁREA.
            *
            * La cuenta se creaba al darlo de alta a mano y al aprobar su
            * solicitud. Pero una hermandad entra IMPORTANDO su censo, y la
            * importación no crea cuentas —ni debe: 800 altas serían 800
            * correos de golpe—. Sin este botón, la hermandad tenía su censo
            * entero y ni un hermano podía entrar en su área.
            */}
          {selected.estado !== 'Baja' && (
            <div className="ficha-acceso">
              {selected.authUserId ? (
                <p className="form-hint">
                  <b>Ya tiene acceso.</b> Si no recuerda su contraseña, que use
                  «he olvidado mi contraseña» en la pantalla de entrar: desde aquí no se le
                  puede poner otra.
                </p>
              ) : !selected.email?.includes('@') ? (
                <p className="form-hint">
                  <b>No puede entrar todavía.</b> Para darle acceso hace falta su correo:
                  ponlo arriba y guarda.
                </p>
              ) : (
                <>
                  <p className="form-hint">
                    <b>Todavía no puede entrar en su área.</b> Al enviarle el acceso se le crea
                    su cuenta y se le manda por correo una clave de un solo uso, que cambiará al
                    entrar.
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={enviandoAcceso === selected.id}
                    onClick={() => mandarAcceso(selected)}
                  >
                    {enviandoAcceso === selected.id ? 'Enviando…' : 'Enviar acceso por correo'}
                  </button>
                </>
              )}
            </div>
          )}
          {selected.estado !== 'Baja' ? (
            <>
              <p className="form-hint">
                Al dar de baja, su número queda libre y los hermanos con número mayor
                descienden uno (el escalafón de antigüedad se recoloca solo). Se conserva su
                historial y puede reactivarse más adelante.
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm rgpd-borrar"
                onClick={() => {
                  if (window.confirm(`¿Dar de baja a ${selected.nombre}? Los números de hermano se recolocarán.`)) {
                    void darDeBaja(selected.id)
                  }
                }}
              >
                Dar de baja
              </button>
            </>
          ) : (
            <>
              <p className="form-hint">
                Está de baja: fuera de la numeración activa. Al reactivarlo hay que decidir qué
                pasa con su antigüedad, y no da igual.
              </p>
              <div className="assign-box__row">
                <button
                  type="button" className="btn btn-primary btn-sm"
                  onClick={() => reactivar(selected.id, true)}
                >
                  Recupera su antigüedad ({selected.antiguedad})
                </button>
                <button
                  type="button" className="btn btn-outline btn-sm"
                  onClick={() => reactivar(selected.id, false)}
                >
                  Entra al final del censo
                </button>
              </div>
              <p className="form-hint">
                Con <b>recuperar su antigüedad</b> vuelve al puesto que le toca por su año de
                entrada y los de abajo descienden uno, que es lo normal cuando alguien se
                reincorpora. Con <b>al final</b> entra como uno nuevo.
              </p>
            </>
          )}
        </div>

        <div className="assign-box">
          <label>Protección de datos (RGPD)</label>
          <p className="form-hint">
            {selected.nombre.split(' ')[0]} puede ejercer sus derechos sobre sus datos: descargar
            todo lo que la hermandad guarda de él/ella, o pedir que se supriman.
          </p>
          <div className="assign-box__row">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => descargarDatosRgpd(selected)}>
              Descargar sus datos
            </button>
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarHermanoRgpd(selected)}>
              Borrar sus datos
            </button>
          </div>
          <p className="form-hint">
            La supresión borra al hermano y sus cuotas, papeletas e incidencias. Ten en cuenta que
            la normativa contable puede obligar a conservar ciertos registros; esa decisión es de
            la hermandad.
          </p>
        </div>
          </div>
        </details>
  )
}
