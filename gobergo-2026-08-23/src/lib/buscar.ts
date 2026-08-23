/**
 * BUSCAR COMO SE ESCRIBE, no como está escrito.
 *
 * En un censo español se busca «garcia», «jose» o «rocio», sin tilde: en el
 * teclado del móvil la tilde cuesta una pulsación larga y en el del ordenador
 * nadie la pone para una búsqueda rápida. Y los buscadores de la aplicación
 * comparaban con `toLowerCase().includes()`, que respeta las tildes: teclear
 * «garcia» NO encontraba a García, ni «lopez» a López, ni «jose» a José.
 *
 * En un censo donde media lista lleva tilde, eso es un buscador que parece
 * roto: la secretaria ve al hermano en la tabla, lo busca y desaparece todo.
 * Salió al medir la fluidez con un censo de 800 —la máquina tecleó «garcia»
 * y se quedó sin resultados con veinte García delante—.
 *
 * La paleta de comandos (Ctrl+K) ya lo hacía bien por su cuenta; esta es la
 * misma regla, en un solo sitio, para todos los buscadores.
 */

/** Minúsculas y sin tildes ni diéresis. La ñ SÍ se conserva: es otra letra. */
export function llano(texto: string): string {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    /* Quita los acentos combinantes que deja NFD… salvo la virgulilla de la
       eñe (u0303 sobre la n), que se recompone: «peña» y «pena» son palabras
       distintas y un censo cofrade está lleno de Peñas. */
    .replace(/̃/g, (m, i, s) => (s[i - 1] === 'n' ? m : ''))
    .replace(/[̀-̂̄-ͯ]/g, '')
    .normalize('NFC')
    .trim()
}

/** ¿`texto` contiene `busqueda`, escribas como escribas las tildes? */
export function contiene(texto: string | null | undefined, busquedaLlana: string): boolean {
  return llano(texto ?? '').includes(busquedaLlana)
}
