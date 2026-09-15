/**
 * «QUÉ LE FALTA A TU WEB»: las comprobaciones, y el número que las cuenta.
 *
 * ============================================================================
 * DE DÓNDE SALE ESTO
 * ============================================================================
 *
 * `avisosDeLaWeb` mira una web y devuelve lo que le falta. Vivía dentro de un
 * fichero de 4.770 líneas y NO TENÍA NI UNA PRUEBA. Al partir el fichero se
 * quedó sola en `web/avisos.ts` —lógica pura, sin pantalla ni navegador— y con
 * eso ya se puede ejecutar con datos. Lo primero que se ejecutó dio un fallo.
 *
 * EL FALLO: `COMPROBACIONES_WEB` decía 12 y las comprobaciones son 16. El panel
 * calcula `hechos = COMPROBACIONES_WEB - avisos.length`, así que con más de doce
 * avisos a la vez el número se va a negativo. Medido, con la web a medias que
 * lo consigue: dieciséis avisos, «-4 hechos», **-33 %** en pantalla, la barra de
 * progreso con un `width` negativo y un `aria-valuenow` de -33 dentro de un
 * rango declarado de 0 a 100.
 *
 * Y no es un caso raro de laboratorio: es la web de una hermandad el primer
 * día, cuando no tiene nada puesto.
 *
 * El comentario de la constante decía «si se añade o se quita una comprobación,
 * hay que tocarlo». Se añadieron cuatro y nadie lo tocó, que es lo que pasa
 * siempre con lo que se mantiene a mano. Ahora se cuenta aquí.
 */
