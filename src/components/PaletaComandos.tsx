import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTema } from '../lib/tema'

export interface DestinoPaleta {
  to: string
  label: string
  grupo?: string
  icon?: ReactNode
}

interface Comando {
  id: string
  nombre: string
  grupo: string
  pista?: string
  icon?: ReactNode
  hacer: () => void
}

/** Quita tildes y mayúsculas: buscar «informes» debe encontrar «Informés». */
function llano(t: string) {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Paleta de comandos (Ctrl/⌘ + K). Ir a cualquier módulo o hacer lo de siempre
 * sin levantar las manos del teclado, desde cualquier pantalla.
 */
export default function PaletaComandos({
  destinos,
  onCerrarSesion,
}: {
  destinos: DestinoPaleta[]
  onCerrarSesion: () => void
}) {
  const [abierta, setAbierta] = useState(false)
  const [texto, setTexto] = useState('')
  const [activo, setActivo] = useState(0)
  const navigate = useNavigate()
  const listaRef = useRef<HTMLDivElement>(null)
  const [tema, ponerTema] = useTema()

  useEffect(() => {
    function atajo(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAbierta((v) => !v)
        setTexto('')
        setActivo(0)
      }
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [])

  const comandos = useMemo<Comando[]>(() => {
    const ir: Comando[] = destinos.map((d) => ({
      id: `ir:${d.to}`,
      nombre: d.label,
      grupo: d.grupo ?? 'Ir a',
      icon: d.icon,
      hacer: () => navigate(d.to),
    }))
    // Solo se ofrece lo que este cargo puede abrir de verdad.
    const puede = (to: string) => destinos.some((d) => d.to === to)
    const otros: Comando[] = [
      {
        id: 'tema',
        nombre: tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
        grupo: 'Acciones',
        hacer: () => ponerTema(tema === 'dark' ? 'light' : 'dark'),
      },
      ...(puede('/app/hermanos')
        ? [{
            id: 'nuevo-hermano',
            nombre: 'Dar de alta un hermano',
            grupo: 'Acciones',
            pista: 'Censo',
            hacer: () => navigate('/app/hermanos?nuevo=1'),
          }]
        : []),
      ...(puede('/app/eventos')
        ? [{
            id: 'nuevo-evento',
            nombre: 'Crear un evento',
            grupo: 'Acciones',
            pista: 'Agenda',
            hacer: () => navigate('/app/eventos?nuevo=1'),
          }]
        : []),
      {
        id: 'salir',
        nombre: 'Cerrar sesión',
        grupo: 'Acciones',
        hacer: onCerrarSesion,
      },
    ]
    return [...ir, ...otros]
  }, [destinos, navigate, onCerrarSesion, tema, ponerTema])

  const filtrados = useMemo(() => {
    const q = llano(texto.trim())
    const base = q ? comandos.filter((c) => llano(c.nombre).includes(q) || llano(c.grupo).includes(q)) : comandos
    if (!q) return base
    if (!comandos.some((c) => c.id === 'ir:/app/hermanos')) return base
    // Si lo escrito no es un comando, se ofrece buscarlo en el censo: es lo
    // que la gente busca el 90 % de las veces (un hermano por su nombre).
    return [
      ...base,
      {
        id: 'buscar-censo',
        nombre: `Buscar «${texto.trim()}» en el censo`,
        grupo: 'Buscar',
        hacer: () => navigate(`/app/hermanos?q=${encodeURIComponent(texto.trim())}`),
      },
    ]
  }, [comandos, texto, navigate])

  useEffect(() => { setActivo(0) }, [texto])

  useEffect(() => {
    if (!abierta) return
    listaRef.current?.querySelector('[data-activo="si"]')?.scrollIntoView({ block: 'nearest' })
  }, [activo, abierta])

  if (!abierta) return null

  function ejecutar(c: Comando) {
    setAbierta(false)
    setTexto('')
    c.hacer()
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setAbierta(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(i + 1, filtrados.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtrados[activo]) { e.preventDefault(); ejecutar(filtrados[activo]) }
  }

  let grupoAnterior = ''

  return (
    <div className="paleta-capa" role="dialog" aria-modal="true" aria-label="Ir a o hacer">
      <button className="paleta-fondo" aria-label="Cerrar" onClick={() => setAbierta(false)} />
      <div className="paleta">
        <input
          className="paleta__buscar"
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={teclas}
          placeholder="Escribe a dónde quieres ir o qué quieres hacer…"
          aria-label="Buscar"
        />
        <div className="paleta__lista" ref={listaRef}>
          {filtrados.length === 0 && <p className="paleta__nada">Nada que encaje con «{texto}».</p>}
          {filtrados.map((c, i) => {
            const cabecera = c.grupo !== grupoAnterior ? c.grupo : null
            grupoAnterior = c.grupo
            return (
              <div key={c.id}>
                {cabecera && <p className="paleta__grupo">{cabecera}</p>}
                <button
                  type="button"
                  className={`paleta__item${i === activo ? ' paleta__item--activo' : ''}`}
                  data-activo={i === activo ? 'si' : 'no'}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => ejecutar(c)}
                >
                  {c.icon && <span className="paleta__ic">{c.icon}</span>}
                  <span>{c.nombre}</span>
                  {c.pista && <small>{c.pista}</small>}
                </button>
              </div>
            )
          })}
        </div>
        <p className="paleta__pie">
          <kbd>↑</kbd><kbd>↓</kbd> moverse · <kbd>Intro</kbd> abrir · <kbd>Esc</kbd> cerrar
        </p>
      </div>
    </div>
  )
}
