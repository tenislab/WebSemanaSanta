/**
 * El botón «Copiar enlace».
 *
 * EL FALLO: se llamaba a `navigator.clipboard.writeText(...).then(...)`, sin
 * `catch`. Y esa promesa se rompe más de lo que parece: permiso denegado
 * (Firefox lo trae así de fábrica en algunas configuraciones), página sin
 * HTTPS —ahí `navigator.clipboard` ni existe—, o Safari, que lo rechaza si no
 * ve un gesto de la persona lo bastante cerca.
 *
 * Cuando se rompía, el botón no hacía NADA: ni copiaba, ni cambiaba a
 * «✓ Enlace copiado», ni avisaba. La persona lo pulsa, se va al grupo de
 * WhatsApp de la hermandad, pega... y pega otra cosa.
 */
export default async function ({ caso, cargar }) {
  const { copiarAlPortapapeles } = await cargar('src/lib/portapapeles.ts')

  /** Deja el navegador de mentira montado y devuelve lo que se copió. */
  function conNavegador({ moderno, antiguo }) {
    const copiado = { valor: null }
    const cajas = []
    // `globalThis.navigator` en Node solo tiene lectura, así que se define
    // encima en vez de asignarlo.
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
      clipboard: moderno === 'no existe' ? undefined : {
        writeText: async (t) => {
          if (moderno === 'falla') throw new Error('permiso denegado')
          copiado.valor = t
        },
      },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
      createElement: () => {
        const caja = {
          value: '', style: {}, setAttribute() {}, select() {}, setSelectionRange() {}, remove() {},
        }
        cajas.push(caja)
        return caja
      },
      body: { appendChild() {} },
      execCommand: () => {
        if (antiguo === 'falla') return false
        copiado.valor = cajas[cajas.length - 1]?.value ?? null
        return true
      },
      },
    })
    return copiado
  }

  // 1. Lo normal: el navegador deja copiar.
  let c = conNavegador({ moderno: 'va', antiguo: 'va' })
  caso('con permiso, copia', true, await copiarAlPortapapeles('https://gobergo.com/w/hdad'))
  caso('y copia lo que toca', 'https://gobergo.com/w/hdad', c.valor)

  // 2. El navegador rechaza la forma moderna: se prueba la de toda la vida.
  c = conNavegador({ moderno: 'falla', antiguo: 'va' })
  caso('sin permiso, tira de la vía antigua', true, await copiarAlPortapapeles('https://gobergo.com/w/hdad'))
  caso('y también copia lo que toca', 'https://gobergo.com/w/hdad', c.valor)

  // 3. Sin HTTPS no hay `navigator.clipboard` siquiera: antes reventaba con un
  //    TypeError, porque `undefined?.writeText` daba undefined y luego `.then`.
  c = conNavegador({ moderno: 'no existe', antiguo: 'va' })
  caso('sin portapapeles moderno, igual', true, await copiarAlPortapapeles('https://gobergo.com/w/hdad'))
  caso('y copia', 'https://gobergo.com/w/hdad', c.valor)

  // 4. Y si no hay manera, se DICE. Esto es lo importante: devolver `false`
  //    para que la pantalla enseñe el enlace y se copie a mano.
  conNavegador({ moderno: 'falla', antiguo: 'falla' })
  caso('si no hay manera, lo dice', false, await copiarAlPortapapeles('https://gobergo.com/w/hdad'))

  // Y la pantalla hace algo con ese `false`.
  const { readFile } = await import('node:fs/promises')
  const web = await readFile('src/pages/app/WebPublica.tsx', 'utf8')
  caso('la pantalla enseña el enlace a mano', true, web.includes('cms-copiar-a-mano'))
  caso('y ya no llama al portapapeles a pelo', false, /navigator\.clipboard\?\.writeText/.test(web))
}
