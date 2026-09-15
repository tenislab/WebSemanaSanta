/**
 * EL DINERO EN LA WEB: donativos, lotería y tienda.
 *
 * Las tres son «cómo se paga desde la web», y las tres comparten el mismo
 * cuidado: no prometer un cobro que no está montado. La de la tienda casi no
 * tiene ajustes a propósito —se configura en su módulo— y es lo que dice.
 */
import AvisoDeCampo from '../../../components/AvisoDeCampo'
import AvisoFalta from '../../../components/AvisoFalta'
import { type HermandadSettings } from '../../../lib/hermandadSettings'
import { ibanValido, porQueNoValeElIban } from '../../../lib/iban'
import { requisito } from '../../../lib/requisitos'
import { type DonativosWeb, type LoteriaWeb, type WebPublica } from '../../../lib/webPublica'
import { Link } from 'react-router-dom'
import { lineas, type EditarFn } from './comun'

export function DonativosTab({ web, hermandad, editar }: { web: WebPublica; hermandad: HermandadSettings; editar: EditarFn }) {
  const d = web.donativos
  function set(c: Partial<DonativosWeb>) { editar('donativos', { ...d, ...c }) }
  const bizumEfectivo = d.bizum.trim() || hermandad.bizumTelefono
  const ibanEfectivo = d.iban.trim() || hermandad.iban
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Donativos y colaboración</h2></div>
      <p className="form-hint">
        Quien entra en la web y quiere ayudar tiene que poder hacerlo en ese momento. Con el Bizum y
        la cuenta a la vista, y el concepto ya escrito, la tesorería sabe de quién es cada ingreso.
      </p>
      {!bizumEfectivo && !ibanEfectivo && !d.enlacePasarela.trim() && (
        <div className="banner-inline banner-inline--warn">
          Sin Bizum, cuenta ni pasarela, esta sección no se publica: no habría por dónde donar.
        </div>
      )}
      <div className="form-row">
        <label htmlFor="donEntradilla">Frase de entrada</label>
        <input
          id="donEntradilla" type="text" value={d.entradilla}
          onChange={(e) => set({ entradilla: e.target.value })}
          placeholder="Tu ayuda sostiene la caridad de esta casa."
        />
      </div>
      <div className="form-row">
        <label htmlFor="donTexto">Explicación</label>
        <textarea
          id="donTexto" rows={4} value={d.texto}
          onChange={(e) => set({ texto: e.target.value })}
          placeholder="Cuenta a qué se dedica lo que se recauda. Lo concreto convence: «con 20 € se cubre una semana de la bolsa de caridad»."
        />
      </div>
      <div className="form-row">
        <label htmlFor="donCausas">A qué se puede destinar</label>
        <textarea
          id="donCausas" rows={4} value={d.causas.join('\n')}
          onChange={(e) => set({ causas: lineas(e.target.value) })}
          placeholder={'Bolsa de caridad\nRestauración del palio\nObras de la casa de hermandad'}
        />
        <p className="form-hint">Una por línea. Quien done podrá elegir a cuál va lo suyo.</p>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="donBizum">Bizum para donativos</label>
          <input
            id="donBizum" type="text" value={d.bizum}
            onChange={(e) => set({ bizum: e.target.value })}
            placeholder={hermandad.bizumTelefono || 'Teléfono del Bizum'}
          />
          <p className="form-hint">
            {hermandad.bizumTelefono && !d.bizum.trim()
              ? `Vacío = se usa el de la hermandad (${hermandad.bizumTelefono}).`
              : 'Vacío = se usa el de la hermandad, si lo hay en Configuración.'}
          </p>
        </div>
        <div className="form-row">
          <label htmlFor="donIban">Cuenta para donativos</label>
          <input
            id="donIban" type="text" value={d.iban}
            onChange={(e) => set({ iban: e.target.value })}
            placeholder={hermandad.iban || 'ES91 2100 0418 4502 0005 1332'}
          />
          {/* Esta cuenta se PUBLICA para que la gente ingrese ahí. Si tiene una
              cifra cambiada, el donativo se queda en el banco o va a otro sitio,
              y quien lo manda cree que ha donado. */}
          <AvisoDeCampo
            texto={d.iban.trim() && !ibanValido(d.iban)
              ? `Esa cuenta se publica en la web y no vale: ${porQueNoValeElIban(d.iban)}.`
              : null}
          />
          <p className="form-hint">Vacío = la cuenta de la hermandad.</p>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="donConcepto">Qué poner en el concepto</label>
          <input
            id="donConcepto" type="text" value={d.concepto}
            onChange={(e) => set({ concepto: e.target.value })}
            placeholder="Donativo + tu nombre"
          />
        </div>
        <div className="form-row">
          <label htmlFor="donImportes">Importes sugeridos</label>
          <input
            id="donImportes" type="text" value={d.importes.join(', ')}
            onChange={(e) => set({
              importes: e.target.value
                .split(/[,\s]+/)
                .map((x) => Number(x.replace(',', '.')))
                .filter((n) => Number.isFinite(n) && n > 0),
            })}
            placeholder="10, 20, 50"
          />
          <p className="form-hint">Separados por comas. Salen como botones para no dejar la casilla en blanco.</p>
        </div>
      </div>
      <details className="afinar">
        <summary>
          <span className="afinar__titulo">Cobrar con tarjeta desde la web</span>
          <span className="afinar__nota">{d.enlacePasarela.trim() ? 'Pasarela conectada' : 'Sin pasarela'}</span>
        </summary>
        <AvisoFalta requisito={requisito('pasarela', { web })} />
        <p className="form-hint">
          Si contratáis una pasarela (con vuestro banco, Stripe, PayPal…), pegad aquí el enlace de
          pago que os den y el botón de la web lleva a ella. Sin pasarela, la web enseña el Bizum y
          la cuenta, que es como se hace hoy por teléfono pero sin llamar. El aviso de arriba solo lo
          veis vosotros: en la web pública no sale.
        </p>
        <div className="form-row">
          <label htmlFor="donPasarela">Enlace de pago</label>
          <input
            id="donPasarela" type="url" value={d.enlacePasarela}
            onChange={(e) => set({ enlacePasarela: e.target.value.trim() })}
            placeholder="https://…"
          />
        </div>
        <div className="form-row">
          <label htmlFor="donPasarelaTxt">Texto del botón</label>
          <input
            id="donPasarelaTxt" type="text" value={d.textoPasarela}
            onChange={(e) => set({ textoPasarela: e.target.value })}
            placeholder="Donar ahora"
          />
        </div>
      </details>
      <label className="checkbox">
        <input type="checkbox" checked={d.avisoDonativo} onChange={(e) => set({ avisoDonativo: e.target.checked })} />
        <span>
          Dejar avisar del donativo desde la web. Llega al <b>buzón de la web</b> con el importe y a
          qué lo destina, y la tesorería lo cuadra con el ingreso.
        </span>
      </label>
    </section>
  )
}

