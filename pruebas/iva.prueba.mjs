/**
 * LA PARTIDA DE IVA.
 *
 * Pedida por la hermandad piloto, y con una razón detrás que conviene dejar
 * escrita: EL IVA REPERCUTIDO NO ES DINERO DE LA HERMANDAD. Cuando se vende
 * una camiseta a 15 €, 12,40 € son suyos y 2,60 € se le están cobrando a quien
 * compra PARA HACIENDA. Entran en la misma caja, pero no son lo mismo.
 *
 * Sumados en una sola línea —que es como estaba— el libro dice que la tienda
 * ingresa un 21 % más de lo que ingresa, y a la hora de rellenar el modelo 303
 * no hay de dónde sacar la cifra sin recorrer las facturas una a una.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/data/movimientos.ts')
  const mov = (categoria, tipo, importe) => ({
    id: String(Math.random()), numero: 1, fecha: '2026-03-01', concepto: '',
    categoria, tipo, importe, cuenta: 'Caja', estado: 'Pendiente',
  })

  // 1. Las tres partidas existen y están donde tienen que estar.
  {
    caso('el IVA repercutido es un ingreso', true,
      m.CATEGORIAS_INGRESO.includes('IVA repercutido'))
    caso('el soportado es un gasto', true, m.CATEGORIAS_GASTO.includes('IVA soportado'))
    caso('y la liquidación también', true,
      m.CATEGORIAS_GASTO.includes('Liquidación de IVA (modelo 303)'))
  }

  // 2. La cuenta del trimestre: repercutido − soportado − lo ya ingresado.
  {
    const libro = [
      mov('IVA repercutido', 'Ingreso', 210),
      mov('IVA repercutido', 'Ingreso', 105),
      mov('IVA soportado', 'Gasto', 84),
      mov('Cuotas Hermanos/as', 'Ingreso', 6000),
      mov('Mantenimiento', 'Gasto', 300),
    ]
    const p = m.posicionDeIva(libro)
    caso('el repercutido se suma', 315, p.repercutido)
    caso('el soportado también', 84, p.soportado)
    caso('y queda por ingresar la diferencia', 231, p.aIngresar)
    // Lo que no es IVA no entra: una cuota no lleva IVA por mucho que se sume
    // en el mismo libro.
    caso('las cuotas no pintan nada aquí', 315, p.repercutido)
  }

  /*
   * 3. UNA VENTA ANULADA METE UN GASTO EN «IVA REPERCUTIDO» para deshacer el
   * ingreso. Contando solo los ingresos, el 303 saldría con el IVA de una
   * venta que ya no existe: hay que restarlo.
   */
  {
    const libro = [
      mov('IVA repercutido', 'Ingreso', 210),
      mov('IVA repercutido', 'Gasto', 210),
    ]
    caso('lo anulado se descuenta del repercutido', 0, m.posicionDeIva(libro).repercutido)
    caso('y no queda nada que ingresar', 0, m.posicionDeIva(libro).aIngresar)
  }

  // 4. Lo ya liquidado no se vuelve a deber.
  {
    const libro = [
      mov('IVA repercutido', 'Ingreso', 500),
      mov('Liquidación de IVA (modelo 303)', 'Gasto', 300),
    ]
    const p = m.posicionDeIva(libro)
    caso('lo ya ingresado a Hacienda se apunta', 300, p.liquidado)
    caso('y solo queda lo que falta', 200, p.aIngresar)
  }

  /*
   * 5. PUEDE SALIR NEGATIVO, y no es un error: si se ha soportado más IVA del
   * que se ha repercutido, es Hacienda quien debe. Redondearlo a cero —que es
   * la tentación— sería esconder un dinero a favor de la hermandad.
   */
  {
    const libro = [mov('IVA repercutido', 'Ingreso', 100), mov('IVA soportado', 'Gasto', 260)]
    caso('a favor de la hermandad sale en negativo', -160, m.posicionDeIva(libro).aIngresar)
  }

  /*
   * 6. Y NI UN «−0,00 €». En JavaScript `-0 === 0` es cierto, pero al
   * imprimirlo sale «-0,00 €» y en una cifra de dinero eso se lee como un
   * error de la aplicación. Salió en pantalla a la primera: una hermandad sin
   * IVA soportado veía «Ya liquidado: -0,00 €».
   */
  {
    const p = m.posicionDeIva([mov('IVA repercutido', 'Ingreso', 210)])
    const negativo = (n) => Object.is(n, -0)
    caso('el soportado no sale como cero negativo', false, negativo(p.soportado))
    caso('ni el liquidado', false, negativo(p.liquidado))
    caso('ni lo que queda por ingresar', false,
      negativo(m.posicionDeIva([]).aIngresar))
    // Y se escribe bien, que es lo que se ve.
    caso('y se imprime sin el menos', '0,00', p.liquidado.toFixed(2).replace('.', ','))
  }

  // 7. Sin nada, ceros y no NaN.
  {
    const p = m.posicionDeIva([])
    caso('un libro vacío da ceros', [0, 0, 0, 0], [p.repercutido, p.soportado, p.liquidado, p.aIngresar])
    // Y un importe roto no puede llevarse por delante la cuenta entera.
    const roto = [mov('IVA repercutido', 'Ingreso', Number.NaN), mov('IVA repercutido', 'Ingreso', 210)]
    caso('un importe roto no tira la suma', 210, m.posicionDeIva(roto).repercutido)
  }

  /*
   * 8. Y EN CÉNTIMOS. Tres ventas con IVA de 5,21 € tienen que dar 15,63 € y
   * no 15,629999999999999, que en pantalla sale como «15,63 €» de milagro y en
   * una resta ya no.
   */
  {
    const libro = [
      mov('IVA repercutido', 'Ingreso', 5.21),
      mov('IVA repercutido', 'Ingreso', 5.21),
      mov('IVA repercutido', 'Ingreso', 5.21),
    ]
    caso('tres de 5,21 dan 15,63 exactos', 15.63, m.posicionDeIva(libro).repercutido)
  }
}
