/**
 * La copia local del navegador, atada a su hermandad.
 *
 * El caso real: se entra con una cuenta, se cierra sesión y se entra con otra
 * EN LA MISMA VENTANA, y se ven los hermanos de la primera. La base de datos
 * lo impide perfectamente —47 comprobaciones lo demuestran— pero la copia que
 * la aplicación guarda en el navegador para que la pantalla no parpadee no
 * sabía de quién era, y ahí seguía.
 *
 * En un ordenador compartido, que es el de la casa hermandad, eso es una fuga.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/multiHermandad.ts')
  const A = 'aaaaaaaa-0000-0000-0000-000000000001'
  const B = 'bbbbbbbb-0000-0000-0000-000000000002'

  function sembrar() {
    localStorage.setItem('cabildo-hermanos', JSON.stringify([{ id: '1', nombre: 'Hermano de A' }]))
    localStorage.setItem('cabildo-cuotas', JSON.stringify([{ id: 'c1' }]))
    localStorage.setItem('cabildo-hermandad-settings', JSON.stringify({ iban: 'ES-DE-A' }))
    localStorage.setItem('cabildo-web-publica', JSON.stringify({ slug: 'la-de-a' }))
    localStorage.setItem('cabildo-catalogo-cuentas', JSON.stringify(['Caja de A']))
    localStorage.setItem('cabildo-tema', 'oscuro')
    localStorage.setItem('cabildo-cfg-seccion', 'correo')
  }

  // En estas pruebas no hay Supabase configurado, así que la función no toca
  // nada: en modo local no hay varias hermandades y la copia es el dato.
  sembrar()
  m.ajustarEspejoALaHermandad(B)
  caso('sin base de datos no se toca nada', true, localStorage.getItem('cabildo-hermanos') !== null)

  // Y lo que importa: la lista de lo que se CONSERVA es de conservar, no de
  // borrar. Así, cualquier clave nueva que se añada en el futuro se borra por
  // defecto en vez de quedarse filtrando datos sin que nadie se entere.
  const fuente = await (await import('node:fs/promises')).readFile('src/lib/multiHermandad.ts', 'utf8')
  caso('se decide por lista de lo que se conserva', true, /NO_ES_DE_LA_HERMANDAD/.test(fuente))
  caso('y se recorre lo guardado, no una lista fija', true, /localStorage\.key\(/.test(fuente))
  caso('se conserva el tema', true, /'cabildo-tema'/.test(fuente))
  caso('y el cliente de altas, que es de la sesión', true, /'cabildo-alta'/.test(fuente))
  caso('el censo NO está entre lo que se conserva', false, /NO_ES_DE_LA_HERMANDAD[\s\S]{0,400}cabildo-hermanos/.test(fuente))
  caso('ni los ajustes con el IBAN', false, /NO_ES_DE_LA_HERMANDAD[\s\S]{0,400}hermandad-settings/.test(fuente))

  // Al cerrar sesión se llama con nulo: nadie hereda la copia del anterior.
  caso('cerrar sesión tira la copia', true, /ajustarEspejoALaHermandad\(null\)/.test(
    await (await import('node:fs/promises')).readFile('src/context/AuthContext.tsx', 'utf8')))
}