/* --------------------------------- Tienda ---------------------------------- */

/**
 * La única sección que NO se escribe aquí.
 *
 * Lo que se publica en la tienda de la web es el género del almacén: los
 * artículos marcados como «Publicarlo en la tienda de la web» en su ficha. No
 * hay un segundo catálogo que rellenar —lo habría, y a la semana diría una
 * cosa distinta que el almacén—, así que esta pestaña explica de dónde sale y
 * lleva a donde se toca.
 */
export function TiendaTab() {
  return (
    <div className="app-form">
      <p className="form-hint">
        La tienda de la web enseña los artículos del almacén que tengan marcado
        <b> «Publicarlo en la tienda de la web»</b> en su ficha, con lo que queda de cada uno.
        No hay nada que escribir aquí: se marca el artículo y sale.
      </p>
      <p className="form-hint">
        <b>No se paga por internet.</b> Quien entra aparta lo que quiere y lo paga al recogerlo en
        la casa de hermandad. Lo apartado se ve en <b>Tienda → Reservas</b>, y ahí es donde se
        cobra y se entrega: hasta ese momento no hay factura ni apunte en Tesorería.
      </p>
      <p className="form-hint">
        <b>Al hermano se le hace su precio, también aquí.</b> Si ha entrado en su área en esa misma
        pestaña, ve el precio con su descuento —tachada la tarifa al lado— y se le cobra ese al
        recogerlo. Quien no entra paga tarifa, y lo lee en la propia tienda: «¿eres hermano? entra
        y verás tu precio». Los descuentos se crean en <b>Tienda → Artículos → Descuentos</b>.
      </p>
      <div className="fila-botones">
        <Link className="btn btn-outline" to="/app/tienda/almacen">Ir a los artículos</Link>
        <Link className="btn btn-ghost" to="/app/tienda/reservas">Ver las reservas</Link>
      </div>
      <p className="form-hint">
        Acuérdate de encender la sección en <b>Diseño</b>: sale apagada de fábrica, porque lo que
        se publica aquí se puede apartar de verdad.
      </p>
    </div>
  )
}

