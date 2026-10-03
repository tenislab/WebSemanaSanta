import { useEffect, useMemo, useState } from 'react'
import Drawer from '../../../components/Drawer'
import CertificadoAntiguedad from '../../../components/CertificadoAntiguedad'
import { emitirCertificado, useCertificadosDe } from '../../../lib/certificados'
import { referenciaCertificado, type Certificado } from '../../../data/certificados'
import type { HermandadSettings } from '../../../lib/hermandadSettings'
import type { Hermano } from '../../../data/hermanos'

/**
 * EL CERTIFICADO DE ANTIGÜEDAD: el bloque de la ficha y el papel para leerlo.
 *
 * Sale de `Hermanos.tsx` con TODO lo suyo, que es lo que hace que valga la
 * pena: el bloque de pantalla costaba doce props, y cinco eran su propio
 * estado —el motivo, el «expidiendo», el error, si el formulario está abierto y
 * el certificado recién emitido—. Trayéndose también `expedirCertificado`, el
 * hook que lista los ya expedidos y el cálculo de los cargos vacantes, son
 * ciento cincuenta líneas por tres props.
 *
 * LAS DOS MITADES VAN JUNTAS porque son una sola cosa mirada en dos momentos:
 * el bloque de la ficha pide el certificado y el cajón lo enseña para leerlo
 * antes de imprimirlo. Separarlas obligaría a pasarse el `certificado` de un
 * fichero a otro, que es exactamente el estado que aquí no sale.
 *
 * SE ENSEÑA ANTES DE IMPRIMIR, y no es un paso de más: es un papel que sale de
 * la hermandad con dos firmas, y quien lo expide tiene que poder leerlo antes
 * de dárselo a nadie.
 */
