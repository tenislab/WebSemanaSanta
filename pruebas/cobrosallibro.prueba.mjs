/**
 * TODO LO QUE SE COBRA TIENE QUE LLEGAR AL LIBRO.
 *
 * De un aviso de la hermandad piloto: «el concepto de cuota no se pasa a
 * tesorería». Y era verdad, pero no en el sitio donde se miró primero: la
 * pantalla de Cuotas SÍ apunta cuando se marca un recibo a mano. Lo que no
 * apuntaba era todo lo demás.
 *
 * Marcar algo como cobrado y no apuntarlo es el peor fallo posible en una
 * hermandad, porque NO SE NOTA. La cuota sale pagada, el hermano está al día,
 * la pantalla no se queja — y el libro dice que ese dinero no ha entrado. Se
 * descubre al cerrar el ejercicio, cuando ya no hay forma de reconstruir qué
 * faltó, y lo paga el tesorero cotejando dos listas que deberían ser la misma.
 *
 * Por eso esto no se comprueba mirando una pantalla: se comprueba EXIGIENDO
 * que toda vía que ponga algo en «Pagada» pase por `conApunteDeCobro`. Es una
 * prueba sobre el código y no sobre el resultado, y es a propósito: el día que
 * alguien añada una sexta forma de cobrar, esta prueba se lo va a recordar
 * antes de que llegue a una hermandad.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const sinComentarios = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  /*
   * LAS PANTALLAS QUE PUEDEN DAR ALGO POR COBRADO. Si una de ellas escribe
   * «Pagada», tiene que apuntar en el libro; y si deja de estarlo, retirarlo.
   */
  const PANTALLAS = [
    ['Cuotas', 'src/pages/app/Cuotas.tsx'],
    ['Papeletas', 'src/pages/app/Papeletas.tsx'],
    ['Notificaciones', 'src/pages/app/Notificaciones.tsx'],
    ['Cortejo', 'src/pages/app/Cortejo.tsx'],
  ]

  for (const [nombre, ruta] of PANTALLAS) {
    const src = sinComentarios(await readFile(ruta, 'utf8'))
    const marcaPagada = /estado: 'Pagada'/.test(src)
    if (!marcaPagada) {
      caso(`${nombre} no da nada por cobrado (nada que comprobar)`, true, true)
      continue
    }
    caso(`${nombre} da algo por cobrado, así que apunta en el libro`, true,
      /conApunteDeCobro/.test(src))
  }

  /*
   * Y LA REMESA, que es la que más dinero mueve de una vez: una hermandad de
   * seiscientos cobra el ejercicio entero de golpe. Si esa vía no apunta, el
   * libro se queda sin el 90 % de los ingresos del año.
   */
  const cuotas = sinComentarios(await readFile('src/pages/app/Cuotas.tsx', 'utf8'))
  const cobroRemesa = cuotas.match(/function simularCobro\(\)[\s\S]*?\n  \}/)?.[0] ?? ''
  caso('la función que cobra la remesa existe', true, cobroRemesa.length > 0)
  caso('y la remesa también apunta en el libro', true, /conApunteDeCobro|apuntarCobros/.test(cobroRemesa))

  /*
   * ACEPTAR UN PAGO AVISADO, las dos clases. El hermano dice «he pagado por
   * Bizum», el cargo le da a aceptar y queda cobrado: si eso no llega al
   * libro, el dinero entra por Bizum y no lo ve nadie.
   */
  const notis = sinComentarios(await readFile('src/pages/app/Notificaciones.tsx', 'utf8'))
  const aceptar = notis.match(/function aceptar\(a: Aviso\)[\s\S]*?\n  \}/)?.[0] ?? ''
  caso('la función de aceptar existe', true, aceptar.length > 0)

  /*
   * CADA RAMA POR SEPARADO, y esto es un arreglo de la propia prueba.
   *
   * Empezó comprobando que `aceptar` mencionara `conApunteDeCobro` en alguna
   * parte. Al probar que fallaba —quitando a mano el apunte de la rama de
   * cuota— la prueba siguió en verde: le bastaba con encontrarlo en la rama de
   * papeleta. Una prueba que solo cuenta menciones no comprueba nada.
   */
  const ramaCuota = aceptar.match(/if \(a\.tipo === 'pagoCuota'\)[\s\S]*?\n      return\n    \}/)?.[0] ?? ''
  const ramaPapeleta = aceptar.match(/if \(a\.tipo === 'pagoPapeleta'\)[\s\S]*?\n      return\n    \}/)?.[0] ?? ''
  caso('la rama de la cuota existe', true, ramaCuota.length > 0)
  caso('aceptar un pago de cuota apunta en el libro', true, /origenDeCuota/.test(ramaCuota))
  caso('la rama de la papeleta existe', true, ramaPapeleta.length > 0)
  caso('y aceptar un pago de papeleta también', true, /origenDePapeleta/.test(ramaPapeleta))

  /*
   * Y LA ARITMÉTICA DEL PUENTE, que es lo único que se puede probar de verdad
   * sin navegador: que no duplique, que no apunte un cobro de cero, y que
   * retire lo que se deshace.
   */
  const m = await cargar('src/lib/apuntes.ts')
  const cobro = { origen: 'cuota:1', concepto: 'Cuota anual — Ana', categoria: 'Cuotas Hermanos/as', importe: 60, fecha: '2026-02-05' }
  {
    const uno = m.conApunteDeCobro([], cobro)
    caso('un cobro deja su apunte', 1, uno.length)
    caso('con su concepto entero', 'Cuota anual — Ana', uno[0].concepto)
    caso('y nace pendiente de conciliar', 'Pendiente', uno[0].estado)
    caso('apuntarlo dos veces no lo duplica', 1, m.conApunteDeCobro(uno, cobro).length)
    caso('un cobro de cero no se apunta', 0, m.conApunteDeCobro([], { ...cobro, importe: 0 }).length)
    caso('y al deshacerse se retira', 0, m.sinApunteDeCobro(uno, 'cuota:1').length)
    // El efectivo a Caja y lo demás al banco: mezclarlos deja al tesorero
    // buscando en el extracto un pago que fue en mano.
    caso('el efectivo entra en Caja', 'Caja',
      m.conApunteDeCobro([], { ...cobro, metodo: 'Efectivo' })[0].cuenta)
    caso('y un Bizum, en el banco', 'Cuenta bancaria',
      m.conApunteDeCobro([], { ...cobro, metodo: 'Bizum' })[0].cuenta)
  }
}
