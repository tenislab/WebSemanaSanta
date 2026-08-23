/** Supabase no se usa en las funciones puras; esto solo evita el import real. */
export function createClient() {
  throw new Error('Las pruebas no hablan con Supabase')
}
