const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

export function formatCurrency(value: number) {
  return currency.format(value)
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Oculta el centro de un IBAN, dejando visibles la entidad y los 4 últimos dígitos. */
export function maskIban(iban: string) {
  const compact = iban.replace(/\s+/g, '')
  if (compact.length <= 8) return iban
  return `${compact.slice(0, 4)} •••• •••• ${compact.slice(-4)}`
}

/**
 * Validación ligera de forma (no dígito de control): dos letras + dos dígitos
 * de control + el resto alfanumérico, longitud entre 15 y 34 caracteres una
 * vez quitados los espacios. Suficiente para detectar errores de escritura
 * sin implementar el cálculo mod-97 completo.
 */
export function isPlausibleIban(iban: string) {
  const compact = iban.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)
}
