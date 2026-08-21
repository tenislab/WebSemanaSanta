/**
 * Que la aplicación se pueda usar sin ratón.
 *
 * Se comprobó tabulando de verdad en un navegador por las dieciocho pantallas
 * y abriendo los ocho paneles de ficha. Salieron dos cosas gordas:
 *
 * 1. NO SE PODÍA ABRIR NINGUNA FICHA. Las filas del censo, de los recibos, de
 *    las papeletas, de tesorería, del inventario, del archivo, de los
 *    comunicados y de los informes abrían su ficha con `onClick` y un cursor
 *    de manita, y nada más: ni `tabIndex`, ni tecla. Ocho módulos, todo el
 *    trabajo del día a día, solo con ratón.
 *
 * 2. LOS PANELES PROMETÍAN ALGO QUE NO CUMPLÍAN. Todos llevaban
 *    `role="dialog" aria-modal="true"` —«lo de detrás no existe mientras yo
 *    esté abierto»— pero el foco no entraba al abrir, se escapaba a la página
 *    tapada de atrás, y al cerrar no volvía a la fila. Con la paleta de
 *    comandos era peor: una vez fuera, ni Escape la cerraba.
 *
 * Y tres cosas pequeñas: siete buscadores sin etiqueta (un marcador de texto
 * NO es una etiqueta: desaparece al escribir), los dos campos de color de
 * Configuración igual, y el pie de la portada saltando de h2 a h4.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')

  // ---------------------------------------------------------------------
  // 1. Las filas se abren con el teclado
  // ---------------------------------------------------------------------
  const foco = await readFile('src/lib/foco.ts', 'utf8')
  caso('hay un ayudante para las filas', true, foco.includes('export function filaQueAbre'))
  caso('la fila entra en el tabulador', true, /tabIndex: 0/.test(foco))
  caso('e Intro la abre', true, /e\.key !== 'Enter' && e\.key !== ' '/.test(foco))
  // Dentro de la fila hay casillas y botones: sin esta comprobación, marcar
  // una casilla con la barra espaciadora abriría además la ficha.
  caso('lo de dentro de la fila sigue siendo suyo', true, foco.includes('e.target !== e.currentTarget'))
  // Y la fila SIGUE siendo una fila: con `role="button"` el lector de pantalla
  // dejaría de decir «fila 12 de 50» y de leer los encabezados con cada dato.
  caso('no se disfraza de botón', false, /filaQueAbre[\s\S]{0,400}role: 'button'/.test(foco))

  const MODULOS = ['Hermanos', 'Cuotas', 'Papeletas', 'Tesoreria', 'Inventario', 'Archivo', 'Comunicados', 'Informes']
  for (const m of MODULOS) {
    const t = await readFile(`src/pages/app/${m}.tsx`, 'utf8')
    caso(`${m}: sus filas se abren con el teclado`, true, /\{\.\.\.filaQueAbre\(/.test(t))
    // Lo que se rompe sin querer: que alguien vuelva a poner el onClick suelto.
    caso(`${m}: sin onClick suelto en la fila`, false,
      /<tr[^>]*\n?\s*key=\{[^}]*\}\n?\s*(className=\{[^}]*\}\n?\s*)?onClick=/.test(t))
  }

  // ---------------------------------------------------------------------
  // 2. Los paneles cumplen lo que prometen
  // ---------------------------------------------------------------------
  caso('hay un ayudante para el foco de los paneles', true, foco.includes('export function useFocoDeDialogo'))
  caso('el foco entra al abrir', true, /\(primeros\[0\] \?\? raiz\)\.focus/.test(foco))
  caso('no se escapa con el tabulador', true, foco.includes("if (e.key !== 'Tab') return"))
  caso('y vuelve a quien abrió', true, /quienAbrio && document\.contains\(quienAbrio\)/.test(foco))
  // El velo de fondo es un botón invisible que solo cierra al pulsar fuera: si
  // cuenta como enfocable, el foco entra AHÍ y no se puede escribir.
  caso('el velo no cuenta como enfocable', true, foco.includes("el.getAttribute('tabindex') === '-1'"))

  const drawer = await readFile('src/components/Drawer.tsx', 'utf8')
  caso('los ocho paneles de ficha lo usan', true, drawer.includes('useFocoDeDialogo(open, panel)'))
  caso('y el velo no es parada del tabulador', true, /drawer-scrim[^/]*tabIndex=\{-1\}/.test(drawer))

  const paleta = await readFile('src/components/PaletaComandos.tsx', 'utf8')
  caso('la paleta de comandos también', true, paleta.includes('useFocoDeDialogo(abierta, capa)'))
  // Escape en todo el documento, no solo en el buscador: si no, en cuanto el
  // foco se iba la paleta ya no se cerraba con el teclado.
  caso('y Escape la cierra desde donde sea', true, paleta.includes("document.addEventListener('keydown', alPulsar)"))

  for (const [nombre, ruta, marca] of [
    ['el alta de hermandad', 'src/components/AltaHermandad.tsx', 'useFocoDeDialogo(true, panel)'],
    ['la incidencia del cortejo', 'src/pages/app/Cortejo.tsx', 'useFocoDeDialogo(!!papeleta && !!hermano, panel)'],
  ]) {
    const t = await readFile(ruta, 'utf8')
    caso(`${nombre}, igual`, true, t.includes(marca))
  }

  // ---------------------------------------------------------------------
  // 3. Todo tiene nombre
  // ---------------------------------------------------------------------
  const BUSCADORES = ['Archivo', 'Comunicados', 'Cortejo', 'Cuotas', 'Hermanos', 'Inventario', 'Papeletas', 'Tesoreria']
  for (const m of BUSCADORES) {
    const t = await readFile(`src/pages/app/${m}.tsx`, 'utf8')
    caso(`${m}: el buscador tiene etiqueta`, true, /className="search-box"[\s\S]{0,200}aria-label="/.test(t))
  }
  const cfg = await readFile('src/pages/app/Configuracion.tsx', 'utf8')
  caso('los dos campos de color tienen etiqueta', 2,
    (cfg.match(/className="color-picker-hex"\n\s*aria-label="/g) || []).length)

  // ---------------------------------------------------------------------
  // 4. El índice de la página no salta niveles
  // ---------------------------------------------------------------------
  const landing = await readFile('src/pages/Landing.tsx', 'utf8')
  caso('el pie de la portada no salta de h2 a h4', false, /<h4>/.test(landing))

  // La vista previa del editor de webs es una FOTO: dentro había once cosas
  // enfocables que no hacían nada, y su h1 «Nuestra Hermandad» convertía el
  // editor en una página con dos títulos de nivel 1.
  const web = await readFile('src/pages/app/WebPublica.tsx', 'utf8')
  caso('la vista previa está inerte', true, web.includes("escenario.current?.setAttribute('inert', '')"))
  caso('y el escenario lleva su referencia', true, /ref=\{escenario\}\n\s*className="cms-preview__stage"/.test(web))
}
