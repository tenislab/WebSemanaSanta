/**
 * BUSCAR COMO SE ESCRIBE. Los buscadores comparaban con las tildes puestas:
 * teclear «garcia» no encontraba a García, ni «jose» a José. En un censo
 * español, donde media lista lleva tilde y nadie la teclea al buscar, eso es
 * un buscador que parece roto: ves al hermano en la tabla, lo buscas y
 * desaparece todo.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/buscar.ts')

  caso('garcia encuentra a García', true, m.contiene('María García Gómez', m.llano('garcia')))
  caso('jose encuentra a José', true, m.contiene('José Antonio Reina', m.llano('jose')))
  caso('rocio a Rocío', true, m.contiene('Rocío Domínguez', m.llano('rocio')))
  caso('y al revés: con tilde también vale', true, m.contiene('Maria Garcia', m.llano('garcía')))
  caso('las mayúsculas dan igual', true, m.contiene('LÓPEZ', m.llano('lopez')))
  /*
   * LA EÑE NO ES UNA N CON ADORNO: «peña» y «pena» son palabras distintas, y
   * un censo cofrade está lleno de Peñas. Quitar la virgulilla junto con las
   * tildes haría que buscar «pena» trajera a todos los Peña.
   */
  caso('la eñe se respeta: pena no trae a Peña', false, m.contiene('Carmen Peña', m.llano('pena')))
  caso('pero peña sí encuentra a Peña', true, m.contiene('Carmen Peña', m.llano('peña')))
  caso('la diéresis tampoco estorba', true, m.contiene('Argüelles', m.llano('arguelles')))
  caso('vacío no revienta', true, m.contiene('lo que sea', m.llano('')))
  caso('nulo tampoco', false, m.contiene(null, m.llano('x')))

  /*
   * Y LOS NUEVE BUSCADORES LA USAN. Si uno se queda con el `toLowerCase()` a
   * secas, ese buscador vuelve a «romperse» solo para los nombres con tilde,
   * que es el fallo más difícil de reportar: al usuario le funciona con unos
   * hermanos y con otros no, y no ve el patrón.
   */
  const { readFile } = await import('node:fs/promises')
  const PANTALLAS = [
    'src/pages/app/Hermanos.tsx', 'src/pages/app/Cuotas.tsx', 'src/pages/app/Papeletas.tsx',
    'src/pages/app/Tesoreria.tsx', 'src/pages/app/Inventario.tsx', 'src/pages/app/Archivo.tsx',
    'src/pages/app/Cortejo.tsx', 'src/pages/app/Comunicados.tsx', 'src/components/HermanoPicker.tsx',
  ]
  for (const f of PANTALLAS) {
    const t = (await readFile(f, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    caso(`${f.split('/').pop()} busca sin tildes`, true, /from '[./]*lib\/buscar'|from '\.\.\/lib\/buscar'/.test(t))
  }
}
