import { hayAlmacen, mudarImagenes, recibirImagen, sustituirImagenes } from '../../lib/almacenImagenes'
import { leerArchivo } from '../../lib/imagen'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { LogoMark } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import {
  useHermandadSettings,
  getHermandadSettings,
  saveHermandadSettings,
  type HermandadSettings,
} from '../../lib/hermandadSettings'
import TraerDatos from '../../components/TraerDatos'
import AvisoDeCampo from '../../components/AvisoDeCampo'
import { problemaDeBizum, problemaDeTelefono } from '../../lib/telefono'
import { identificadorQueLeToca, problemaDeCodigoPostal, problemaDeIdentificadorAcreedor, problemaDeNif } from '../../lib/nif'
import { porQueNoValeElIban, ibanValido } from '../../lib/iban'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { getCampana } from '../../lib/campana'
import type { Papeleta } from '../../data/papeletas'
import CamposPropiosCard from './ajustes/CamposPropiosCard'
import { useCuerposYTramos } from './ajustes/cuerposYTramos'
import CuerposYTramos from './ajustes/CuerposYTramos'
import CatalogosYCuotas from './ajustes/CatalogosYCuotas'
import CopiasYDatos from './ajustes/CopiasYDatos'
import PuestaEnMarchaCard from './ajustes/PuestaEnMarchaCard'
import ConexionesCard from './ajustes/ConexionesCard'
import CorreoCard from './ajustes/CorreoCard'

const MAX_LOGO_BYTES = 800_000


/** Catálogos de listas simples que cada hermandad personaliza (clave de almacenamiento + valores por defecto). */

type SeccionCfg = 'hermandad' | 'cortejo' | 'papeletas' | 'catalogos' | 'ficha' | 'traer' | 'datos' | 'puesta' | 'correo' | 'conexiones'

