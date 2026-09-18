/**
 * LAS CUENTAS DE LA HERMANDAD EN LAS REDES, Y LO QUE HACE FALTA PARA PUBLICAR.
 *
 * Esto no publica nada solo, y es a propósito: la API de Meta pide cuenta de
 * empresa, aplicación revisada y permisos que caducan por su cuenta, y una
 * hermandad que se queda sin publicar sin enterarse está peor que antes. Lo
 * que hay aquí es lo que necesita UNA PERSONA para publicarlo en un minuto:
 * qué cuentas hay puestas, el enlace de la web para que el post lo lleve, y si
 * el móvil sabe compartir.
 *
 * Sale de `Comunicados.tsx` entero —el estado, las dos funciones y los tres
 * cálculos— porque no lo usa nada más de esa pantalla: la lista de
 * comunicados, los segmentos y el envío por correo no tocan ni una línea de
 * aquí. Se devuelve en un solo objeto, y la pantalla lo desarma; así el panel
 * se lleva `redes` y nada más.
 */
import { useMemo, useState } from 'react'
import type { CuentaSocial, RedSocial } from '../../../data/comunicados'
import { useCuentasSociales } from '../../../lib/db/comunicados'
import { normalizarUsuario, sePuedeCompartirConElMovil } from '../../../lib/redesSociales'
import { getWebPublica } from '../../../lib/webPublica'
import { baseDeLaWeb } from '../../../lib/seoWeb'

export interface LasRedes {
  cuentas: CuentaSocial[]
  cuentasConectadas: CuentaSocial[]
  /** Cuál se está editando ahora mismo, o `null` si ninguna. */
  conectando: RedSocial | null
  setConectando: (r: RedSocial | null) => void
  usuarioInput: string
  setUsuarioInput: (v: string) => void
  errorRed: string
  setErrorRed: (v: string) => void
  /** Qué red acaba de copiarse, para poder decir «✓ Copiado» en su botón. */
  copiado: RedSocial | null
  setCopiado: (r: RedSocial | null) => void
  /** La dirección pública de la hermandad, o `null` si la web no está publicada. */
  enlaceDeLaWeb: string | null
  compartirMovil: boolean
  conectar: (red: RedSocial) => void
  desconectar: (red: RedSocial) => void
}

export function useLasRedes(): LasRedes {
  const [cuentas, setCuentas] = useCuentasSociales()
  const [conectando, setConectando] = useState<RedSocial | null>(null)
  const [usuarioInput, setUsuarioInput] = useState('')
  const [errorRed, setErrorRed] = useState('')
  const [copiado, setCopiado] = useState<RedSocial | null>(null)

  const cuentasConectadas = useMemo(() => cuentas.filter((c) => c.conectada), [cuentas])

  /*
   * La dirección pública de la hermandad, para que la publicación lleve enlace.
   * Solo si la web está PUBLICADA: mandar a la gente a una web sin publicar es
   * mandarla a una página que no existe.
   */
  const enlaceDeLaWeb = useMemo(() => {
    const web = getWebPublica()
    if (!web.publicada) return null
    const origen = typeof window !== 'undefined' ? window.location.origin : ''
    return baseDeLaWeb(web, origen)
  }, [])

  /*
   * Se mira una vez al pintar y no en cada fila: `navigator.share` no cambia a
   * media sesión, y llamarlo cinco veces por comunicado no aporta nada.
   */
  const compartirMovil = useMemo(() => sePuedeCompartirConElMovil(), [])

  /**
   * Conectar una red = decir cuál es la cuenta de la hermandad.
   *
   * Antes esto ponía «@hermandaddemo» si no se escribía nada, así que se
   * pulsaba «Conectar» y quedaba conectada a una cuenta inventada. Ahora sin
   * nombre no se conecta, y se acepta tanto «@hermandad» como la dirección
   * entera pegada del navegador, que es lo que la gente tiene a mano.
   */
  function conectar(red: RedSocial) {
    const usuario = normalizarUsuario(usuarioInput)
    if (!usuario || usuario === '@') {
      setErrorRed('Escribe el nombre de la cuenta (@lahermandad) o pega la dirección de su página.')
      return
    }
    const escrito = usuarioInput.trim()
    const enlace = /^https?:\/\//i.test(escrito) ? escrito : null
    setCuentas((prev) => prev.map((c) => (c.red === red ? { ...c, conectada: true, usuario, enlace } : c)))
    setConectando(null)
    setUsuarioInput('')
    setErrorRed('')
  }

  function desconectar(red: RedSocial) {
    setCuentas((prev) => prev.map((c) => (c.red === red ? { ...c, conectada: false, usuario: null, enlace: null } : c)))
  }

  return {
    cuentas, cuentasConectadas,
    conectando, setConectando,
    usuarioInput, setUsuarioInput,
    errorRed, setErrorRed,
    copiado, setCopiado,
    enlaceDeLaWeb, compartirMovil,
    conectar, desconectar,
  }
}