/* --------------------------------- Lotería --------------------------------- */
export function LoteriaTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  const l = web.loteria
  function set(c: Partial<LoteriaWeb>) { editar('loteria', { ...l, ...c }) }
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Lotería</h2></div>
      <p className="form-hint">
        La lotería se vende en la casa de hermandad y en horario de secretaría, que es cuando media
        hermandad trabaja. Desde la web al menos se reserva: vosotros apartáis las participaciones y
        avisáis para recogerlas.
      </p>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="lotSorteo">Sorteo</label>
          <input
            id="lotSorteo" type="text" value={l.sorteo}
            onChange={(e) => set({ sorteo: e.target.value })}
            placeholder="Navidad 2026"
          />
        </div>
        <div className="form-row">
          <label htmlFor="lotNumero">Número</label>
          <input
            id="lotNumero" type="text" value={l.numero}
            onChange={(e) => set({ numero: e.target.value })}
            placeholder="24.681"
          />
          <p className="form-hint">Sin número ni sorteo, la sección no se publica.</p>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="lotJuega">Juega (€ por participación)</label>
          <input
            id="lotJuega" type="number" min="0" step="0.5" value={l.juega || ''}
            onChange={(e) => set({ juega: Number(e.target.value) || 0 })}
            placeholder="4"
          />
        </div>
        <div className="form-row">
          <label htmlFor="lotPrecio">Precio de la participación (€)</label>
          <input
            id="lotPrecio" type="number" min="0" step="0.5" value={l.precio || ''}
            onChange={(e) => set({ precio: Number(e.target.value) || 0 })}
            placeholder="5"
          />
          <p className="form-hint">
            {l.precio > l.juega && l.juega > 0
              ? `Donativo de ${(l.precio - l.juega).toFixed(2)} € por participación.`
              : 'Lo jugado más el donativo de la hermandad.'}
          </p>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="lotTexto">Explicación</label>
        <textarea
          id="lotTexto" rows={3} value={l.texto}
          onChange={(e) => set({ texto: e.target.value })}
          placeholder="Como cada año, la hermandad juega su número. Lo que se recauda va a…"
        />
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="lotDestino">El donativo va a</label>
          <input
            id="lotDestino" type="text" value={l.destinoDonativo}
            onChange={(e) => set({ destinoDonativo: e.target.value })}
            placeholder="La bolsa de caridad"
          />
        </div>
        <div className="form-row">
          <label htmlFor="lotDonde">Dónde se recoge</label>
          <input
            id="lotDonde" type="text" value={l.dondeRecoger}
            onChange={(e) => set({ dondeRecoger: e.target.value })}
            placeholder="La casa de hermandad, martes y jueves de 20:00 a 21:30"
          />
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="lotMax">Máximo por persona</label>
        <input
          id="lotMax" type="number" min="0" step="1" value={l.maxPorPersona || ''}
          onChange={(e) => set({ maxPorPersona: Number(e.target.value) || 0 })}
          placeholder="20"
        />
        <p className="form-hint">0 = sin tope.</p>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={l.reservaAbierta} onChange={(e) => set({ reservaAbierta: e.target.checked })} />
        <span>
          Se puede reservar desde la web. Al cerrarla, la sección sigue contando el número y dónde
          comprarla, pero sin formulario.
        </span>
      </label>
    </section>
  )
}

/* ----------------------------- Buzón de la web ----------------------------- */
/**
 * Lo que llega desde la web pública: mensajes, avisos de donativo y reservas de
 * lotería. Vive en el editor de la web porque es lo que la web recibe, y
 * porque quien la monta es quien tiene que ver si funciona.
 */
