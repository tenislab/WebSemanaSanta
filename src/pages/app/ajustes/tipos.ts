/**
 * Un cuerpo del cortejo mientras se está editando: su nombre de antes y el de
 * ahora.
 *
 * Hacen falta los dos porque renombrar un cuerpo tiene que arrastrar sus
 * tramos: sin el nombre original no se sabe a cuáles.
 */
export interface CuerpoEdit {
  original: string | null
  actual: string
}
