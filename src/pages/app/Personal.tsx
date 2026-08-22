import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import HermanoPicker from '../../components/HermanoPicker'
import { CARGOS, type Cargo } from '../../data/documentos'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import { CLAVE_PERSONAL, getPersonal, type MiembroPersonal } from '../../lib/personal'
import { MODULOS, usePermisosPorCargo, savePermisosPorCargo, useCargoDeLaSesion, puedeVerModulo } from '../../lib/permisos'
import { authUserIdActual } from '../../lib/multiHermandad'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { personalToRow, rowToPersonal } from '../../lib/db/personal'
import { guardarCargoDeHermano, hermanoToRow, rowToHermano } from '../../lib/db/hermanos'
import { CLAVES_DATOS } from '../../lib/persistencia'
import { hermanosAsignables } from '../../lib/asignables'
import { crearAccesoHermano, crearAccesoPersonal } from '../../lib/accesos'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ofrecerDeshacer, reinsertar } from '../../lib/deshacer'

/**
 * Los cargos que se pueden REPARTIR.
 *
 * «Hermano de a pie» está en el catálogo porque es lo que es casi todo el
 * censo, pero no tiene ni un módulo: ponérselo a alguien sería darle una
 * cuenta de panel que no ve nada, y encima le sacaría de las políticas de
 * hermano en la base de datos. Un hermano sin cargo se representa dejando el
 * cargo vacío, no poniéndole éste.
 */
const CARGOS_DE_JUNTA = CARGOS.filter((c) => c !== 'Hermano de a pie')

/** Quién está señalado en la ficha abierta: de qué lista sale y cuál es. */
type Señalado = { tipo: 'hermano' | 'personal'; id: string }

