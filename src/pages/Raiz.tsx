import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Landing from './Landing'

/*
 * La web de la hermandad se pide SOLO si hace falta.
 *
 * En gobergo.com («en casa») esta rama no se toca nunca: quien entra por la
 * puerta principal ve la página de venta, y no tiene por qué descargarse el
 * motor que pinta las webs de las hermandades —con su editor de secciones, su
 * galería y su portada— para verla.
 *
 * Y en un dominio de hermandad no cuesta nada, porque ahí ya se está
 * esperando a la consulta que dice de quién es el dominio: el trozo llega
 * mientras tanto.
 */
const SitioPublico = lazy(() => import('./SitioPublico'))
import { cargarWebPorDominio, type WebPublica } from '../lib/webPublica'
import { fijarHermandadDeLaPagina } from '../lib/multiHermandad'
import { esCasaDeGobergo } from '../lib/dominio'
import { isSupabaseConfigured } from '../lib/supabase'
import { LogoMark } from '../components/Logo'

/**
 * Qué se enseña al entrar por la puerta principal.
 *
 * Depende del dominio por el que se haya entrado, y esa es toda la gracia:
 *
 *   gobergo.es              → la página de Gobergo (vender la aplicación)
 *   hermandaddetriana.es    → la web DE ESA HERMANDAD
 *
 * Cuando una hermandad compra su dominio y lo apunta aquí, quien lo escriba
 * llega a la raíz. Antes se encontraba con la página de venta de Gobergo, que
 * es lo contrario de lo que se le prometió al configurarlo: la aplicación le
 * decía «apunta tu dominio y tu web se verá ahí» y luego enseñaba otra cosa.
 *
 * No hace falta dar de alta nada por cada hermandad: se mira si alguna tiene
 * puesto este dominio en su web y ya está. Configurarlo desde el módulo Web es
 * lo único que hay que hacer.
 */

/**
 * `soloWeb` marca las rutas que solo tienen sentido dentro de la web de una
 * hermandad: `/noticias`, `/n/…`, `/t/…`. Si se llega a ellas por un dominio
 * que no es de ninguna hermandad —el de Gobergo, por ejemplo— no hay noticia
 * que enseñar, y plantar ahí la página de venta sería mentir sobre lo que se
 * ha pedido. Se manda a la portada.
 */
/**
 * Lo máximo que la puerta principal se queda esperando a la base de datos.
 *
 * Tres segundos y medio son de sobra para una consulta que devuelve una fila
 * por un índice; si tarda más, no es que vaya lenta, es que no está
 * respondiendo. Y no se pone más corto porque en una conexión de móvil mala
 * una consulta normal puede pasar del segundo, y cortar ahí enseñaría la
 * página genérica a una hermandad que sí tiene su web puesta.
 */
const ESPERA_MAXIMA = 3500

export default function Raiz({ soloWeb = false }: { soloWeb?: boolean } = {}) {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  // En casa no se pregunta nada: se pinta la página de Gobergo al momento. Sin
  // esto, cada visita a la página de venta esperaría una consulta a la base de
  // datos para averiguar algo que ya se sabe.
  const enCasa = !isSupabaseConfigured || esCasaDeGobergo(host)

  const [web, setWeb] = useState<WebPublica | null>(null)
  const [buscando, setBuscando] = useState(!enCasa)

  useEffect(() => {
    if (enCasa) return
    let cancelado = false
    /*
     * SE DEJA DE ESPERAR, PERO NO DE ESCUCHAR.
     *
     * `cargarWebPorDominio` no tenía ningún tope: si la base tardaba en
     * contestar —el proyecto despertando de la pausa, que en el plan gratuito
     * es lo normal después de unas horas sin visitas— esta pantalla se quedaba
     * en «Cargando…» EXACTAMENTE lo que tardara. Sin error, sin límite y sin
     * nada que hacer más que mirarla. Y le pasa a quien entra por la puerta
     * principal, que muchas veces es alguien que viene a ver qué es esto.
     *
     * Pasado el tope se deja de bloquear y se pinta lo que corresponda a un
     * dominio del que todavía no se sabe nada, que es la página de Gobergo.
     * Pero la consulta SIGUE VIVA a propósito: si al final contesta que este
     * dominio es de una hermandad, su web entra igualmente. Así el caso lento
     * acaba enseñando lo correcto en vez de quedarse en lo genérico.
     */
    const reloj = setTimeout(() => {
      if (!cancelado) setBuscando(false)
    }, ESPERA_MAXIMA)
    cargarWebPorDominio(host).then((r) => {
      if (cancelado) return
      clearTimeout(reloj)
      if (r) {
        setWeb(r.web)
        fijarHermandadDeLaPagina(r.hermandadId)
      }
      setBuscando(false)
    })
    return () => {
      cancelado = true
      clearTimeout(reloj)
    }
  }, [host, enCasa])

  const cargando = (
    <div className="sitio-noweb" aria-busy="true">
      <LogoMark size={40} />
      <p>Cargando…</p>
    </div>
  )

  if (buscando) return cargando

  // Hay una hermandad con este dominio: su web, como si se hubiera entrado por
  // /w/su-slug. Si no la hay —el dominio apunta aquí pero nadie lo ha
  // configurado todavía— se enseña la página de Gobergo, que al menos explica
  // qué es esto en vez de dar un error.
  if (web) {
    return (
      <Suspense fallback={cargando}>
        <SitioPublico webPorDominio={web} />
      </Suspense>
    )
  }
  if (soloWeb) return <Navigate to="/" replace />
  return <Landing />
}
