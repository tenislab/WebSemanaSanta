/**
 * LA ACCIÓN PRINCIPAL VA EN LA CABECERA, NO ENTERRADA EN EL PANEL.
 *
 * En todas las pantallas del panel el botón de crear —«+ Nuevo hermano»,
 * «+ Nueva cuota», «+ Nuevo documento»— va arriba a la derecha, dentro de la
 * cabecera, donde uno lo busca. En Campañas no: estaba DENTRO del panel, o sea
 * en una tercera fila por debajo de los chips de «Campañas / Proyectos» y
 * pegado a la izquierda. La única pantalla donde la acción principal no estaba
 * donde está en todas las demás.
 *
 * Salió al mirar la pantalla pintada, no leyendo el código: en el código el
 * botón está, hace lo suyo y pasa el tsc; lo que estaba mal era DÓNDE se veía.
 * Archivo y Comunicados usan estos mismos chips y su botón sí va en la
 * cabecera.
 *
 * Esta prueba LEE la estructura del fichero —es lo que puede hacerse sin
 * montar React— así que comprueba lo justo: que el botón de crear está en la
 * cabecera y no vuelve a caer dentro de un panel. No sustituye a mirar la
 * pantalla; evita que ESTE arreglo se deshaga sin que nadie lo note.
 */
import { readFileSync } from 'node:fs'

export default async function ({ caso }) {
  const src = readFileSync('src/pages/app/Campanas.tsx', 'utf8')

  // La cabecera es el bloque `dash-head`; el contenido intercambiable son los
  // dos `tabpanel`. El botón de crear tiene que estar ANTES del primer panel.
  const finCabecera = src.indexOf('role="tabpanel"')
  caso('la pantalla de campañas tiene sus paneles', true, finCabecera > 0)

  const cabecera = src.slice(0, finCabecera)
  caso('el botón de crear está en la cabecera', true,
    /dash-head__actions[\s\S]*?btn btn-primary[\s\S]*?setCreando\(true\)/.test(cabecera))

  /*
   * Y NINGÚN PANEL SE TRAE SU PROPIO BOTÓN DE CREAR. Si un panel volviera a
   * pintar su «+ Nueva campaña», habría dos —uno arriba y otro dentro—, o el de
   * dentro volvería a quedar descolgado. El estado `creando` vive en el padre a
   * propósito, así que los paneles lo reciben, no lo crean.
   */
  const cuerpoPaneles = src.slice(finCabecera)
  caso('los paneles no crean su propio botón de «Nueva campaña»', false,
    /className="btn btn-primary"[^>]*>\s*\+ Nuev/.test(cuerpoPaneles))
  // Tres veces: la definición del estado en el padre y las dos firmas de panel
  // que lo reciben. Ni una cuarta, que sería un panel declarándolo de nuevo.
  caso('el estado de crear se pasa a los paneles, no se duplica', 3,
    (src.match(/creando, setCreando/g) ?? []).length)
}
