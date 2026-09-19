import AvisoFalta from '../../../components/AvisoFalta'
import { correoDePrueba, correoDisponible, diagnosticarCorreo, enviarCorreo, loQueLeFaltaAlCorreo, type AjustesCorreo, useAjustesCorreo } from '../../../lib/correo'
import { requisito } from '../../../lib/requisitos'
import { useAuth } from '../../../context/AuthContext'
import { useHermandadSettings } from '../../../lib/hermandadSettings'
import { useState } from 'react'

export default function CorreoCard() {
  const { user } = useAuth()
  const hermandad = useHermandadSettings()
  const [ajustes, setAjustes] = useAjustesCorreo()
  const [destinoPrueba, setDestinoPrueba] = useState(user?.email ?? '')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const set = (c: Partial<AjustesCorreo>) => setAjustes({ ...ajustes, ...c })

  /*
   * QUÉ LE FALTA AL CORREO. Antes solo se podía mandar el de prueba y ver si
   * llegaba, y ese es justamente el caso que no se puede diagnosticar así: con
   * el remitente de pruebas de Resend, el envío contesta que todo bien y el
   * correo no llega nunca. Se pasaron días pensando que era el proveedor.
   */
  const [faltan, setFaltan] = useState<string[] | null>(null)
  const [mirando, setMirando] = useState(false)

  async function mirarQueFalta() {
    setMirando(true)
    setResultado(null)
    const r = await diagnosticarCorreo()
    setMirando(false)
    if (!r.ok) { setFaltan([r.error]); return }
    setFaltan(loQueLeFaltaAlCorreo(r.d))
  }

  async function probar() {
    setEnviando(true)
    setResultado(null)
    const { asunto, texto, html } = correoDePrueba(hermandad.nombreLegal)
    const r = await enviarCorreo({ para: [destinoPrueba], asunto, texto, html })
    setEnviando(false)
    setResultado(
      r.ok
        ? { ok: true, texto: `Enviado a ${destinoPrueba}. Míralo, y mira también la carpeta de spam: si ha caído ahí, falta verificar el dominio.` }
        : { ok: false, texto: r.error ?? 'No se pudo enviar.' },
    )
    // Y si dice que se ha enviado, se mira igualmente qué falta: es el único
    // caso en que «enviado» y «no llega» conviven, y hay que decirlo ANTES de
    // que alguien se pase la tarde mirando la carpeta de spam.
    if (r.ok) void mirarQueFalta()
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Correo</h2>
        {correoDisponible(ajustes) && <span className="pill pill--ok">Activo</span>}
      </div>
      <p className="form-hint">
        Sin esto, los avisos llegan al buzón que cada hermano tiene dentro de su área: si no entra,
        no se entera. Con el correo conectado, además le llega a su bandeja.
      </p>

      <AvisoFalta requisito={requisito('correo')} />

      <details className="afinar">
        <summary>
          <span className="afinar__titulo">Cómo se conecta</span>
          <span className="afinar__nota">Una vez, unos 20 minutos</span>
        </summary>
        <ol className="cfg-pasos">
          <li>Crear una cuenta en <b>Resend</b> (resend.com). El plan gratuito da 3.000 correos al mes, de sobra para una hermandad.</li>
          <li>Copiar la clave de API que dan al registrarse.</li>
          <li>
            Guardarla como secreto de la función, desde el ordenador de quien administre Gobergo:
            <code className="cfg-codigo">supabase secrets set RESEND_API_KEY=re_xxx</code>
            <code className="cfg-codigo">supabase functions deploy enviar-correo</code>
          </li>
          <li>
            <b>Para probar hoy mismo</b> no hace falta dominio: Resend deja usar{' '}
            <code>onboarding@resend.dev</code> como remitente, pero solo escribe a la dirección con
            la que te registraste. Vale para comprobar que el circuito funciona.
          </li>
          <li>
            <b>Para escribir a los hermanos</b> hay que verificar el dominio de la hermandad en
            Resend y añadir los registros <b>SPF</b>, <b>DKIM</b> y <b>DMARC</b> donde se compró el
            dominio. Sin eso, los correos van a spam o se rechazan.
          </li>
        </ol>
      </details>

      <label className="checkbox">
        <input type="checkbox" checked={ajustes.activo} onChange={(e) => set({ activo: e.target.checked })} />
        <span>
          Mandar los avisos también por correo
          <small className="portal__pref-explica">
            Se puede apagar en cualquier momento sin perder la configuración. El buzón del hermano
            sigue funcionando igual.
          </small>
        </span>
      </label>

      <div className="form-row">
        <label htmlFor="correoResponder">A dónde contestan los hermanos</label>
        <input
          id="correoResponder" type="email" value={ajustes.responderA}
          onChange={(e) => set({ responderA: e.target.value })}
          placeholder={hermandad.email || 'secretaria@hermandad.es'}
        />
        <p className="form-hint">
          Cuando le den a «responder», la respuesta irá aquí. Vacío = a la dirección desde la que se
          envía, que puede no leer nadie.
        </p>
        {/*
         * ESTE AVISO SALE CARO SI NO ESTÁ.
         *
         * El proveedor de correo no acepta este campo a medias: si no tiene
         * forma de dirección, RECHAZA EL ENVÍO ENTERO. No manda el correo sin
         * «responder a»: no manda nada. Un «secretaria» sin dominio aquí
         * dejaba a la hermandad sin poder mandar ni una convocatoria, con un
         * error que hablaba del proveedor y no de este campo.
         *
         * La función ya se protege sola —se va sin «responder a» antes que no
         * salir—, pero eso pierde las respuestas de los hermanos en silencio.
         * Así que aquí se dice, que es donde se arregla.
         */}
        {ajustes.responderA.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ajustes.responderA.trim()) && (
          <p className="form-hint form-hint--error">
            Esto no tiene forma de dirección de correo. Los envíos saldrán igual, pero las
            respuestas de los hermanos no llegarán aquí: irán a la dirección desde la que se
            envía. Escríbela entera, como <code>secretaria@hermandad.es</code>, o déjalo vacío.
          </p>
        )}
      </div>

      <div className="form-row">
        <label>Qué sale por correo</label>
        <p className="form-hint">
          Además de al buzón. Lo que cada hermano haya apagado en su área se respeta siempre: esto
          es el máximo, no una imposición.
        </p>
        {([
          ['comunicados', 'Comunicados de la hermandad'],
          ['cuotas', 'Cuotas: emisión y confirmación de pago'],
          ['papeletas', 'Papeletas de sitio'],
          ['ficha', 'Cambios en sus datos'],
        ] as const).map(([id, texto]) => (
          <label className="checkbox" key={id}>
            <input
              type="checkbox"
              checked={ajustes.avisaDe[id]}
              onChange={(e) => set({ avisaDe: { ...ajustes.avisaDe, [id]: e.target.checked } })}
            />
            <span>{texto}</span>
          </label>
        ))}
      </div>

      <div className="form-row">
        <label htmlFor="correoPrueba">Mandarme un correo de prueba</label>
        <div className="assign-box__row">
          <input
            id="correoPrueba" type="email" value={destinoPrueba}
            onChange={(e) => setDestinoPrueba(e.target.value)}
            placeholder="tu@correo.es"
          />
          <button
            type="button" className="btn btn-primary btn-sm"
            disabled={enviando || !destinoPrueba.trim()}
            onClick={probar}
          >
            {enviando ? 'Enviando…' : 'Enviar prueba'}
          </button>
          {/*
            EL BOTÓN QUE HACÍA FALTA. «No me llegan los mails» no se puede
            diagnosticar mandando otro que tampoco llegue: hay que preguntarle
            a la función qué le falta.
          */}
          <button
            type="button" className="btn btn-outline btn-sm"
            disabled={mirando}
            onClick={() => void mirarQueFalta()}
          >
            {mirando ? 'Mirando…' : 'No me llegan: ¿qué falta?'}
          </button>
        </div>
        <p className="form-hint">
          Hazlo <b>antes</b> de mandar nada a los hermanos. Es la única forma de saber que funciona
          sin descubrirlo con mil personas delante.
        </p>
        {resultado && (
          <p className={resultado.ok ? 'form-hint form-hint--ok' : 'aviso-falta__error-suelto'}>
            {resultado.ok ? '✓ ' : ''}{resultado.texto}
          </p>
        )}
        {faltan !== null && (
          faltan.length === 0 ? (
            <p className="form-hint form-hint--ok">
              ✓ No falta nada: hay clave de Resend, remitente propio y clave de servicio. Si aun
              así no llega, mira la carpeta de spam y el registro de Resend (Emails → el último).
            </p>
          ) : (
            <div className="banner banner--warn" role="status">
              <b>{faltan.length === 1 ? 'Falta esto:' : `Faltan ${faltan.length} cosas:`}</b>
              <ul className="cfg-pasos">
                {faltan.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )
        )}
      </div>
    </section>
  )
}
