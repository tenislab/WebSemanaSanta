import { useEffect, useState } from 'react'
import Landing from './Landing'
import SitioPublico from './SitioPublico'
import { cargarWebPorDominio, type WebPublica } from '../lib/webPublica'
import { fijarHermandadDeLaPagina } from '../lib/multiHermandad'
import { esCasaDeCabildo } from '../lib/dominio'
import { isSupabaseConfigured } from '../lib/supabase'
import { LogoMark } from '../components/Logo'

/**
 * Qué se enseña al entrar por la puerta principal.
 *
 * Depende del dominio por el que se haya entrado, y esa es toda la gracia:
 *
 *   cabildo.es              → la página de Cabildo (vender la aplicación)
 *   hermandaddetriana.es    → la web DE ESA HERMANDAD
 *
 * Cuando una hermandad compra su dominio y lo apunta aquí, quien lo escriba
 * llega a la raíz. Antes se encontraba con la página de venta de Cabildo, que
 * es lo contrario de lo que se le prometió al configurarlo: la aplicación le
 * decía «apunta tu dominio y tu web se verá ahí» y luego enseñaba otra cosa.
 *
 * No hace falta dar de alta nada por cada hermandad: se mira si alguna tiene
 * puesto este dominio en su web y ya está. Configurarlo desde el módulo Web es
 * lo único que hay que hacer.
 */

export default function Raiz() {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  // En casa no se pregunta nada: se pinta la página de Cabildo al momento. Sin
  // esto, cada visita a la página de venta esperaría una consulta a la base de
  // datos para averiguar algo que ya se sabe.
  const enCasa = !isSupabaseConfigured || esCasaDeCabildo(host)

  const [web, setWeb] = useState<WebPublica | null>(null)
  const [buscando, setBuscando] = useState(!enCasa)

  useEffect(() => {
    if (enCasa) return
    let cancelado = false
    cargarWebPorDominio(host).then((r) => {
      if (cancelado) return
      if (r) {
        setWeb(r.web)
        fijarHermandadDeLaPagina(r.hermandadId)
      }
      setBuscando(false)
    })
    return () => {
      cancelado = true
    }
  }, [host, enCasa])

  if (buscando) {
    return (
      <div className="sitio-noweb" aria-busy="true">
        <LogoMark size={40} />
        <p>Cargando…</p>
      </div>
    )
  }

  // Hay una hermandad con este dominio: su web, como si se hubiera entrado por
  // /w/su-slug. Si no la hay —el dominio apunta aquí pero nadie lo ha
  // configurado todavía— se enseña la página de Cabildo, que al menos explica
  // qué es esto en vez de dar un error.
  if (web) return <SitioPublico webPorDominio={web} />
  return <Landing />
}