export default async function ({ cargar, caso }) {
  const a = await cargar('src/pages/app/web/avisos.ts')
  const w = await cargar('src/lib/webPublicaDatos.ts')
  const { readFile } = await import('node:fs/promises')
  const fuente = await readFile('src/pages/app/web/avisos.ts', 'utf8')

  /*
   * 1. LA CUENTA, CONTADA EN LA PROPIA FUNCIÓN.
   *
   * Son diecisiete `push` y dieciséis comprobaciones: `titulares` y
   * `titulares-foto` son un `if/else`, así que nunca saltan las dos.
   */
  const cuerpo = fuente.slice(fuente.indexOf('export function avisosDeLaWeb'))
  const push = (cuerpo.match(/avisos\.push\(/g) ?? []).length
  const elses = (cuerpo.match(/^\s*else /gm) ?? []).length
  caso('se encuentran las comprobaciones en la fuente', true, push >= 12)
  caso('y una de ellas es el «else» de otra', 1, elses)
  caso('el número que enseña el panel es el de verdad', push - elses, a.COMPROBACIONES_WEB)

  /*
   * 2. Y EJECUTADA: con la web más incompleta que se puede construir, el panel
   *    no puede pasarse de la cuenta. Es la comprobación que de verdad importa,
   *    porque es la que no depende de cómo esté escrito el código.
   */
  const gorda = `data:image/jpeg;base64,${'A'.repeat(4_000_000)}`
  const base = w.conDefectos(null)
  const aMedias = w.conDefectos({
    ...base,
    direccion: '', telefono: '', email: '',
    heroFotos: [],
    historia: { entradilla: '', parrafos: [], fotos: [] },
    estacion: { ...base.estacion, fechaSalida: '2020-04-10' },
    titulares: [{ id: 't1', nombre: 'Jesús', fotoDataUrl: null, alt: '' }],
    cultos: [], albumes: [], redes: [],
    secciones: base.secciones.map((s, i) => (i === 0 ? { ...s, visible: true, borrador: true } : s)),
    pie: {
      ...base.pie,
      textoLegal: '',
      columnas: [{ id: 'c1', titulo: 'x', enlaces: [{ id: 'e1', texto: 'Aviso', url: 'javascript:alert(1)' }] }],
    },
    seo: { titulo: '', descripcion: '', imagenDataUrl: null },
    publicada: false,
    noticias: [{ id: 'n1', titulo: 'x', fecha: '2027-01-01', publicada: true, fotoDataUrl: gorda, altFoto: '' }],
  })
  const todos = a.avisosDeLaWeb(aMedias)
  caso('se puede tener más de doce avisos a la vez', true, todos.length > 12)
  caso('y no más que comprobaciones', true, todos.length <= a.COMPROBACIONES_WEB)

  // Lo que pinta el panel, con su misma cuenta.
  const comoElPanel = (avisos) => {
    const hechos = a.COMPROBACIONES_WEB - avisos.length
    return { hechos, pct: Math.round((hechos / a.COMPROBACIONES_WEB) * 100) }
  }
  const peor = comoElPanel(todos)
  caso('con todo mal, el porcentaje NO es negativo', true, peor.pct >= 0)
  caso('ni las comprobaciones hechas', true, peor.hechos >= 0)
  caso('y la barra no se sale por arriba', true, peor.pct <= 100)

  // Una web recién creada: el caso del primer día.
  const nueva = a.avisosDeLaWeb(w.conDefectos(null))
  const alPrincipio = comoElPanel(nueva)
  caso('una web recién creada ya tiene avisos', true, nueva.length > 0)
  caso('y su porcentaje es creíble', true, alPrincipio.pct > 0 && alPrincipio.pct < 100)

  // Y una completa: cero avisos y el cien por cien, que es la otra punta.
  const completa = w.conDefectos({
    ...base,
    direccion: 'C/ Pureza 53', telefono: '954 000 000', email: 'x@y.es',
    heroFotos: ['data:image/jpeg;base64,AAAA'], altHero: 'La portada',
    historia: { entradilla: 'Somos', parrafos: ['Desde 1600'], fotos: [] },
    estacion: { ...base.estacion, fechaSalida: '' },
    titulares: [{ id: 't1', nombre: 'Jesús', fotoDataUrl: 'data:image/jpeg;base64,AAAA', alt: 'El Señor' }],
    cultos: [{ id: 'c1', titulo: 'Triduo', detalle: '', fecha: '2027-03-01', lugar: 'Parroquia', fotoDataUrl: null }],
    albumes: [{ id: 'a1', titulo: 'Salida', descripcion: '', fecha: '', fotos: [{ id: 'f1', dataUrl: 'data:image/jpeg;base64,AAAA', pie: 'x', alt: 'Una foto' }] }],
    redes: [{ id: 'r1', tipo: 'Instagram', url: 'https://instagram.com/x' }],
    secciones: base.secciones.map((s) => ({ ...s, borrador: false })),
    pie: { ...base.pie, textoLegal: 'Aviso legal', columnas: [] },
    seo: { titulo: 'Hermandad', descripcion: 'Una hermandad de Sevilla', imagenDataUrl: null },
    publicada: true,
    noticias: [],
  })
  const sinNada = a.avisosDeLaWeb(completa)
  caso('una web completa no tiene avisos', [], sinNada.map((x) => x.id))
  caso('y marca el cien por cien', 100, comoElPanel(sinNada).pct)

  /*
   * 3. CADA AVISO LLEVA A UNA PESTAÑA QUE EXISTE.
   *
   * El botón «Arreglar» navega con eso. Una pestaña mal escrita no da error:
   * deja al botón sin hacer nada, y quien lo pulsa cree que la aplicación no
   * funciona.
   */
  // `esPestana` y no la lista: la lista no se exporta —y no hace falta que lo
  // haga— porque para esto sirve la función que ya existe.
  const p = await cargar('src/pages/app/web/pestanas.tsx')
  const malas = todos.filter((x) => !p.esPestana(x.pestana))
  caso('todos los avisos llevan a una pestaña de verdad', [], malas.map((x) => `${x.id}→${x.pestana}`))
  caso('y ninguno se queda sin texto', [], todos.filter((x) => !x.texto?.trim()).map((x) => x.id))
  caso('ni sin id', [], todos.filter((x) => !x.id).map((x) => x.texto))
  // Los ids no se repiten: se usan de `key` en la lista del panel.
  caso('los ids son únicos', todos.length, new Set(todos.map((x) => x.id)).size)

  /*
   * 4. LOS DOS GRAVES SON LOS DOS QUE DEJAN LA WEB INSERVIBLE, y salen
   *    marcados para que no se escondan bajo «ver más».
   */
  const graves = todos.filter((x) => x.grave).map((x) => x.id).sort()
  caso('sin dirección y sin forma de contactar son graves', true,
    graves.includes('dir') && graves.includes('contacto'))
  caso('y un enlace del pie que no lleva a ninguna parte, también', true, graves.includes('enlaces'))
}