export default function Personal() {
  const { user } = useAuth()
  const nombreHermandad = (user?.user_metadata?.hermandad as string | undefined) ?? 'Tu hermandad'

  const [personal, setPersonal] = useSupabaseTable<MiembroPersonal>(
    'personal',
    CLAVE_PERSONAL,
    getPersonal(),
    personalToRow,
    rowToPersonal,
  )
  /*
   * El censo entero, porque los cargos viven en la ficha del hermano. Esta
   * pantalla ve lo mismo que Hermanos, así que espeja igual que ella (nada de
   * `sinEspejo`, que es solo para el área del hermano, donde cada uno ve una
   * fila y no debe pisar el espejo del censo completo).
   */
  const [hermanos, setHermanos] = useSupabaseTable<Hermano>(
    'hermanos',
    CLAVES_DATOS.hermanos,
    HERMANOS_INICIALES,
    hermanoToRow,
    rowToHermano,
    'numero',
  )

  const [señalado, setSeñalado] = useState<Señalado | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [cargoOpen, setCargoOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /*
   * El fallo de crear la cuenta va AQUÍ y no dentro del cajón, porque el cajón
   * se cierra al guardar y se lo llevaría con él. Es el mismo aviso, y por el
   * mismo motivo, que el de la pantalla de Hermanos.
   */
  const [avisoAcceso, setAvisoAcceso] = useState<string | null>(null)
  /* Quién soy yo, para no dejar que me cierre la puerta por dentro. */
  const [miUid, setMiUid] = useState<string | null>(null)
  /* Lo que se ha elegido en el desplegable, solo para poder decir debajo qué
     módulos abre antes de guardar. */
  const [cargoElegido, setCargoElegido] = useState<Cargo | null>(null)
  /* A quién se le está poniendo el cargo, para saber si hay que pedirle correo
     o si ya lo tiene en su ficha. */
  const [elegidoId, setElegidoId] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    void authUserIdActual().then((u) => { if (vivo) setMiUid(u ?? null) })
    return () => { vivo = false }
  }, [])
  const miCargo = useCargoDeLaSesion()
  /* Repartir cargos exige el módulo «Personal y permisos», y escribir en la
     ficha exige el de «Hermanos». La base pide uno de los dos; si esta cuenta
     no lleva ninguno, el desplegable no se ofrece — enseñarlo sería prometer
     algo que el disparador de la base va a deshacer sin decir nada. */
  const puedoRepartirCargos =
    puedeVerModulo(miCargo, 'personal') || puedeVerModulo(miCargo, 'hermanos')

  const permisosRemotos = usePermisosPorCargo()
  const [permisos, setPermisos] = useState<Record<Cargo, string[]>>(permisosRemotos)
  const [permisosTocado, setPermisosTocado] = useState(false)
  useEffect(() => {
    if (!permisosTocado) setPermisos(permisosRemotos)
  }, [permisosRemotos, permisosTocado])
  const [permisosSaved, setPermisosSaved] = useState(false)
  const [permisosError, setPermisosError] = useState<string | null>(null)

  /** Los hermanos que llevan cargo. Son la lista principal de esta pantalla. */
  const conCargo = useMemo(
    () => hermanos.filter((h) => h.cargo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [hermanos],
  )
  /* Quien SÍ puede recibir un cargo: del censo, sin baja y sin cargo todavía. */
  const sinCargo = useMemo(
    () => hermanos.filter((h) => h.estado !== 'Baja' && !h.cargo),
    [hermanos],
  )

  /*
   * LA MISMA PERSONA EN LAS DOS LISTAS, que es el enredo más caro de esta
   * pantalla y hay que enseñarlo, no esconderlo.
   *
   * María es hermana nº 214 y tiene desde el año pasado una fila de personal
   * como Tesorero/a. Este año la nombran Secretaria y se le pone «Secretario/a»
   * en su ficha. La pantalla la enseñaba dos veces con dos cargos distintos, y
   * lo que manda de verdad es la fila de personal —`cargoDeCuenta` la mira
   * primero—. María cambia el desplegable de arriba tres veces y sigue viendo
   * Tesorería. Ahí es donde se coge el teléfono.
   *
   * Se cruzan por cuenta y por correo, que son las dos formas en que una
   * persona puede estar duplicada.
   */
  const dobleFicha = useMemo(() => {
    const m = new Map<string, MiembroPersonal>()
    for (const h of conCargo) {
      const gemelo = personal.find(
        (p) =>
          p.activo
          && ((h.authUserId && p.authUserId === h.authUserId)
            || (h.email && p.email.toLowerCase() === h.email.toLowerCase())),
      )
      if (gemelo) m.set(h.id, gemelo)
    }
    return m
  }, [conCargo, personal])

  /*
   * ¿Cuánta gente puede repartir cargos si se quita este?
   *
   * De fábrica el único cargo con el módulo «personal» es el de Hermano Mayor.
   * Si se lo quita a sí mismo —o se lo cambia a Vocal creyendo que está
   * editando otra fila— nadie más puede volver a repartir cargos salvo el
   * titular. Y no se nota al momento: la sesión abierta sigue funcionando,
   * porque el cargo se resuelve una sola vez al entrar. El desastre aparece al
   * día siguiente, con el menú vacío.
   */
  function cuantosRepartenCargos(sinContar?: string): number {
    const abre = (c: string | null | undefined) => Boolean(c && (permisos[c as Cargo] ?? []).includes('personal'))
    const a = conCargo.filter((h) => h.id !== sinContar && h.estado !== 'Baja' && abre(h.cargo)).length
    const b = personal.filter((p) => p.activo && abre(p.cargo)).length
    return a + b
  }

  /* La ficha abierta se deriva de la lista, no se guarda copiada. Guardarla
     copiada obligaba a acordarse de parchear la copia en CADA cambio, y el
     día que alguien se olvidaba el formulario escribía sobre un valor viejo.
     Con dos listas eso sería inmanejable. */
  const hermanoAbierto = useMemo(
    () => (señalado?.tipo === 'hermano' ? (hermanos.find((h) => h.id === señalado.id) ?? null) : null),
    [señalado, hermanos],
  )
  const personalAbierto = useMemo(
    () => (señalado?.tipo === 'personal' ? (personal.find((p) => p.id === señalado.id) ?? null) : null),
    [señalado, personal],
  )

  const elegido = useMemo(
    () => (elegidoId ? (hermanos.find((h) => h.id === elegidoId) ?? null) : null),
    [elegidoId, hermanos],
  )

  const stats = useMemo(() => {
    const total = conCargo.length + personal.length
    const activos =
      conCargo.filter((h) => h.estado !== 'Baja').length + personal.filter((p) => p.activo).length
    const usados = new Set<string>()
    conCargo.forEach((h) => { if (h.cargo && h.estado !== 'Baja') usados.add(h.cargo) })
    personal.forEach((p) => { if (p.activo) usados.add(p.cargo) })
    return { total, activos, cargosEnUso: usados.size }
  }, [conCargo, personal])

  /**
   * Los módulos que abre un cargo, escritos para una persona.
   *
   * Un cargo no dice nada por sí solo: «Vocal» no le cuenta a la secretaria
   * que va a ver Eventos, Comunicados e Informes y nada más. Y al revés,
   * «Secretario/a» abre ocho módulos incluido el censo entero con DNI,
   * teléfonos y notas de salud. Eso hay que verlo ANTES de dárselo a alguien,
   * no después buscando su fila en la rejilla de abajo.
   */
  function modulosEnCristiano(cargo: Cargo | null | undefined): string {
    if (!cargo) return 'Nada del panel'
    const ids = permisos[cargo] ?? []
    if (!ids.length) return 'Ningún módulo'
    return MODULOS.filter((m) => ids.includes(m.id)).map((m) => m.label).join(', ')
  }

  /** ¿Puede esta persona entrar de verdad? Sin cuenta, no. */
  function sinAcceso(quien: { authUserId: string | null }): boolean {
    return isSupabaseConfigured && !quien.authUserId
  }

  /*
   * PONER UN CARGO A UN HERMANO. El camino principal de esta pantalla.
   *
   * No crea ninguna ficha: escribe el cargo en la que ya existe. Y si ese
   * hermano todavía no tenía cuenta, se la crea aquí — para llevar cargo hace
   * falta poder entrar, y para entrar hace falta una cuenta de verdad, porque
   * las políticas de la base de datos preguntan por ella.
   */
  async function handlePonerCargo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const hermanoId = String(data.get('hermanoId') ?? '')
    const cargo = String(data.get('cargo') ?? '') as Cargo
    const correo = String(data.get('correo') ?? '').trim().toLowerCase()

    const quien = hermanos.find((h) => h.id === hermanoId)
    if (!quien) {
      setError('Elige a quién le pones el cargo.')
      return
    }
    if (!cargo) {
      setError('Elige el cargo.')
      return
    }
    /* El correo de la ficha manda; la caja solo se enseña si no tiene, así que
       aquí `correo` viene vacío salvo en ese caso. NUNCA se pisa el correo que
       ya tenía: es por el que le llegan los recibos y los comunicados, y
       cambiarlo aquí sin querer los desviaría al buzón de secretaría sin que
       nadie lo relacione con haberle puesto un cargo tres meses antes. */
    const email = quien.email.includes('@') ? quien.email : correo
    if (!email.includes('@')) {
      setError(
        `Para llevar un cargo hace falta un correo: con cargo se entra al panel, y el panel lo `
        + `protege la base de datos, que necesita una cuenta de verdad. ${quien.nombre} no tiene `
        + `correo en su ficha. Ponle uno aquí y se le guardará también en el censo.`,
      )
      return
    }

    /*
     * ¿Ese correo ya es la cuenta de otra persona de la casa?
     *
     * El SQL permite a propósito que dos hermanos compartan correo —el padre
     * que apunta a sus dos hijos, el matrimonio que comparte dirección—, pero
     * Supabase exige que una cuenta tenga un correo único. Antes se intentaba
     * el alta igualmente, fallaba, y el aviso decía «ponle un correo suyo y
     * vuelve a intentarlo»: o sea, crea una SEGUNDA cuenta para la misma
     * persona, que es exactamente la doble identidad que esto venía a quitar.
     */
    let authUserId = quien.authUserId
    if (!authUserId) {
      const ya =
        personal.find((p) => p.authUserId && p.email.toLowerCase() === email.toLowerCase())
        ?? hermanos.find((h) => h.id !== hermanoId && h.authUserId && h.email.toLowerCase() === email.toLowerCase())
      if (ya) {
        setError(
          `El correo ${email} ya es la cuenta de ${ya.nombre}. Si es la misma persona, no hace `
          + `falta una cuenta nueva: usa esa. Si son dos personas distintas, ${quien.nombre} `
          + `necesita un correo propio — cámbialo en su ficha del censo y vuelve aquí.`,
        )
        return
      }
    }

    /* Si ya tiene cuenta no se crea otra: se le pone el cargo y ya está. */
    let aviso: string | null = null
    if (!authUserId && isSupabaseConfigured) {
      const r = await crearAccesoHermano(email, quien.claveAcceso, quien.dni, quien.nombre)
      /* O las dos cosas o ninguna: guardar el cargo de alguien que no puede
         entrar deja una fila que promete un acceso que no existe. */
      if (!r.id) {
        setError(r.error ?? 'No se ha podido crear su cuenta de acceso. El cargo no se ha puesto.')
        return
      }
      authUserId = r.id
      aviso = r.error
    }

    /* Se escribe COMPROBANDO: si la base revierte el cargo —porque esta cuenta
       no tiene permiso para repartirlos— hay que decirlo, no pintar un cargo
       que mañana no estará. */
    const guardado = await guardarCargoDeHermano(hermanoId, cargo)
    if (!guardado.ok) {
      setError(guardado.error)
      return
    }

    setHermanos((prev) =>
      prev.map((h) => (h.id === hermanoId ? { ...h, cargo, email, authUserId } : h)),
    )
    setCargoOpen(false)
    setError(null)
    /* El aviso, si lo hay, se pinta FUERA: este cajón acaba de cerrarse. */
    setAvisoAcceso(aviso)
    form.reset()
  }

  /**
   * Poner, cambiar o quitar el cargo de alguien que ya lo tenía.
   *
   * Las dos comprobaciones de antes de tocar nada no son celo: son las dos
   * formas conocidas de que una hermandad se quede sin poder entrar en su
   * propio panel.
   */
  async function cambiarCargo(id: string, cargo: Cargo | null) {
    const quien = hermanos.find((h) => h.id === id)
    if (!quien) return
    const antes = quien.cargo ?? null
    if (antes === cargo) return

    /* 1. Que no se quede la hermandad sin nadie que pueda repartir cargos. De
       fábrica el único cargo que abre «Personal y permisos» es el de Hermano
       Mayor: si se lo quita a sí mismo, ya no hay vuelta atrás desde dentro. */
    const seguiraAbriendo = Boolean(cargo && (permisos[cargo] ?? []).includes('personal'))
    if (!seguiraAbriendo && cuantosRepartenCargos(id) === 0) {
      setAvisoAcceso(
        `No se puede: ${quien.nombre} es la única persona que puede repartir cargos. Si se le `
        + `quita, nadie de la hermandad podrá volver a ponerlos —solo quien creó la cuenta—. `
        + `Dáselo antes a otra persona.`,
      )
      return
    }

    /* 2. Y si me lo estoy quitando a mí, que lo sepa antes y no mañana. La
       sesión abierta sigue funcionando: el cargo se resuelve una sola vez al
       entrar, así que el menú vacío no aparece hasta el día siguiente. */
    if (miUid && quien.authUserId === miUid) {
      const sigo = window.confirm(
        cargo
          ? `Te vas a cambiar a ti el cargo, de ${antes} a ${cargo}. La próxima vez que entres `
            + `verás solo los módulos de ${cargo}.`
          : `Te vas a quitar a ti el cargo de ${antes}. Dejarás de ver el panel en cuanto vuelvas `
            + `a entrar. ¿Seguro?`,
      )
      if (!sigo) return
    }

    const guardado = await guardarCargoDeHermano(id, cargo)
    if (!guardado.ok) {
      setAvisoAcceso(guardado.error)
      return
    }
    setHermanos((prev) => prev.map((h) => (h.id === id ? { ...h, cargo } : h)))
    if (!cargo) setSeñalado(null)
    /* Quitar o cambiar un cargo deja a alguien fuera del panel de un clic, así
       que se puede deshacer igual que se puede deshacer un borrado. */
    ofrecerDeshacer(
      cargo ? `${quien.nombre} pasa a ${cargo}` : `${quien.nombre} ya no es ${antes}`,
      () => {
        void guardarCargoDeHermano(id, antes)
        setHermanos((prev) => prev.map((h) => (h.id === id ? { ...h, cargo: antes } : h)))
      },
    )
  }

  /** Quitar el cargo: deja de gestionar, sigue siendo hermano. */
  function quitarCargo(id: string) {
    void cambiarCargo(id, null)
  }

  /**
   * Pasar a su ficha el cargo de un acceso antiguo, y borrar ese acceso.
   *
   * Es la única salida limpia cuando la misma persona está en las dos listas:
   * mientras existan las dos, manda la de personal y el desplegable de arriba
   * no hace nada, que es lo que desconcierta.
   */
  async function unificar(hermanoId: string, gemelo: MiembroPersonal) {
    const guardado = await guardarCargoDeHermano(hermanoId, gemelo.cargo)
    if (!guardado.ok) {
      setAvisoAcceso(guardado.error)
      return
    }
    setHermanos((prev) =>
      prev.map((h) =>
        h.id === hermanoId ? { ...h, cargo: gemelo.cargo, authUserId: h.authUserId ?? gemelo.authUserId } : h,
      ),
    )
    const posicion = personal.findIndex((p) => p.id === gemelo.id)
    setPersonal((prev) => prev.filter((p) => p.id !== gemelo.id))
    ofrecerDeshacer(`${gemelo.nombre} ya es una sola ficha`, () => {
      setPersonal((prev) => reinsertar(prev, gemelo, posicion))
    })
  }

  /*
   * DAR DE ALTA A ALGUIEN QUE NO ES HERMANO.
   *
   * Entra en el censo como HERMANO CIVIL: tiene su ficha, su acceso y su área,
   * y NO se le emiten cuotas. Es la figura para quien trabaja en la hermandad
   * sin ser hermano de ella —un administrativo contratado, un asesor—.
   *
   * Antes esto creaba una fila en `personal`, que era una segunda forma de
   * existir en el sistema con sus propias reglas. Se sigue pudiendo entrar por
   * ahí a quien ya estuviera, pero no se dan altas nuevas: una persona, una
   * ficha.
   *
   * Va con número 0, fuera del escalafón. Si ocupara un puesto, todos los
   * hermanos de detrás bajarían uno, y eso se ve el día de la salida.
   */
  async function handleAltaCivil(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const email = String(data.get('email') ?? '').trim().toLowerCase()
    const dni = String(data.get('dni') ?? '').trim().toUpperCase()
    const clave = String(data.get('clave') ?? '').trim()
    const cargo = String(data.get('cargo') ?? '') as Cargo

    if (!nombre || !email || !dni) {
      setError('Hacen falta el nombre, el correo y el DNI.')
      return
    }
    if (!cargo) {
      setError('Elige el cargo. De él depende lo que esta persona va a ver.')
      return
    }
    if (clave.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (hermanos.some((h) => h.dni.toUpperCase() === dni)) {
      setError(`Ya hay alguien en el censo con el DNI ${dni}.`)
      return
    }
    /* El correo se mira en las DOS listas: si ya lo usa alguien, la cuenta va
       a fallar igual y es mejor decirlo antes de guardar nada. */
    if (
      personal.some((p) => p.email.toLowerCase() === email)
      || hermanos.some((h) => h.email.toLowerCase() === email && h.authUserId)
    ) {
      setError(`Ese correo ya lo usa otra cuenta. Ponle uno suyo.`)
      return
    }

    const r = await crearAccesoHermano(email, clave, dni, nombre)
    const nuevo: Hermano = {
      id: nuevoId(),
      numero: 0,
      nombre,
      estado: 'Activo',
      antiguedad: new Date().getFullYear(),
      email,
      telefono: '',
      direccion: '',
      cuotaAlDia: false,
      iban: null,
      dni,
      claveAcceso: clave,
      authUserId: r.id,
      civil: true,
      cargo: cargo || null,
    }
    setHermanos((prev) => [...prev, nuevo])
    setFormOpen(false)
    setError(null)
    setAvisoAcceso(r.error)
    form.reset()
  }

  /*
   * Volver a intentar crear la cuenta de alguien que se quedó sin ella.
   *
   * Hasta ahora no había NINGUNA forma de recuperarse de eso desde la pantalla:
   * la ficha quedaba guardada, la cuenta no, y esa persona no podía entrar
   * nunca. La causa más común —el correo ya usado— se arregla cambiándole el
   * correo, y entonces hace falta poder reintentar.
   */
  async function reintentarAcceso(h: Hermano) {
    const r = await crearAccesoHermano(h.email, h.claveAcceso, h.dni, h.nombre)
    if (r.error) {
      setAvisoAcceso(r.error)
      return
    }
    setHermanos((prev) => prev.map((x) => (x.id === h.id ? { ...x, authUserId: r.id } : x)))
    setAvisoAcceso(null)
  }

  async function reintentarAccesoPersonal(m: MiembroPersonal) {
    const r = await crearAccesoPersonal(m.email, m.clave, m.nombre, m.cargo, nombreHermandad)
    if (r.error) {
      setAvisoAcceso(r.error)
      return
    }
    setPersonal((prev) => prev.map((x) => (x.id === m.id ? { ...x, authUserId: r.id } : x)))
    setAvisoAcceso(null)
  }

  function toggleActivo(id: string) {
    setPersonal(personal.map((p) => (p.id === id ? { ...p, activo: !p.activo } : p)))
  }

  function eliminar(id: string) {
    const posicion = personal.findIndex((p) => p.id === id)
    const quien = personal[posicion]
    setPersonal(personal.filter((p) => p.id !== id))
    setSeñalado(null)
    // «Eliminar acceso» está al lado de «Desactivar acceso» y se parecen. El
    // de al lado es reversible con un clic; este dejaba a la secretaria fuera
    // sin manera de volver.
    if (quien) {
      ofrecerDeshacer(`Acceso de ${quien.nombre} eliminado`, () => {
        setPersonal((prev) => reinsertar(prev, quien, posicion))
      })
    }
  }

  function togglePermiso(cargo: Cargo, moduloId: string) {
    setPermisos((prev) => {
      const actuales = prev[cargo] ?? []
      const siguiente = actuales.includes(moduloId)
        ? actuales.filter((m) => m !== moduloId)
        : [...actuales, moduloId]
      return { ...prev, [cargo]: siguiente }
    })
    setPermisosTocado(true)
    setPermisosSaved(false)
  }

  async function handleSavePermisos() {
    const r = await savePermisosPorCargo(permisos)
    // El verde solo si de verdad se ha guardado. Antes salía siempre: se le
    // quitaba «hermanos» al tesorero, aparecía el visto bueno, y al volver a
    // entrar seguía viéndolo. Nadie sabía por qué.
    if (!r.ok) {
      setPermisosError(r.error ?? 'No se han podido guardar los permisos.')
      return
    }
    setPermisosError(null)
    setPermisosTocado(false)
    setPermisosSaved(true)
    setTimeout(() => setPermisosSaved(false), 3000)
  }

  return (
    <div className="dash">
      {avisoAcceso && (
        <div className="banner-inline banner-inline--warn" role="alert">
          <span>{avisoAcceso}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvisoAcceso(null)}>
            Entendido
          </button>
        </div>
      )}

      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Personal</p>
          <h1>Personal y permisos</h1>
          <p className="dash-head__lead">
            {stats.total} persona{stats.total === 1 ? '' : 's'} con acceso además del titular ·
            cada cargo ve solo los módulos que le permitas.
          </p>
        </div>
        <div className="dash-head__actions">
          <button className="btn btn-primary" onClick={() => { setError(null); setCargoElegido(null); setElegidoId(null); setCargoOpen(true) }}>
            + Poner un cargo
          </button>
          <button className="btn btn-outline" onClick={() => { setError(null); setCargoElegido(null); setFormOpen(true) }}>
            + Alguien de fuera
          </button>
        </div>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Con acceso al panel</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Además del titular</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Activos</span>
          <span className="stat-tile__value">{stats.activos}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Pueden entrar ahora</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cargos en uso</span>
          <span className="stat-tile__value">{stats.cargosEnUso}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">de {CARGOS_DE_JUNTA.length} posibles</span>
        </div>
      </section>

      {/* --- Los hermanos que llevan cargo. La lista principal. ------------ */}
      <section className="settings-card" style={{ marginTop: '1.6rem' }}>
        <div className="settings-card__head">
          <h2 className="settings-card__title">Hermanos con cargo</h2>
        </div>
        <p className="form-hint">
          Son hermanos del censo que además llevan un cargo. Entran a su área con su DNI y su
          clave, y al panel con su correo. Es la misma persona con dos puertas.
        </p>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th className="col-opcional">Nº</th>
                <th>Nombre</th>
                <th className="col-opcional">Correo</th>
                <th>Cargo</th>
                <th className="col-opcional"></th>
              </tr>
            </thead>
            <tbody>
              {conCargo.map((h) => (
                <tr
                  key={h.id}
                  onClick={() => setSeñalado({ tipo: 'hermano', id: h.id })}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="num col-opcional">{h.numero > 0 ? h.numero : '—'}</td>
                  <td>
                    <span className="row-person__name">{h.nombre}</span>
                    <span className="row-person__sub solo-movil">{h.cargo} · {h.email}</span>
                    {h.civil && <span className="pill pill--info" style={{ marginLeft: '.5rem' }}>Civil</span>}
                    {h.estado === 'Baja' && <span className="pill pill--off" style={{ marginLeft: '.5rem' }}>De baja</span>}
                  </td>
                  <td className="table-subtle col-opcional">
                    {h.email || '—'}
                    {sinAcceso(h) && (
                      <span className="pill pill--alerta" style={{ marginLeft: '.5rem' }}>Sin acceso</span>
                    )}
                  </td>
                  <td>
                    {/* Cambiar el cargo tiene que ser un gesto, no un viaje a
                        la ficha: es lo que más se hace aquí. Pero NO se ofrece
                        si esta cuenta no puede repartir cargos, ni mientras la
                        persona tenga además un acceso antiguo — en los dos
                        casos, cambiarlo aquí no haría nada. */}
                    {dobleFicha.has(h.id) ? (
                      <span className="pill pill--warn" title="Manda su acceso antiguo">
                        {dobleFicha.get(h.id)!.cargo} (acceso antiguo)
                      </span>
                    ) : puedoRepartirCargos ? (
                      <select
                        value={h.cargo ?? ''}
                        aria-label={`Cargo de ${h.nombre}`}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => void cambiarCargo(h.id, (e.target.value || null) as Cargo | null)}
                      >
                        {CARGOS_DE_JUNTA.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="pill pill--info">{h.cargo}</span>
                    )}
                  </td>
                  <td className="col-opcional">
                    {puedoRepartirCargos && !dobleFicha.has(h.id) && (
                      <button
                        className="icon-btn"
                        title="Quitar el cargo"
                        onClick={(e) => { e.stopPropagation(); quitarCargo(h.id) }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M5 12h14" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {conCargo.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    Ningún hermano lleva cargo todavía. Con «Poner un cargo» le das acceso al
                    panel a alguien que ya está en el censo, sin crearle una segunda ficha.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/*
          La misma persona en las dos listas. Se avisa arriba del todo porque
          es el enredo que más llamadas genera: se cambia el cargo de la ficha,
          no pasa nada, y nadie sabe por qué. Lo que manda es el acceso
          antiguo, y esto lo dice y ofrece la salida.
        */}
        {[...dobleFicha].map(([hid, gemelo]) => {
          const quien = conCargo.find((h) => h.id === hid)
          if (!quien) return null
          return (
            <div key={hid} className="banner-inline banner-inline--warn" role="status">
              <span>
                <b>{quien.nombre} está dos veces.</b> Tiene el cargo de {quien.cargo} en su ficha y
                además un acceso antiguo sin ficha como {gemelo.cargo}. Ahora mismo manda el
                antiguo, así que cambiar el cargo de su ficha no le hace nada.
              </span>
              {puedoRepartirCargos && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void unificar(hid, gemelo)}>
                  Dejar solo su ficha, con {gemelo.cargo}
                </button>
              )}
            </div>
          )
        })}
        {!puedoRepartirCargos && conCargo.length > 0 && (
          <p className="form-hint">
            Tu cargo no incluye «Personal y permisos», así que puedes ver quién lleva qué pero no
            cambiarlo. Si tienes que repartir cargos, pídeselo a quien lleve la hermandad.
          </p>
        )}
      </section>

      {/* --- La vía antigua, solo si queda alguien en ella. ---------------- */}
      {personal.length > 0 && (
        <section className="settings-card" style={{ marginTop: '1.6rem' }}>
          <div className="settings-card__head">
            <h2 className="settings-card__title">Accesos sin ficha en el censo</h2>
          </div>
          <p className="form-hint">
            La forma antigua de dar acceso: una cuenta suelta, sin ficha de hermano. Sigue
            funcionando y se puede seguir usando, pero para dar acceso a alguien nuevo es mejor
            ponerle el cargo en su ficha —una persona, una ficha— o darle de alta como hermano
            civil si no está en el censo.
          </p>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="col-opcional">Correo</th>
                  <th className="col-opcional">Cargo</th>
                  <th>Estado</th>
                  <th className="col-opcional"></th>
                </tr>
              </thead>
              <tbody>
                {personal.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSeñalado({ tipo: 'personal', id: p.id })}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="row-person__name">{p.nombre}</span>
                      <span className="row-person__sub solo-movil">{p.cargo} · {p.email}</span>
                    </td>
                    <td className="table-subtle col-opcional">
                      {p.email}
                      {sinAcceso(p) && (
                        <span className="pill pill--alerta" style={{ marginLeft: '.5rem' }}>Sin acceso</span>
                      )}
                    </td>
                    <td className="col-opcional">
                      <span className="pill pill--info">{p.cargo}</span>
                    </td>
                    <td>
                      <span className={`pill ${p.activo ? 'pill--ok' : 'pill--off'}`}>
                        {p.activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className="col-opcional">
                      <button
                        className="icon-btn"
                        title={p.activo ? 'Desactivar acceso' : 'Activar acceso'}
                        onClick={(e) => { e.stopPropagation(); toggleActivo(p.id) }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="settings-card" style={{ marginTop: '1.6rem' }}>
        <div className="settings-card__head">
          <h2 className="settings-card__title">Permisos por cargo</h2>
        </div>
        <p className="form-hint">
          Marca los módulos que cada cargo puede ver al iniciar sesión. Vale igual para los
          hermanos con cargo y para los accesos sin ficha: manda el cargo, no de dónde salga la
          persona.
        </p>
        {/*
          Y LO QUE MÁS SE PREGUNTA, dicho en primera persona.
          `cargo === null` significa titular: quien creó la hermandad. Esa
          cuenta no pasa por esta tabla —tiene que haber siempre alguien que
          pueda volver a entrar y repartir permisos— pero eso, escrito como
          «el titular de la hermandad siempre tiene acceso completo», nadie lo
          relaciona consigo mismo. Se le quitan los módulos al Hermano Mayor,
          no cambia nada, y parece que la tabla está rota.
        */}
        <p className={`form-hint${miCargo === null ? ' form-hint--ok' : ''}`}>
          {miCargo === null ? (
            <>
              <b>A ti esta tabla no te afecta:</b> creaste esta hermandad, así que verás todos los
              módulos siempre, marques lo que marques aquí — incluso si te quitas los de tu propio
              cargo. Tiene que haber alguien que pueda volver a entrar y repartir permisos. Para
              comprobar qué ve otra persona, míralo con su cuenta.
            </>
          ) : (
            <>El titular de la hermandad (quien creó la cuenta) no pasa por esta tabla: ve todos
            los módulos siempre.</>
          )}
        </p>
        <div className="table-card" style={{ overflowX: 'auto' }}>
          {/* La primera columna se queda fija al desplazar (ver .permisos-tabla). */}
          <table className="permisos-tabla">
            <thead>
              <tr>
                <th>Cargo</th>
                {MODULOS.map((m) => (
                  <th key={m.id} style={{ textAlign: 'center' }}>
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CARGOS.map((cargo) => (
                <tr key={cargo}>
                  <td>
                    <b>{cargo}</b>
                  </td>
                  {MODULOS.map((m) => (
                    <td key={m.id} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={(permisos[cargo] ?? []).includes(m.id)}
                        onChange={() => togglePermiso(cargo, m.id)}
                        aria-label={`${cargo} · ${m.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="settings-actions">
          {permisosSaved && <span className="alert-item alert-item--ok">Permisos guardados</span>}
          {permisosError && <span className="alert-item alert-item--alerta">{permisosError}</span>}
          <button type="button" className="btn btn-primary" onClick={handleSavePermisos}>
            Guardar permisos
          </button>
        </div>
      </section>

      {/* Ficha de un hermano con cargo */}
      <Drawer
        open={!!hermanoAbierto}
        onClose={() => setSeñalado(null)}
        title={hermanoAbierto?.nombre ?? ''}
        subtitle={hermanoAbierto?.cargo ?? undefined}
      >
        {hermanoAbierto && (
          <div className="ficha">
            <div className="ficha__row">
              <span className={`pill ${hermanoAbierto.estado === 'Baja' ? 'pill--off' : 'pill--ok'}`}>
                {hermanoAbierto.estado}
              </span>
              {hermanoAbierto.civil && <span className="pill pill--info">Hermano civil · no paga cuotas</span>}
              {sinAcceso(hermanoAbierto) && <span className="pill pill--alerta">Sin acceso: no puede entrar</span>}
            </div>
            <dl className="ficha__list">
              <div>
                <dt>Número de hermano</dt>
                <dd>{hermanoAbierto.numero > 0 ? hermanoAbierto.numero : '—'}</dd>
              </div>
              <div>
                <dt>Correo electrónico</dt>
                <dd>{hermanoAbierto.email || '—'}</dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>
                  {puedoRepartirCargos ? (
                    <select
                      value={hermanoAbierto.cargo ?? ''}
                      aria-label="Cargo"
                      onChange={(e) => void cambiarCargo(hermanoAbierto.id, (e.target.value || null) as Cargo | null)}
                    >
                      {CARGOS_DE_JUNTA.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    hermanoAbierto.cargo
                  )}
                </dd>
              </div>
              {/* Lo que ese cargo abre, en cristiano. Sin esto hay que
                  bajar hasta la rejilla de permisos y buscar su fila. */}
              <div>
                <dt>Verá</dt>
                <dd>{modulosEnCristiano(hermanoAbierto.cargo)}</dd>
              </div>
            </dl>
            <p className="form-hint">
              Entra a su área en <code>/hermano</code> con su DNI y su clave, y al panel en{' '}
              <code>/login</code> con su correo. Es la misma persona con dos puertas. Verá solo
              los módulos marcados para {hermanoAbierto.cargo} en la tabla de permisos.
            </p>
            {sinAcceso(hermanoAbierto) && (
              <p className="form-hint">
                No tiene cuenta, así que hoy NO puede entrar. Suele ser porque su correo ya lo
                usaba otra cuenta: cámbialo en su ficha del censo y vuelve a intentarlo.
              </p>
            )}
            <div className="assign-box__row">
              <Link
                className="btn btn-outline btn-sm"
                to={`/app/hermanos?ficha=${hermanoAbierto.id}`}
                onClick={() => setSeñalado(null)}
              >
                Ver su ficha completa
              </Link>
              {sinAcceso(hermanoAbierto) && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => reintentarAcceso(hermanoAbierto)}>
                  Reintentar crear su acceso
                </button>
              )}
              {/* Nunca «Eliminar»: borrarlo aquí sería borrar al hermano del
                  censo entero, con sus cuotas y su historial. */}
              {puedoRepartirCargos && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => quitarCargo(hermanoAbierto.id)}>
                  Quitar el cargo
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Ficha de un acceso sin ficha en el censo (la vía antigua) */}
      <Drawer
        open={!!personalAbierto}
        onClose={() => setSeñalado(null)}
        title={personalAbierto?.nombre ?? ''}
        subtitle={personalAbierto?.cargo}
      >
        {personalAbierto && (
          <div className="ficha">
            <div className="ficha__row">
              <span className={`pill ${personalAbierto.activo ? 'pill--ok' : 'pill--off'}`}>
                {personalAbierto.activo ? 'Activo' : 'Desactivado'}
              </span>
              {sinAcceso(personalAbierto) && <span className="pill pill--alerta">Sin acceso: no puede entrar</span>}
            </div>
            <dl className="ficha__list">
              <div>
                <dt>Correo electrónico</dt>
                <dd>{personalAbierto.email}</dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>{personalAbierto.cargo}</dd>
              </div>
              <div>
                <dt>Alta</dt>
                <dd>{personalAbierto.fechaAlta}</dd>
              </div>
            </dl>
            <p className="form-hint">
              Entra desde <code>/login</code> con este correo y su contraseña. Verá solo los
              módulos marcados para {personalAbierto.cargo} en la tabla de permisos. No tiene
              ficha en el censo: si además es hermano de la hermandad, lo suyo es ponerle el
              cargo en su ficha y eliminar este acceso, para que sea una sola persona.
            </p>
            <div className="assign-box__row">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleActivo(personalAbierto.id)}>
                {personalAbierto.activo ? 'Desactivar acceso' : 'Activar acceso'}
              </button>
              {sinAcceso(personalAbierto) && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => reintentarAccesoPersonal(personalAbierto)}>
                  Reintentar crear su acceso
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => eliminar(personalAbierto.id)}>
                Eliminar acceso
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Poner un cargo a un hermano del censo */}
      <Drawer
        open={cargoOpen}
        onClose={() => setCargoOpen(false)}
        title="Poner un cargo a un hermano"
        subtitle="Personal"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCargoOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="cargo-form" type="submit">
              Poner el cargo
            </button>
          </>
        }
      >
        <form id="cargo-form" className="app-form" onSubmit={handlePonerCargo}>
          {error && (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          )}
          <div className="form-row">
            <label htmlFor="hermanoId">¿A quién?</label>
            <HermanoPicker
              id="hermanoId"
              name="hermanoId"
              hermanos={hermanosAsignables(sinCargo)}
              placeholder="Busca por nombre o por número"
              /* Sin `textoVacio` a propósito: esa prop pinta arriba del todo
                 una opción de «dejar sin asignar», que aquí no tiene sentido
                 —un cargo es de alguien— y encima es lo primero que se pulsa
                 sin querer, borrando lo que se acababa de elegir. */
              valorId={elegidoId}
              onSelect={(p) => setElegidoId(p?.id ?? null)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="cargo-nuevo">Cargo</label>
            {/* SIN preseleccionar, y esto importa. Venía con «Secretario/a»
                puesto: quien daba de alta al administrativo contratado
                rellenaba nombre, DNI y correo, no bajaba la vista hasta el
                desplegable porque no creía que hiciera falta, y le daba a
                Guardar. Ese señor quedaba de Secretario/a — o sea, con el
                censo completo de ochocientas fichas, con DNI, teléfonos y
                notas de salud. Sin un solo aviso en pantalla. */}
            <select id="cargo-nuevo" name="cargo" defaultValue="" required
              onChange={(e) => setCargoElegido(e.target.value as Cargo)}>
              <option value="" disabled>— Elige el cargo —</option>
              {CARGOS_DE_JUNTA.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <p className="form-hint">
              <b>Verá:</b> {modulosEnCristiano(cargoElegido)}
            </p>
          </div>
          {/*
            La caja del correo SOLO sale si el hermano elegido no tiene ninguno.
            Antes salía siempre y lo que se escribiera pisaba el correo de su
            ficha del censo, que es por el que le llegan los recibos y los
            comunicados. El marcador de posición invitaba además a poner el
            correo del cargo, no el de la persona: a partir de ahí, los avisos
            de esa hermana se iban al buzón de secretaría y nadie lo
            relacionaba con haberle puesto un cargo tres meses antes.
          */}
          {elegido && !elegido.email.includes('@') && (
            <div className="form-row">
              <label htmlFor="correo">Su correo</label>
              <input id="correo" name="correo" type="email" placeholder="nombre.apellido@correo.com" required />
              <p className="form-hint">
                {elegido.nombre} no tiene correo en su ficha. El que pongas aquí se guardará
                también en el censo, y será con el que entre.
              </p>
            </div>
          )}
          {elegido && elegido.email.includes('@') && (
            <p className="form-hint">
              Se le creará la cuenta con <b>{elegido.email}</b>, el correo que ya tiene en su
              ficha. Si hay que cambiarlo, se cambia en su ficha del censo.
            </p>
          )}
          <p className="form-hint">
            Para llevar un cargo hace falta correo, y no es burocracia: con cargo se entra al
            panel, y el panel lo protegen las reglas de la base de datos, que necesitan una
            cuenta de verdad para saber quién eres. Si el hermano ya tiene cuenta, se le pone el
            cargo y nada más; si no la tiene, se le crea con el correo de su ficha.
          </p>
          <p className="form-hint">
            No se le crea una segunda ficha: sigue siendo el mismo hermano, con su número, sus
            cuotas y su papeleta. Solo se le añade el cargo.
          </p>
        </form>
      </Drawer>

      {/* Alta de alguien que no es hermano */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Dar de alta a alguien de fuera"
        subtitle="Personal"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="personal-form" type="submit">
              Guardar
            </button>
          </>
        }
      >
        <form id="personal-form" className="app-form" onSubmit={handleAltaCivil}>
          {error && (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          )}
          <p className="form-hint">
            Para quien trabaja en la hermandad sin ser hermano de ella: un administrativo
            contratado, un asesor. Entra en el censo como <b>hermano civil</b>, con su ficha y
            su área, y <b>no se le emiten cuotas</b>. Tampoco ocupa número de hermano.
          </p>
          <div className="form-row">
            <label htmlFor="nombre">Nombre y apellidos</label>
            <input id="nombre" name="nombre" type="text" placeholder="Ej. María López" required />
          </div>
          <div className="form-row">
            <label htmlFor="dni">DNI</label>
            <input id="dni" name="dni" type="text" placeholder="12345678A" required />
          </div>
          <div className="form-row">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="administracion@tuhermandad.org" required />
          </div>
          <div className="form-row">
            <label htmlFor="clave">Contraseña de acceso</label>
            <input id="clave" name="clave" type="text" placeholder="Mín. 6 caracteres" required />
          </div>
          <div className="form-row">
            <label htmlFor="cargo">Cargo</label>
            <select id="cargo" name="cargo" defaultValue="" required
              onChange={(e) => setCargoElegido(e.target.value as Cargo)}>
              <option value="" disabled>— Elige el cargo —</option>
              {CARGOS_DE_JUNTA.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <p className="form-hint">
              <b>Verá:</b> {modulosEnCristiano(cargoElegido)}
            </p>
          </div>
          <p className="form-hint">
            Entrará a su área con su DNI y su clave, y al panel con su correo. Los módulos que
            verá se deciden en la tabla de permisos por cargo, más abajo en esta misma página.
          </p>
        </form>
      </Drawer>
    </div>
  )
}