export default function FichaCertificado({ selected, hermandad, hermanos }: {
  selected: Hermano
  hermandad: HermandadSettings
  /** El censo, solo para saber si falta algún cargo que tenga que firmar. */
  hermanos: Hermano[]
}) {
  /*
   * EL ESTADO DEL CERTIFICADO, AQUÍ. Mientras vivió en la pantalla del censo,
   * escribir el «para qué lo pide» repintaba la tabla entera.
   */
  const [certificado, setCertificado] = useState<Certificado | null>(null)
  const [motivoCert, setMotivoCert] = useState('')
  const [expidiendo, setExpidiendo] = useState(false)
  const [errorCert, setErrorCert] = useState<string | null>(null)
  /* Expedir se pide poco, y su formulario —con el aviso de los firmantes y el
     «para qué lo pide»— ocupaba media ficha siempre. Se abre al decirlo. */
  const [expidiendoAbierto, setExpidiendoAbierto] = useState(false)
  const { certificados, recargar: recargarCertificados } = useCertificadosDe(selected.id)

  /*
   * Los cargos que firman y están vacantes. Se mira sobre el censo, que es de
   * donde los saca la base al expedirlo.
   */
  const sinFirmantes = useMemo(
    () => (['Hermano Mayor', 'Secretario/a'] as const)
      .filter((cargo) => !hermanos.some((h) => h.cargo === cargo && h.estado !== 'Baja')),
    [hermanos],
  )

  /*
   * AL CAMBIAR DE HERMANO, EL FORMULARIO DE EXPEDIR SE CIERRA. Abierto en la
   * ficha de otra persona es un certificado a punto de salir a nombre de quien
   * no lo pidió. Estaba en un `useEffect` de la pantalla que reiniciaba media
   * ficha a la vez; aquí son dos líneas al lado de lo que reinician.
   */
  useEffect(() => {
    setExpidiendoAbierto(false)
    setErrorCert(null)
  }, [selected.id])

  async function expedirCertificado() {
    if (expidiendo) return
    setExpidiendo(true)
    setErrorCert(null)
    const r = await emitirCertificado(selected.id, motivoCert.trim())
    setExpidiendo(false)
    if (!r.ok) {
      // El mensaje de la base va TAL CUAL: los suyos están escritos para
      // leerlos en pantalla, y cambiarlos por un «no se ha podido» le quita a
      // quien está en secretaría la única pista de qué pasa.
      setErrorCert(r.error)
      return
    }
    setCertificado(r.certificado)
    setMotivoCert('')
    // Expedido: el formulario se cierra. Dejarlo abierto invita a expedir dos.
    setExpidiendoAbierto(false)
    recargarCertificados()
  }

  return (
    <>
          <section className="ficha-bloque">
            <h4>Certificado de antigüedad</h4>
            {selected.estado === 'Baja' ? (
              /* De quien causó baja se puede certificar que LO FUE, y eso es
                 otro papel con otro texto. Este dice, en presente, que figura
                 inscrito; dárselo sería firmar algo que no es verdad. */
              <p className="table-subtle">
                Figura de baja, así que no se le puede certificar que está inscrito. Ese sería
                otro documento, con otro texto.
              </p>
            ) : (
              <>
                {/*
                  UNA LÍNEA Y UN BOTÓN, NO DOS PÁRRAFOS.

                  Esto era lo que más texto ponía en la ficha: dos párrafos de
                  qué es y a quién acredita, el aviso de los firmantes, el
                  campo «Para qué lo pide» con su explicación y el botón — y
                  todo eso SIEMPRE, delante del DNI y del cumpleaños, se
                  fuera a expedir o no. No se ha borrado nada: lo que
                  explica se pliega, y lo que hace falta para expedir aparece
                  al decir que se va a expedir.
                */}
                <p className="table-subtle">
                  Acredita que es hermano/a desde <b>{selected.antiguedad}</b> y con qué número.
                  {' '}
                  <details className="ficha-ayuda">
                    <summary>¿Qué es esto?</summary>
                    Es el papel que pide un hermano cuando tiene que acreditar ante alguien que
                    lo es y desde cuándo: para entrar en otra hermandad, para el consejo, para
                    una bolsa de caridad, para el varal que va por antigüedad. Queda registrado
                    con su número de orden, para poder responder por él si se lo piden a la
                    hermandad.
                  </details>
                </p>
                {!expidiendoAbierto ? (
                  <button className="btn btn-outline btn-sm" onClick={() => setExpidiendoAbierto(true)}>
                    Expedir certificado…
                  </button>
                ) : (
                <div className="assign-box">
                  {/*
                    SI NO HAY QUIÉN FIRME, SE DICE ANTES DE EXPEDIRLO.
                    El papel sale igual —con la línea y el título, como en
                    papel— pero quien lo expide tiene que saber que va a salir
                    sin nombres, y dónde se arregla. Enterarse al imprimirlo,
                    con la persona esperando, es enterarse tarde. Y aquí es
                    «antes de expedirlo»: en el momento en que hace falta, no
                    cada vez que se abre una ficha.
                  */}
                  {sinFirmantes.length > 0 && (
                    <p className="form-hint">
                      Nadie figura como{' '}
                      {sinFirmantes.map((cargo, i) => (
                        <span key={cargo}>
                          {i > 0 && ' ni como '}<b>{cargo}</b>
                        </span>
                      ))}
                      {' '}en el censo, así que{' '}
                      {sinFirmantes.length === 1 ? 'esa línea saldrá' : 'esas líneas saldrán'} sin nombre.
                      Se pone en la ficha de quien lleve el cargo.
                    </p>
                  )}
                  {errorCert && <div className="banner-inline banner-inline--warn" role="alert">{errorCert}</div>}
                  <div className="form-row">
                    <label htmlFor="motivoCert">Para qué lo pide</label>
                    <input
                      id="motivoCert"
                      value={motivoCert}
                      onChange={(e) => setMotivoCert(e.target.value)}
                      placeholder="Solicitar el ingreso en otra hermandad, bolsa de caridad…"
                    />
                    <p className="form-hint">
                      Sale escrito en el certificado. En blanco dice «para que conste donde
                      proceda».
                    </p>
                  </div>
                  <div className="assign-box__row">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => void expedirCertificado()}
                      disabled={expidiendo}
                    >
                      {expidiendo ? 'Expidiendo…' : 'Expedir certificado'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setExpidiendoAbierto(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
                )}

                {/* Lo primero que hace la secretaría cuando le piden uno es
                    mirar si ya se lo dio, y con qué número. */}
                {certificados.length > 0 && (
                  <ul className="ficha-bloque__filas">
                    {certificados.map((c) => (
                      <li key={c.id}>
                        <b>Nº {referenciaCertificado(c)}</b>
                        <span>{c.fecha}{c.motivo ? ` · ${c.motivo}` : ''}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setCertificado(c)}>
                          Ver
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
      <Drawer
        open={certificado !== null}
        onClose={() => { setCertificado(null); setErrorCert(null) }}
        title={certificado ? `Certificado nº ${referenciaCertificado(certificado)}` : 'Certificado'}
        subtitle={certificado?.hermanoNombre}
        ancho="ancho"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCertificado(null)}>Cerrar</button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              Imprimir / Descargar
            </button>
          </>
        }
      >
        {certificado && <CertificadoAntiguedad certificado={certificado} hermandad={hermandad} />}
      </Drawer>
    </>
  )
}
