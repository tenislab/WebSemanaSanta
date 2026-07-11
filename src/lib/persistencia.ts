import { useEffect, useState } from 'react'

/**
 * Claves de localStorage de cada colección de datos. Centralizadas aquí para
 * que "Restablecer datos de ejemplo" (Configuración) pueda borrarlas todas y
 * para que el panel de Inicio pueda leerlas sin montar cada módulo.
 * Papeletas y Cortejo comparten la misma clave a propósito: son dos vistas
 * de la misma colección, y al navegar entre ellas cada página se monta de
 * nuevo y lee la última versión guardada.
 */
export const CLAVES_DATOS = {
  hermanos: 'cabildo-hermanos',
  cuotas: 'cabildo-cuotas',
  papeletas: 'cabildo-papeletas',
  incidencias: 'cabildo-incidencias',
  movimientos: 'cabildo-movimientos',
  enseres: 'cabildo-enseres',
  documentos: 'cabildo-documentos',
  comunicados: 'cabildo-comunicados',
  cuentasSociales: 'cabildo-cuentas-sociales',
} as const

/** Lee una colección guardada, o devuelve los datos de ejemplo si aún no hay nada. */
export function leerPersistido<T>(clave: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(clave)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // localStorage no disponible o datos corruptos: seguimos con los de ejemplo
  }
  return fallback
}

/**
 * Como useState, pero cada cambio queda guardado en localStorage, de modo
 * que altas, pagos, asignaciones, etc. sobreviven a una recarga de página.
 * Es el paso intermedio hasta conectar Supabase: la firma no cambia, así
 * que sustituirlo por la base de datos real no tocará los componentes.
 */
export function usePersistentState<T>(clave: string, inicial: T) {
  const [value, setValue] = useState<T>(() => leerPersistido(clave, inicial))

  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(value))
    } catch {
      // sin espacio o sin localStorage: la app sigue funcionando en memoria
    }
  }, [clave, value])

  return [value, setValue] as const
}

/** Borra todos los datos guardados y vuelve a los de ejemplo (recarga incluida). */
export function restablecerDatosDeEjemplo() {
  // Todas las claves de la app (colecciones, configuración, catálogos, tramos,
  // campaña…) comparten el prefijo cabildo-; se barre todo salvo la sesión demo.
  Object.keys(localStorage)
    .filter((clave) => clave.startsWith('cabildo-') && clave !== 'cabildo-demo-user')
    .forEach((clave) => localStorage.removeItem(clave))
  window.location.reload()
}
