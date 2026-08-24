/**
 * QUÉ SE DEBE Y QUÉ NO. Una sola respuesta para toda la aplicación.
 *
 * Esta regla —«pendiente, en mora o devuelta se sigue debiendo»— estaba
 * copiada SIETE veces: en el área del hermano, en «Mi familia», en el
 * historial de la ficha, en Papeletas, dos en Cuotas y en el cálculo de la
 * situación. Copiada funciona. El problema es el día que se añada un estado
 * nuevo —una cuota condonada, una exenta, una fraccionada—: habría que
 * acordarse de los siete sitios, y de los que se olviden saldría dinero mal
 * contado sin ningún aviso. Nadie lo nota hasta que un hermano reclama.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/data/cuotas.ts')

  const c = (estado, importe = 60) => ({
    id: 'x', numero: 1, hermanoId: 'h1', concepto: 'Cuota anual', importe, estado,
    fechaEmision: '03 feb 2026', fechaCobro: '18 feb 2026', domiciliada: true,
  })

  caso('lo pagado no se debe', false, m.estaSinCobrar(c('Pagada')))
  caso('lo pendiente sí', true, m.estaSinCobrar(c('Pendiente')))
  caso('y lo que está en mora', true, m.estaSinCobrar(c('En mora')))
  /*
   * DEVUELTA ES DINERO QUE ENTRÓ Y VOLVIÓ. Es el que más fácil se cuela como
   * cobrado —el banco llegó a apuntarlo— y el que más duele que se cuele: el
   * recibo se dio por bueno, el hermano cree que pagó y la hermandad no tiene
   * ese dinero.
   */
  caso('y lo devuelto por el banco, también', true, m.estaSinCobrar(c('Devuelta')))

  // --- La suma ---
  caso('suma solo lo que falta por cobrar', 78,
    m.deudaDe([c('Pendiente', 60), c('Pagada', 100), c('Devuelta', 18)]))
  caso('sin recibos, no se debe nada', 0, m.deudaDe([]))
  caso('todo cobrado, tampoco', 0, m.deudaDe([c('Pagada', 60), c('Pagada', 18)]))

  /*
   * Y LOS CÉNTIMOS NO SE DESHILACHAN. Sumar decimales en coma flotante deja
   * 60,300000000000004 en pantalla, que en un recibo de una hermandad queda
   * como si el programa no supiera sumar.
   */
  caso('los céntimos cuadran', 60.3,
    m.deudaDe([c('Pendiente', 20.1), c('Pendiente', 20.1), c('Pendiente', 20.1)]))

  /*
   * --- UN RECIBO ROTO NO SE LLEVA POR DELANTE LA CUENTA ENTERA ---
   *
   * Basta con un importe que no sea un número —la celda vacía de un Excel, un
   * valor nulo de la base— para que la suma diera NaN. Y entonces la deuda de
   * TODA la hermandad se leía «NaN €»: en Cuotas, en la ficha de cada hermano,
   * en su propia área y en el estado de cuentas que se lleva al cabildo.
   *
   * Es el mismo fallo que el «NaN AÑOS» del censo (ver robustez.prueba.mjs),
   * pero con dinero. Un dato malo entre seiscientos buenos no puede borrar los
   * seiscientos.
   */
  caso('un importe roto no borra los demás', 60, m.deudaDe([c('Pendiente', NaN), c('Pendiente', 60)]))
  // El ayudante `c` pone 60 por defecto, así que el «sin importe» se arma a mano.
  caso('ni un importe que falta', 60, m.deudaDe([{ ...c('Pendiente'), importe: undefined }, c('Pendiente', 60)]))
  caso('ni uno infinito', 60, m.deudaDe([c('Pendiente', Infinity), c('Pendiente', 60)]))
  /*
   * Y un importe en TEXTO se entiende, no se tira. Postgres devuelve las
   * columnas `numeric` como cadena («60.00»): los conversores de `lib/db` ya
   * lo pasan a número, pero una copia guardada en el navegador por una versión
   * anterior puede traerlo así, y entonces la deuda entera saldría a cero.
   */
  caso('un importe en texto se entiende', 120, m.deudaDe([c('Pendiente', '60'), c('Pendiente', 60)]))
  // Un importe negativo SÍ cuenta: puede ser una corrección de la tesorería,
  // y esconderla descuadraría la caja.
  caso('un importe negativo sí cuenta', 40, m.deudaDe([c('Pendiente', -20), c('Pendiente', 60)]))

  await nadieLaVuelveACopiar({ caso, cargar })
}

/**
 * Y QUE NADIE LA VUELVA A ESCRIBIR A MANO.
 *
 * Esto es lo que de verdad guarda la prueba: no que la función esté bien —eso
 * es fácil—, sino que los siete sitios sigan preguntándole a ella.
 */