/** Las secciones de los ajustes, agrupadas como el editor de la web. */
const SECCIONES_CFG: { titulo: string; items: { id: SeccionCfg; label: string; icono: ReactNode }[] }[] = [
  {
    titulo: 'La hermandad',
    items: [
      { id: 'hermandad', label: 'Identidad y datos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 4 7v6c0 4.4 3.4 7.4 8 8 4.6-.6 8-3.6 8-8V7l-8-4Z" /></svg> },
      { id: 'ficha', label: 'Ficha del hermano', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M5.5 16.5c.7-1.7 2-2.5 3.5-2.5s2.8.8 3.5 2.5M15 9.5h4M15 13h3" /></svg> },
    ],
  },
  {
    titulo: 'Cómo trabajáis',
    items: [
      { id: 'cortejo', label: 'Cuerpos y tramos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h16M4 12h16M4 18h10" /></svg> },
      { id: 'papeletas', label: 'Papeletas', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M2.5 11a2 2 0 0 0 0 2M21.5 11a2 2 0 0 1 0 2M9 6v12" strokeDasharray="2 2" /></svg> },
      { id: 'catalogos', label: 'Catálogos y cuotas', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg> },
    ],
  },
  {
    titulo: 'Mantenimiento',
    items: [
      /* «Conexiones» va el primero del grupo a propósito: es lo que se viene a
         buscar a Ajustes, y hasta ahora no estaba en ninguna parte. */
      { id: 'conexiones', label: 'Conexiones', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 15 4.5 19.5a3.2 3.2 0 0 1-4.5-4.5" transform="translate(2 -1)" /><path d="M14.5 9.5 19 5a3.2 3.2 0 0 1 4.5 4.5L19 14" transform="translate(-1 1)" /><path d="M9.5 14.5 14.5 9.5" /></svg> },
      { id: 'correo', label: 'Correo', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg> },
      /* «Traer vuestros datos» va antes que «Puesta en marcha» y que «Copias»
         a propósito: es lo primero que hace una hermandad el día que se da de
         alta, y hasta ahora estaba repartido en cuatro pantallas distintas. */
      { id: 'traer', label: 'Traer vuestros datos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v11M8.5 10.5 12 14l3.5-3.5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg> },
      { id: 'puesta', label: 'Puesta en marcha', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2v6M12 16v6M2 12h6M16 12h6" /><circle cx="12" cy="12" r="3.2" /></svg> },
      { id: 'datos', label: 'Copias y datos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg> },
    ],
  },
]

export default function Configuracion() {
  /** Sección abierta. Se recuerda durante la sesión: se entra y se sale mucho. */
  const [seccion, setSeccion] = useState<SeccionCfg>(
    () => (sessionStorage.getItem('cabildo-cfg-seccion') as SeccionCfg | null) ?? 'hermandad',
  )
  function irASeccion(s: SeccionCfg) {
    setSeccion(s)
    try { sessionStorage.setItem('cabildo-cfg-seccion', s) } catch { /* sin sessionStorage */ }
  }
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''

  const settingsRemotas = useHermandadSettings(fallbackNombre)
  const [settings, setSettings] = useState<HermandadSettings>(settingsRemotas)
  const [tocado, setTocado] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  // Subir tarda: encoger la foto y mandarla al almacén no es instantáneo, y sin
  // esto el botón se puede pulsar tres veces y suben tres escudos.
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Mientras no se haya tocado el formulario, refleja lo que traiga Supabase
  // en cuanto llegue (la primera lectura, al montar, es solo la caché local).
  useEffect(() => {
    if (!tocado) setSettings(settingsRemotas)
  }, [settingsRemotas, tocado])

  /*
   * LA MUDANZA DE LO QUE YA ESTÁ DENTRO.
   *
   * Arreglar el camino de subida solo arregla lo que se suba a partir de hoy.
   * La hermandad que lleva meses con su escudo de 700 KB metido en los ajustes
   * —y el modelo de papeleta escaneado al lado— lo seguiría arrastrando para
   * siempre, en cada carga del panel y de la web pública.
   *
   * Así que al abrir esta pantalla se recorren los ajustes enteros y se sube
   * lo que haya escrito dentro. Va a ciegas, sin conocer los campos: el
   * escudo, el modelo de papeleta y el del recibo salen los tres, y también
   * saldrá lo que se añada mañana.
   *
   * Solo al montar, y es idempotente: la segunda vez no encuentra ninguna
   * porque ya son direcciones. Si falla no se toca nada — los ajustes se
   * quedan como estaban, funcionando igual que ayer.
   */
  useEffect(() => {
    if (!hayAlmacen()) return
    let vivo = true
    void (async () => {
      const { subidas, mapa } = await mudarImagenes(getHermandadSettings(), 'web')
      if (!vivo || subidas === 0) return
      /*
       * Sobre lo que hay AHORA y no sobre la copia con la que empezó: subir
       * tarda segundos, y en esos segundos se está escribiendo en el
       * formulario. Guardar el resultado tal cual borraría lo tecleado
       * mientras tanto, delante de sus ojos y sin aviso.
       */
      setSettings((actual) => {
        const mudado = sustituirImagenes(actual, mapa)
        // Y se guarda, que si no la mudanza se repite en cada visita: las
        // imágenes estarían subidas pero los ajustes seguirían apuntando al
        // texto de dentro.
        void saveHermandadSettings(mudado)
        return mudado
      })
    })()
    return () => { vivo = false }
  }, [])

  function update<K extends keyof HermandadSettings>(key: K, value: HermandadSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
    setSaved(false)
    setTocado(true)
  }

  /*
   * EL ESCUDO, ENCOGIDO Y SUBIDO AL ALMACÉN.
   *
   * Antes se guardaba el archivo TAL CUAL salió del móvil, en base64, dentro
   * de `hermandad_settings`. Y esa fila no es una más: se lee entera en cada
   * carga del panel Y de la web pública, y el escudo se imprime en todos los
   * documentos. Un escudo de 700 KB son 700 KB que viajan en cada visita de
   * cada persona, para siempre.
   *
   * Lo llamativo es que el asistente de alta SÍ lo hacía bien desde el primer
   * día. O sea que la hermandad que lo subía al darse de alta quedaba bien, y
   * la misma hermandad cambiándolo después por esta pantalla lo estropeaba,
   * sin que nada lo dijera. Ahora las dos pasan por `recibirImagen`.
   *
   * Y EL TOPE SE MIRA DESPUÉS, NO ANTES. Rechazar por tamaño antes de encoger
   * era el orden justo al revés: una foto de móvil son cuatro megas y encogida
   * a 512 px son cuarenta kilos, así que se estaba rechazando por pesada
   * precisamente la que iba a quedar ligera. Lo que se comprueba ahora es lo
   * que se va a guardar de verdad, y solo importa si no hubo almacén.
   */
  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoError(null)
    setSubiendoLogo(true)
    try {
      const crudo = await leerArchivo(file)
      if (!crudo) {
        setLogoError('No se ha podido leer ese archivo. Prueba con otra imagen.')
        return
      }
      const guardado = await recibirImagen(crudo, { carpeta: 'web', maxLado: 512, calidad: 0.9 })
      /*
       * Si sigue siendo una imagen escrita dentro del texto es que no se pudo
       * subir —modo demostración, o falta ejecutar `supabase/imagenes.sql`—, y
       * entonces sí manda el tope: lo que se guarde va dentro de los ajustes.
       */
      if (guardado.startsWith('data:') && guardado.length > MAX_LOGO_BYTES) {
        setLogoError('Esa imagen pesa demasiado para guardarla aquí. Prueba con una más pequeña.')
        return
      }
      update('logoDataUrl', guardado)
    } finally {
      setSubiendoLogo(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // «Guardado correctamente» solo si de verdad se ha guardado.
    const r = await saveHermandadSettings(settings)
    setErrorGuardar(r.ok ? null : (r.error ?? 'No se pudo guardar.'))
    setSaved(r.ok)
    if (r.ok) setTimeout(() => setSaved(false), 3000)
  }

  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  /**
   * Las papeletas de la campaña activa, solo para poder avisar antes de quitar
   * un tramo que tiene gente dentro. Se lee del espejo del navegador y no de
   * la tabla remota a propósito: es un aviso, no un dato de trabajo, y montar
   * aquí otra suscripción a `papeletas` por esto sería caro. Si la lista viene
   * vacía se pierde el aviso, pero Cortejo las recoge igualmente después.
   */
  const papeletasDelAnio = useMemo(
    () => leerDatos<Papeleta>(CLAVES_DATOS.papeletas, []).filter((p) => p.anio === getCampana().anio),
    [],
  )
  /*
   * El precio de la papeleta es de la HERMANDAD, no de este navegador.
   *
   * Estaba en `localStorage`: el tesorero ponía 18 € en su ordenador y la
   * secretaria, desde el suyo, emitía todo el año al precio de fábrica. Ni
   * fallaba ni avisaba — cada uno cobraba una cosa. Ahora sale de los ajustes,
   * que viajan con la hermandad.
   */
  const precioBase = settings.precioPapeleta
  /*
   * LOS CUERPOS Y LOS TRAMOS, en su sitio (`ajustes/cuerposYTramos.ts`). No
   * hace falta desarmar nada: la pantalla no usa ni uno de los diecinueve
   * valores que devuelve, se los lleva enteros su sección.
   */
  const cortejo = useCuerposYTramos({ papeletasDelAnio, precioBase, settings })





  return (
    <div className="dash">
      <div className="dash-head">
        <p className="eyebrow">Configuración</p>
        <h1>Ajustes de la hermandad</h1>
        <p className="dash-head__lead">
          Cómo se llama, cómo sale en los documentos y cómo trabajáis: el cortejo, las papeletas y
          las listas que usa toda la aplicación. Solo lo ves tú, desde aquí.
        </p>
      </div>

      <div className="cfg-layout">
        {/* Mismo raíl que el editor de la web: nueve bloques en una sola
            columna eran un scroll sin fin y cinco botones de «Guardar» que no
            se sabía a qué parte correspondían. */}
        <nav className="cms-rail" aria-label="Secciones de los ajustes">
          {SECCIONES_CFG.map((g) => (
            <div className="cms-rail__grupo" key={g.titulo}>
              <p className="cms-rail__titulo">{g.titulo}</p>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`cms-rail__item${seccion === it.id ? ' cms-rail__item--on' : ''}`}
                  onClick={() => irASeccion(it.id)}
                  aria-current={seccion === it.id ? 'true' : undefined}
                >
                  <span className="cms-rail__ic" aria-hidden="true">{it.icono}</span>
                  <span className="cms-rail__label">{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="cfg-panel">

      {seccion === 'hermandad' && (
      <form className="settings-layout" onSubmit={handleSubmit}>
        <section className="settings-card">
          <h2 className="settings-card__title">Escudo o logotipo</h2>
          <div className="logo-uploader">
            <span className="logo-preview">
              {settings.logoDataUrl ? (
                <img src={settings.logoDataUrl} alt="Logo de la hermandad" />
              ) : (
                <LogoMark size={38} />
              )}
            </span>
            <div className="logo-uploader__info">
              <div className="logo-uploader__actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={subiendoLogo}
                >
                  {subiendoLogo ? 'Subiendo…' : 'Subir imagen'}
                </button>
                {settings.logoDataUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => update('logoDataUrl', null)}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="form-hint">
                PNG, JPG o SVG. Se encoge sola, así que puedes subir la foto tal cual. Se usará
                en la cabecera de los recibos, en las papeletas y en la web.
              </p>
              {logoError && <p className="form-hint form-hint--error">{logoError}</p>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoChange}
              hidden
            />
          </div>

          <div className="color-picker-row">
            <span className="color-picker-swatch" style={{ background: settings.colorPrimario }} aria-hidden="true" />
            <div className="form-row">
              <label htmlFor="colorPrimario">Color de tu hermandad</label>
              <div className="color-picker-controls">
                <input
                  id="colorPrimario"
                  type="color"
                  value={settings.colorPrimario}
                  onChange={(e) => update('colorPrimario', e.target.value)}
                />
                <input
                  type="text"
                  className="color-picker-hex"
                  aria-label="Color de tu hermandad en hexadecimal"
                  value={settings.colorPrimario}
                  onChange={(e) => update('colorPrimario', e.target.value)}
                  placeholder="#caa24a"
                  maxLength={7}
                />
              </div>
              <p className="form-hint">Tiñe los botones y acentos del área del hermano de tus hermanos/as.</p>
            </div>
          </div>

          <div className="color-picker-row">
            <span className="color-picker-swatch" style={{ background: settings.colorSecundario }} aria-hidden="true" />
            <div className="form-row">
              <label htmlFor="colorSecundario">Segundo color (acento)</label>
              <div className="color-picker-controls">
                <input
                  id="colorSecundario"
                  type="color"
                  value={settings.colorSecundario}
                  onChange={(e) => update('colorSecundario', e.target.value)}
                />
                <input
                  type="text"
                  className="color-picker-hex"
                  aria-label="Segundo color en hexadecimal"
                  value={settings.colorSecundario}
                  onChange={(e) => update('colorSecundario', e.target.value)}
                  placeholder="#C5A059"
                  maxLength={7}
                />
              </div>
              <p className="form-hint">Color dorado o de detalle: filetes, degradados de la cabecera y la web.</p>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <h2 className="settings-card__title">Datos fiscales y de contacto</h2>

          <div className="form-row">
            <label htmlFor="nombreLegal">Nombre legal de la hermandad</label>
            <input
              id="nombreLegal"
              value={settings.nombreLegal}
              onChange={(e) => update('nombreLegal', e.target.value)}
              placeholder="Hermandad de la Vera-Cruz"
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="cif">CIF / NIF</label>
              <input
                id="cif"
                value={settings.cif}
                onChange={(e) => update('cif', e.target.value)}
                placeholder="G41000001"
              />
              <AvisoDeCampo texto={problemaDeNif(settings.cif)} />
              <p className="form-hint">Sale en las facturas de la tienda. Las hermandades suelen tener una G o una R.</p>
            </div>
            <div className="form-row">
              <label htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                value={settings.telefono}
                onChange={(e) => update('telefono', e.target.value)}
                type="tel"
                inputMode="tel"
                placeholder="954 00 00 00"
              />
              <AvisoDeCampo texto={problemaDeTelefono(settings.telefono)} />
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="direccion">Dirección</label>
            <input
              id="direccion"
              value={settings.direccion}
              onChange={(e) => update('direccion', e.target.value)}
              placeholder="Plaza de la Hermandad, 3"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="codigoPostal">Código postal</label>
              <input
                id="codigoPostal"
                value={settings.codigoPostal}
                onChange={(e) => update('codigoPostal', e.target.value)}
                inputMode="numeric"
                maxLength={5}
                placeholder="41010"
              />
              <AvisoDeCampo texto={problemaDeCodigoPostal(settings.codigoPostal)} />
            </div>
            <div className="form-row">
              <label htmlFor="ciudad">Ciudad</label>
              <input
                id="ciudad"
                value={settings.ciudad}
                onChange={(e) => update('ciudad', e.target.value)}
                placeholder="Sevilla"
              />
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="provincia">Provincia</label>
            <input
              id="provincia"
              value={settings.provincia}
              onChange={(e) => update('provincia', e.target.value)}
              placeholder="Sevilla"
            />
            <p className="form-hint">Aparece en el Estado de Cuentas anual (Informes).</p>
          </div>

          <div className="form-row">
            <label htmlFor="email">Correo de contacto</label>
            <input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="secretaria@tuhermandad.org"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="iban">IBAN de la hermandad</label>
              <input
                id="iban"
                value={settings.iban}
                onChange={(e) => update('iban', e.target.value)}
                placeholder="ES91 2100 0418 4502 0005 1332"
              />
              <AvisoDeCampo
                texto={settings.iban.trim() && !ibanValido(settings.iban)
                  ? `Ese IBAN no vale: ${porQueNoValeElIban(settings.iban)}.`
                  : null}
              />
              <p className="form-hint">Para domiciliar cuotas y para que los hermanos paguen por transferencia.</p>
            </div>
            <div className="form-row">
              <label htmlFor="bizumTelefono">Teléfono del Bizum</label>
              <input
                id="bizumTelefono"
                type="tel"
                value={settings.bizumTelefono}
                onChange={(e) => update('bizumTelefono', e.target.value)}
                inputMode="tel"
                placeholder="600 00 00 00"
              />
              <AvisoDeCampo texto={problemaDeBizum(settings.bizumTelefono)} />
              <p className="form-hint">Los hermanos verán este número en su área para pagar la papeleta por Bizum.</p>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="identificadorAcreedor">Identificador de acreedor SEPA</label>
            <input
              id="identificadorAcreedor"
              value={settings.identificadorAcreedor}
              onChange={(e) => update('identificadorAcreedor', e.target.value)}
              maxLength={20}
              placeholder="ES11000B12345674"
            />
            <AvisoDeCampo texto={problemaDeIdentificadorAcreedor(settings.identificadorAcreedor)} />
            <p className="form-hint">Lo asigna tu banco al dar de alta el adeudo directo SEPA. Hace falta para generar la remesa.</p>
            {/*
              EL QUE LE TOCA, CALCULADO, MIENTRAS EL BANCO NO LO DÉ.
              No es adivinar: el identificador es el país + dos cifras de
              control + un código de negocio + el NIF, y las cifras de control
              salen del NIF. Así que con el NIF puesto ya se sabe cuál será,
              salvo que el banco dé un código de negocio distinto del «000».
              Es el trámite que más tarda de todos, y verlo escrito quita la
              sensación de estar esperando a algo indescifrable.
            */}
            {!settings.identificadorAcreedor.trim() && identificadorQueLeToca(settings.cif) && (
              <>
                <p className="form-hint">
                  Con el NIF <b>{settings.cif}</b>, el que os tocará es{' '}
                  <b>{identificadorQueLeToca(settings.cif)}</b> —el país, dos cifras de control que
                  salen del NIF, el código de negocio «000» y el NIF—. Si el banco os da otro código
                  de negocio, cambian solo esos tres caracteres del medio.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => update('identificadorAcreedor', identificadorQueLeToca(settings.cif))}
                >
                  Ponerlo mientras llega el del banco
                </button>
              </>
            )}
          </div>

          {/*
            C4 · LA CUENTA A LA QUE VA EL DINERO DE LAS TARJETAS.
            No es una clave secreta: es el destinatario del cobro. La clave con
            la que se habla con Stripe vive en el servidor, y guardar aquí la de
            cada hermandad sería una fuga con veinte cuentas dentro.
          */}
          <div className="form-row">
            <label htmlFor="stripeCuenta">Cuenta de cobro con tarjeta</label>
            <input
              id="stripeCuenta"
              value={settings.stripeCuenta}
              onChange={(e) => update('stripeCuenta', e.target.value.trim())}
              placeholder="acct_1AbCdEfGhIjKlMnO"
              maxLength={40}
            />
            <AvisoDeCampo
              texto={settings.stripeCuenta.trim() && !/^acct_[A-Za-z0-9]{8,}$/.test(settings.stripeCuenta.trim())
                ? 'Un identificador de cuenta de Stripe empieza por «acct_». Cópialo del panel de '
                  + 'Stripe, en Configuración → Datos de la cuenta.'
                : null}
            />
            <p className="form-hint">
              Con esto, los hermanos pueden pagar su cuota y su papeleta con tarjeta desde su área,
              y el recibo se marca solo. <b>El dinero va directo a vuestra cuenta</b>: Gobergo no
              lo toca ni se queda comisión. La de Stripe la asume la hermandad.
              {' '}Déjalo vacío si no queréis cobrar con tarjeta.
            </p>
          </div>

          <div className="form-row">
            <label htmlFor="textoPieDocumentos">Texto legal del pie de recibos y justificantes</label>
            <textarea
              id="textoPieDocumentos"
              rows={2}
              value={settings.textoPieDocumentos}
              onChange={(e) => update('textoPieDocumentos', e.target.value)}
              placeholder="Ej. Entidad acogida a la Ley 49/2002; las cuotas y donativos pueden desgravar en el IRPF."
            />
            <p className="form-hint">Aparece al pie de los recibos de cuotas y justificantes de tesorería. Si lo dejas vacío se usa un texto genérico.</p>
          </div>
        </section>

        <div className="settings-actions">
          {saved && <span className="alert-item alert-item--ok">Guardado correctamente</span>}
          {errorGuardar && <span className="alert-item alert-item--warn">{errorGuardar}</span>}
          <button type="submit" className="btn btn-primary">
            Guardar cambios
          </button>
        </div>
      </form>
      )}

      {seccion === 'cortejo' && (
        <CuerposYTramos cortejo={cortejo} update={update} precioBase={precioBase} />
      )}

      {seccion === 'papeletas' && (
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">La papeleta simbólica</h2>
        </div>
        {/*
          * UNA SOLA, Y SE LLAMA ASÍ.
          *
          * Aquí hubo una lista de «papeletas personalizadas» con nombre y precio
          * libres, y fue un error mío. Era un tramo pobre: tenía su propio
          * nombre y su propio precio, así que dos hermanos del mismo sitio
          * podían acabar pagando distinto según por dónde se les hubiera
          * emitido. Y se usaba para cosas que sí caminan —una mantilla, un
          * nazareno de cirio—, que son TRAMOS y ya tienen dónde definirse, con
          * su aforo, su hora de citación y su precio.
          *
          * Lo único que de verdad no es un tramo es esto: quien tiene derecho a
          * su sitio y ese año no sale. Si quiere salir, sitio hay.
          */}
        <p className="form-hint">
          Es la papeleta de quien <b>tiene su sitio y este año no sale</b>: la saca por
          costumbre, por acompañar a la hermandad o por ayudar, pero no camina y no ocupa
          puesto en el cortejo.
        </p>
        <p className="form-hint">
          Todo lo que <b>sí camina</b> —una mantilla, un nazareno de cirio, un monaguillo—
          es un tramo, y se define en <b>Cuerpos y tramos</b> con su aforo, su precio y su
          hora de citación. Ahí es donde se monta el cortejo.
        </p>

        <div className="form-row">
          <label htmlFor="precioSimbolica">Precio de la papeleta simbólica</label>
          <div className="opcion-row__importe">
            <input
              id="precioSimbolica"
              type="number"
              min="0"
              step="0.5"
              value={settings.precioSimbolica}
              onChange={(e) => update('precioSimbolica', Number(e.target.value) || 0)}
            />
            <span>€</span>
          </div>
        </div>

        <div className="settings-actions">
          {saved && <span className="alert-item alert-item--ok">Guardado</span>}
          {errorGuardar && <span className="alert-item alert-item--alerta">{errorGuardar}</span>}
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            Guardar
          </button>
        </div>
      </section>
      )}

      <CatalogosYCuotas abierta={seccion === 'catalogos'} />

      {seccion === 'ficha' && <CamposPropiosCard />}

      {seccion === 'conexiones' && <ConexionesCard />}
      {seccion === 'correo' && <CorreoCard />}

      {seccion === 'puesta' && <PuestaEnMarchaCard />}

      {seccion === 'traer' && <TraerDatos />}

      <CopiasYDatos abierta={seccion === 'datos'} settings={settings} />
        </div>
      </div>
    </div>
  )
}




