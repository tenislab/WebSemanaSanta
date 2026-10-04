/**
 * QUE LA HOJA DE RUTA NO DÉ POR PENDIENTE LO QUE ESTÁ HECHO.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ ESTO ES UNA PRUEBA
 * ----------------------------------------------------------------------------
 *
 * `HOJA-DE-RUTA.md` daba por pendientes SEIS cosas que estaban hechas —las
 * políticas RLS por cargo, las copias automáticas, la verificación en dos
 * pasos, el manual, los mandatos SEPA firmados y el webhook de Stripe— y de las
 * dos últimas decía lo CONTRARIO que `COBROS-LO-QUE-FALTA.md`, que es el
 * documento al que remite.
 *
 * Eso no es un documento inexacto: es un documento que **produce un plan de
 * trabajo falso**. Se pregunta «¿qué falta?», sale la lista, y el tiempo se va
 * en problemas que no existen. Ya había pasado antes con el de cobros, que lo
 * cuenta en su propia cabecera; pasó otra vez aquí. A la segunda, se vigila.
 *
 * ----------------------------------------------------------------------------
 * CÓMO SE VIGILA ALGO QUE ES PROSA
 * ----------------------------------------------------------------------------
 *
 * No se mide la prosa: se EMPAREJA cada afirmación con un hecho del código que
 * se puede comprobar. «Si en el código existe esto, el documento no puede seguir
 * diciendo aquello.»
 *
 * Tiene la propiedad que hace falta: va en los dos sentidos. Si alguien vuelve
 * a escribir la frase vieja, salta; y si lo que se cae es el código —se borra la
 * función de correo, por ejemplo— la guarda deja de exigir nada, porque entonces
 * la frase vuelve a ser verdad.
 *
 * Lo que NO hace: decir si lo que está escrito está bien explicado, ni si falta
 * algo por contar. Eso no lo puede medir una expresión regular, y fingir que sí
 * sería peor que no mirarlo.
 */
import { fuente } from './fuentes.mjs'

/**
 * Cada pareja: un hecho del código, y la frase que entonces NO puede estar en el
 * documento. `hecho` se comprueba sobre el fichero que diga `donde`.
 */
const PAREJAS = [
  {
    que: 'el correo sale por una función de servidor, no simulado',
    donde: 'supabase/functions/enviar-correo/index.ts',
    hecho: /RESEND_API_KEY/,
    yaNoVale: /todo el envío es simulado/i,
  },
  {
    que: 'el MndtId de la remesa sale del mandato firmado',
    donde: 'src/lib/sepa.ts',
    hecho: /mandatos_sepa/,
    yaNoVale: /mandatos firmados se\s+sintetizan|mandatos se sintetizan/i,
  },
  {
    que: 'el webhook de Stripe atiende la renovación y el fallo de cobro',
    donde: 'supabase/functions/webhook-stripe/index.ts',
    hecho: /invoice\.payment_failed/,
    yaNoVale: /\*\*no el webhook\*\*|pero no el webhook/i,
  },
  {
    que: 'la verificación en dos pasos habla con Supabase',
    donde: 'src/context/AuthContext.tsx',
    hecho: /mfa\.enroll/,
    yaNoVale: /dos pasos: la pantalla está; falta Supabase/i,
  },
  {
    que: 'la copia semanal la hace el código y la lanza el marco',
    donde: 'src/components/AppShell.tsx',
    hecho: /copiaSemanalSiTocaba/,
    yaNoVale: /^- Copias de seguridad automáticas\.$/m,
  },
  {
    /*
     * EL HUECO DEL ARRANQUE. Es el último que se cerró, y el que más merece
     * estar aquí: era pérdida silenciosa de datos, así que una hoja de ruta que
     * lo siga pidiendo manda a alguien a arreglar algo que ya está.
     */
    que: 'lo guardado mientras carga la tabla se reaplica',
    donde: 'src/lib/supabaseSync.ts',
    hecho: /export function conLoDelHueco/,
    yaNoVale: /Cerrar la ventana de arranque\*\*:/i,
  },
]

export default async function ({ caso }) {
  const hoja = await fuente('docs/HOJA-DE-RUTA.md')

  for (const { que, donde, hecho, yaNoVale } of PAREJAS) {
    const codigo = await fuente(donde)
    const estaHecho = hecho.test(codigo)
    caso(`en el código: ${que}`, true, estaHecho)
    /*
     * Solo se exige el documento si el hecho se cumple. Si el código se cayera,
     * la frase vieja volvería a ser verdad y esta guarda no tendría nada que
     * decir — que es justo lo que se quiere de ella.
     */
    if (estaHecho) {
      caso(`y la hoja de ruta ya no lo da por pendiente`, false, yaNoVale.test(hoja))
    }
  }

  /*
   * Y QUE NO SE CONTRADIGA CON EL DOCUMENTO AL QUE REMITE. El de cobros se
   * auditó línea a línea y lleva la fecha puesta; la hoja de ruta lo enlaza, así
   * que si vuelve a resumirlo al revés, al menos que haya quedado dicho que la
   * auditada es la otra.
   */
  const cobros = await fuente('docs/COBROS-LO-QUE-FALTA.md')
  caso('el documento de cobros sigue diciendo que los mandatos son de verdad', true,
    /LOS MANDATOS SON DE VERDAD/.test(cobros))
  caso('y la hoja de ruta lo enlaza', true, /COBROS-LO-QUE-FALTA\.md/.test(hoja))

  /*
   * LA REGLA, ESCRITA DONDE SE LEE. De poco sirve arreglarlo hoy si el
   * siguiente no sabe que esto se tacha en el momento.
   */
  caso('la hoja de ruta dice que lo hecho se tacha el mismo día', true,
    /se tacha aquí EL MISMO DÍA/.test(hoja))
}