async function nadieLaVuelveACopiar({ caso, cargar }) {
  const { readFile } = await import('node:fs/promises')
  const ARCHIVOS = [
    'src/components/MiFamilia.tsx',
    'src/components/HistorialHermano.tsx',
    'src/pages/app/Papeletas.tsx',
    'src/pages/app/Cuotas.tsx',
    'src/pages/HermanoPortal.tsx',
    'src/lib/estadoCuotaHermano.ts',
  ]
  /*
   * La forma copiada, en cualquiera de sus dos órdenes. Se exige que aparezca
   * «Pendiente» junto a otro estado, y no dos cualesquiera: hay una pregunta
   * legítima que mira «Devuelta o En mora» sin «Pendiente» —«¿puede el hermano
   * pagar ESTE recibo por su cuenta?», en HistorialHermano—, que es otra cosa
   * y tiene que poder escribirse. Un recibo domiciliado y pendiente se debe,
   * pero se cobra solo y él no tiene nada que hacer.
   */
  const A_MANO = /estado === 'Pendiente'\s*\|\|[\s\S]{0,120}?estado === '(En mora|Devuelta)'/

  for (const f of ARCHIVOS) {
    const texto = (await readFile(f, 'utf8'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    caso(`${f.split('/').pop()} no la escribe a mano`, false, A_MANO.test(texto))
    caso(`${f.split('/').pop()} se la pregunta a data/cuotas`, true,
      /estaSinCobrar|deudaDe/.test(texto))
  }

  // Y el interruptor es un Record de TODOS los estados, no una lista: así, al
  // añadir uno, TypeScript no compila hasta que se diga si está cobrado.
  const fuente = await readFile('src/data/cuotas.ts', 'utf8')
  caso('el interruptor es exhaustivo', true, /Record<EstadoCuota, boolean>/.test(fuente))

  /*
   * NINGUNA CIFRA DE DINERO SE SUMA A PELO, EN NINGUNA PANTALLA.
   *
   * `sumaEuros` existe porque un `reduce((s, c) => s + c.importe, 0)` se lo
   * lleva por delante UN SOLO importe malo:
   *
   *   · vacío  → la suma entera es NaN y el informe dice «NaN €»;
   *   · texto  → el `+` concatena y salen cosas como «12060,1060 €».
   *
   * Y lo de que llegue como texto no es hipotético: Postgres devuelve las
   * columnas `numeric` como cadena, y una copia guardada en el navegador por
   * una versión anterior puede traerla así.
   *
   * Estaba protegido en `deudaDe` y en las cifras de papeletas, y NO en las
   * cuatro del informe que se lleva al cabildo, ni en el historial de la ficha
   * del hermano, ni en los dos saldos del estado de cuentas. Un dato malo
   * entre seiscientos buenos no puede borrar los seiscientos.
   *
   * Se barre el repositorio entero en vez de repasar una lista escrita a mano:
   * una lista se queda vieja el día que alguien añade una pantalla.
   */
  const { readFile: leer, readdir: listar } = await import('node:fs/promises')
  const dirs = ['src/pages/app', 'src/pages', 'src/components', 'src/lib']
  const sospechosas = []
  for (const dir of dirs) {
    for (const f of await listar(dir)) {
      if (!/\.tsx?$/.test(f)) continue
      const ruta = `${dir}/${f}`
      const src = await leer(ruta, 'utf8')
      src.split('\n').forEach((linea, i) => {
        // Un `reduce` cuyo acumulador suma un `.importe` a pelo. Se deja pasar
        // el que ya redondea a céntimos por su cuenta (`Math.round(... * 100)`),
        // que es lo mismo que hace `sumaEuros`.
        if (/reduce\(\s*\([^)]*\)\s*=>[^\n]*\+[^\n]*\.importe/.test(linea)
            && !/Math\.round/.test(linea)) {
          sospechosas.push(`${ruta}:${i + 1}`)
        }
      })
    }
  }
  caso('nadie suma dinero a pelo: se usa sumaEuros', '', sospechosas.join(', '))

  // Y que la función de verdad aguante lo que se le eche.
  const fmt = await cargar('src/lib/format.ts')
  caso('un importe vacío no borra la suma', 180, fmt.sumaEuros([60, 60, undefined, 60]))
  caso('ni uno nulo', 180, fmt.sumaEuros([60, 60, null, 60]))
  caso('ni uno que llega como texto de la base', 180, fmt.sumaEuros(['60.00', 60, 60]))
  caso('ni una palabra donde iba un número', 180, fmt.sumaEuros([60, 'sesenta', 60, 60]))
  caso('y los céntimos no se deshilachan', 54.3, fmt.sumaEuros([18.1, 18.1, 18.1]))
}
