/**
 * Los cobros que llegan al libro de cuentas.
 *
 * El caso real: se cobraba una papeleta de sitio y Tesorería no se enteraba.
 * El dinero entraba en la hermandad y el saldo, el balance y el Estado de
 * Cuentas anual solo reflejaban lo que alguien hubiera escrito a mano. No
 * cuadraban nunca, y el que lo pagaba era el tesorero cotejando dos listas
 * que deberían ser la misma.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/apuntes.ts')
  const cobro = (origen, importe = 40, metodo = 'Transferencia') => ({
    origen, importe, metodo,
    concepto: 'Cuota 2026 — Ana', categoria: 'Cuotas Hermanos/as', fecha: '05 feb 2026',
  })

  // --- El apunte se crea ------------------------------------------------
  const uno = m.conApunteDeCobro([], cobro('cuota:1'))
  caso('cobrar deja su apunte', 1, uno.length)
  caso('es un ingreso', 'Ingreso', uno[0].tipo)
  caso('por el importe cobrado', 40, uno[0].importe)
  caso('y recuerda de dónde vino', 'cuota:1', uno[0].origen)

  // Nace PENDIENTE, no conciliado. Que la secretaría marque un recibo como
  // pagado significa «me consta que han pagado», no «lo he visto en el
  // extracto». Conciliar es comprobar lo segundo, y lo hace el tesorero.
  caso('nace pendiente de conciliar', 'Pendiente', uno[0].estado)

  // --- No se duplica ----------------------------------------------------
  const dos = m.conApunteDeCobro(uno, cobro('cuota:1'))
  caso('marcar pagado dos veces no apunta dos veces', 1, dos.length)
  const tres = m.conApunteDeCobro(uno, cobro('cuota:2'))
  caso('pero otro recibo sí es otro apunte', 2, tres.length)

  // --- La numeración ----------------------------------------------------
  caso('los asientos van numerados', 1, uno[0].numero)
  caso('y el siguiente sigue la cuenta', 2, tres[0].numero)
  const conViejos = m.conApunteDeCobro(
    [{ id:'x', numero: 340, fecha:'', concepto:'', categoria:'', tipo:'Gasto', importe:1, cuenta:'Caja', estado:'Conciliado' }],
    cobro('cuota:9'),
  )
  caso('continúa la numeración que ya hubiera', 341, conViejos[0].numero)

  // --- A qué cuenta entra -----------------------------------------------
  // Importa para conciliar: lo de Caja se cuenta a mano y lo del banco se
  // coteja con el extracto. Mezclarlos deja al tesorero buscando en el
  // extracto un pago que fue en mano.
  caso('en efectivo va a Caja', 'Caja', m.cuentaSegunMetodo('Efectivo'))
  caso('en metálico también', 'Caja', m.cuentaSegunMetodo('En metálico'))
  caso('por Bizum va al banco', 'Cuenta bancaria', m.cuentaSegunMetodo('Bizum'))
  caso('por transferencia también', 'Cuenta bancaria', m.cuentaSegunMetodo('Transferencia'))
  caso('sin método, al banco', 'Cuenta bancaria', m.cuentaSegunMetodo(null))

  // --- Deshacer el cobro ------------------------------------------------
  // Un recibo devuelto o una papeleta anulada dejan de ser un ingreso. Sin
  // esto, el saldo contaría un dinero que se devolvió.
  caso('devolver un recibo retira su apunte', 0, m.sinApunteDeCobro(uno, 'cuota:1').length)
  caso('y no toca los demás', 1, m.sinApunteDeCobro(tres, 'cuota:1').length)
  const aMano = [{ id:'x', numero:1, fecha:'', concepto:'A mano', categoria:'', tipo:'Ingreso', importe:5, cuenta:'Caja', estado:'Conciliado' }]
  caso('lo escrito a mano no se toca nunca', 1, m.sinApunteDeCobro(aMano, 'cuota:1').length)

  // --- Lo que no se apunta ----------------------------------------------
  caso('un cobro de cero no es un ingreso', 0, m.conApunteDeCobro([], cobro('cuota:3', 0)).length)
  caso('ni uno negativo', 0, m.conApunteDeCobro([], cobro('cuota:4', -10)).length)

  // --- Los identificadores de origen ------------------------------------
  caso('el origen de una cuota', 'cuota:abc', m.origenDeCuota('abc'))
  caso('el de una papeleta', 'papeleta:abc', m.origenDePapeleta('abc'))
  caso('no se pisan entre sí', false, m.origenDeCuota('x') === m.origenDePapeleta('x'))
}
