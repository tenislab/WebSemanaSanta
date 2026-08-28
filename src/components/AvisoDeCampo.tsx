/**
 * EL AVISO QUE SALE DEBAJO DE UN CAMPO MAL ESCRITO.
 *
 * Se repite en Configuración, en el alta de hermandad, en la ficha del hermano
 * y en los formularios de la web, y conviene que se vea EXACTAMENTE igual en
 * los cuatro sitios: quien está en secretaría tecleando el censo aprende a
 * reconocer el aviso de un vistazo, y un aviso que cambia de forma según la
 * pantalla se lee como un error de la aplicación, no como un dato mal puesto.
 *
 * NO ES UN ERROR QUE BLOQUEE, y esa es la decisión de diseño. Se avisa mientras
 * se escribe, y quien manda es la persona: hay hermandades con un identificador
 * de acreedor raro heredado del banco, y hay teléfonos de fuera con formas que
 * no se pueden prever. Si algo NO se puede guardar mal —porque tumbaría una
 * remesa entera—, eso se para en el guardado, no aquí.
 *
 * `aria-live="polite"` para que quien usa lector de pantalla se entere del
 * aviso sin que le interrumpa a media palabra.
 */
export default function AvisoDeCampo({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <p className="form-hint form-hint--error" aria-live="polite">
      {texto}
    </p>
  )
}
