import type { HermandadSettings } from '../../../lib/hermandadSettings'
import type { ItemImpresion } from './impresion'
import PapeletaModeloRender from '../../../components/PapeletaModeloRender'
import PapeletaTicket from '../../../components/PapeletaTicket'
import { etiquetaTramo } from '../../../lib/tramos'
import { type Campana } from '../../../lib/campana'
import { type ModeloPapeleta } from '../../../lib/modeloPapeleta'

/**
 * LA ZONA DE IMPRESIÓN EN MASA.
 *
 * Oculta en pantalla y visible solo al imprimir, con la clase `print-masivo`.
 *
 * Y CON EL MODELO DE LA HERMANDAD, igual que la de una en una. Aquí iba
 * siempre el diseño de fábrica: la papeleta de un hermano sí respetaba el
 * modelo que la hermandad se había hecho —escudo, tipografía, textos suyos—,
 * pero al imprimir las cuatrocientas salían todas con el genérico.
 *
 * CUATRO PROPS: los hermanos no hacen falta, cada item de la lista trae ya
 * el suyo dentro (`it.hermano`).
 */
export default function ZonaDeImpresion({
  listaImpresion, campana, hermandad, modelo, fallbackNombre,
}: {
  listaImpresion: ItemImpresion[] | null
  campana: Campana
  hermandad: HermandadSettings
  modelo: ModeloPapeleta | null
  /*
   * El nombre de la hermandad que viene en la cuenta, para cuando en Ajustes
   * no hay nombre legal puesto. La pantalla ya lo tiene calculado —lo usa para
   * `useHermandadSettings`—, así que se le pasa en vez de volver a sacarlo de
   * la sesión aquí.
   */
  fallbackNombre: string
}) {
  // Sin lista no hay nada que imprimir: antes era un `{listaImpresion && …}`
  // dentro de la pantalla; aquí es la primera línea de la función.
  if (!listaImpresion) return null
  return (
    <div className="impresion-masiva" aria-hidden="true">
        {/*
          CON EL MODELO DE LA HERMANDAD, IGUAL QUE LA DE UNA EN UNA.

          Aquí iba siempre `PapeletaTicket`, el diseño de fábrica. La ficha
          de un hermano sí respetaba el modelo que la hermandad se había
          hecho —escudo, tipografía, textos suyos—, pero al imprimir la tanda
          salían las cuatrocientas con el genérico.

          Y es justo al revés de como se usa: la de una en una se saca para
          una consulta; la tanda es la que se reparte a los hermanos, la que
          lleva el escudo y la que se ve. La hermandad monta su modelo, lo
          comprueba en una ficha, imprime las cuatrocientas y le salen todas
          sin él.
        */}
        {listaImpresion.map((it) => (
          <div className="impresion-masiva__pagina" key={it.papeleta.id}>
            {modelo ? (
              <PapeletaModeloRender
                modelo={modelo}
                sinQr={false}
                datos={{
                  hermano: it.hermano,
                  papeleta: it.papeleta,
                  tramoEtiqueta: it.tramo ? etiquetaTramo(it.tramo) : null,
                  puesto: it.puesto,
                  hermandadNombre: hermandad.nombreLegal || fallbackNombre,
                  fechaSalida: campana.fechaSalida,
                }}
              />
            ) : (
              <PapeletaTicket
                papeleta={it.papeleta}
                hermano={it.hermano}
                hermandad={hermandad}
                tramo={it.tramo}
                puesto={it.puesto}
                excedeAforo={it.excedeAforo}
                opcion={it.papeleta.opcion}
              />
            )}
          </div>
        ))}
    </div>
  )
}
