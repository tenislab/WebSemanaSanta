/**
 * LAS CUENTAS DE LA TIENDA.
 *
 * Aquí se prueba lo único que puede mentir con dinero sin que se note: el
 * desglose del IVA de una factura, el margen de un artículo y lo que suma una
 * cesta antes de cobrarla.
 *
 * Lo demás —que el stock baje, que el número de factura no se repita, que se
 * generen los dos asientos— lo hace la base de datos y se prueba contra un
 * Postgres de verdad en `basedatos.prueba.mjs`, porque son cosas que solo
 * fallan cuando hay dos personas cobrando a la vez.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/data/tienda.ts')

  /*
   * 1. EL DESGLOSE DEL IVA. Los tres números tienen que sumar EXACTAMENTE, y
   * ahí está el detalle: la cuota se saca restando la base del total, no
   * calculándola aparte. Calculándola aparte, un redondeo que cae a un lado
   * deja facturas donde base + IVA no da el total, y eso es una factura mal
   * hecha.
   */
  {
    const d = m.desglosarIva(15, 21)
    caso('15 € al 21 %: base', 12.4, d.base)
    caso('15 € al 21 %: cuota', 2.6, d.iva)
    caso('y suman el total exacto', 15, Math.round((d.base + d.iva) * 100) / 100)

    // Un importe que redondea justo, que es donde se rompen estas cuentas.
    const e = m.desglosarIva(9.99, 21)
    caso('9,99 € también cuadra', 9.99, Math.round((e.base + e.iva) * 100) / 100)

    // Sin IVA (hermandad exenta): toda la base y cuota cero.
    const x = m.desglosarIva(20, 0)
    caso('sin IVA, todo es base', 20, x.base)
    caso('y la cuota es cero', 0, x.iva)
  }

  /*
   * 2. EL MARGEN. Dos preguntas distintas y a propósito separadas: lo que la
   * hermandad se lleva en la mano (sobre el precio) y el margen fiscal (sobre
   * la base). Mezclarlas daría un número que no es ninguna de las dos.
   */
  {
    const p = { precio: 15, coste: 6, iva: 21 }
    caso('lo que se lleva en la mano', 9, m.margen(p))
    caso('el margen sobre la base', 6.4, m.margenSobreBase(p))
    caso('y en porcentaje', 60, m.margenPorcentaje(p))
    // Un artículo regalado no puede reventar la división.
    caso('un artículo a cero no divide por cero', 0, m.margenPorcentaje({ precio: 0, coste: 0 }))
    // Vender por debajo del coste sale en negativo, que es la verdad.
    caso('vender por debajo del coste se ve', -1, m.margen({ precio: 5, coste: 6 }))
  }

  /*
   * 3. EL PRECIO DE UNA LÍNEA. Un precio puesto a mano MANDA sobre el
   * descuento y no se suman. Rebajar un 50 % sobre un precio que ya se ha
   * rebajado a ojo en el mostrador no lo espera nadie, y quien se lleva la
   * sorpresa es el que está cobrando.
   *
   * Y tiene que dar lo MISMO que `registrar_venta` en la base: si no, el total
   * que enseña la pantalla no sería el que se cobra.
   */
  {
    const p = { precio: 15 }
    caso('sin descuento, el de la ficha', 15, m.precioDeLinea(p, 0))
    caso('con el 50 % de costaleros', 7.5, m.precioDeLinea(p, 50))
    caso('un precio a mano manda sobre el descuento', 10, m.precioDeLinea(p, 50, 10))
    caso('y el cero a mano también vale (un regalo)', 0, m.precioDeLinea(p, 50, 0))
    // Un descuento imposible no puede dejar el precio en negativo.
    caso('un descuento de más del 100 % se corta', 0, m.precioDeLinea(p, 150))
    caso('y uno negativo no sube el precio', 15, m.precioDeLinea(p, -20))
  }

  /*
   * 4. LA CESTA. Es lo que se enseña mientras se teclea, así que tiene que
   * cuadrar con lo que la base va a cobrar.
   */
  {
    const camiseta = { id: 'a', precio: 15, coste: 6, iva: 21 }
    const llavero = { id: 'b', precio: 5, coste: 2, iva: 21 }
    const t = m.totalesDeCesta(
      [{ producto: camiseta, cantidad: 2 }, { producto: llavero, cantidad: 3 }],
    )
    caso('unidades', 5, t.unidades)
    caso('total cobrado', 45, t.total)
    caso('coste del género', 18, t.coste)
    caso('beneficio', 27, t.beneficio)
    caso('base + IVA dan el total', 45, Math.round((t.base + t.iva) * 100) / 100)

    // Con el descuento de costaleros encima.
    const c = m.totalesDeCesta([{ producto: camiseta, cantidad: 2 }], 50)
    caso('con descuento, se cobra la mitad', 15, c.total)
    // Y el coste NO se rebaja: a la hermandad le sigue costando lo mismo.
    caso('pero el coste no baja', 12, c.coste)
    caso('así que el beneficio se ve venir', 3, c.beneficio)

    caso('una cesta vacía no revienta', 0, m.totalesDeCesta([]).total)
  }

  /*
   * 5. A QUIÉN SE LE OFRECE CADA DESCUENTO.
   *
   * Esto es solo para pintar la pantalla —quien de verdad lo decide es la
   * base— pero si aquí se ofreciera de más, la venta fallaría al cobrar y con
   * la cola esperando.
   */
  {
    const costaleros = { id: 'd1', nombre: 'Costaleros', porcentaje: 50, etiqueta: 'Costalero', activo: true }
    const todos = { id: 'd2', nombre: 'Hermanos', porcentaje: 10, etiqueta: undefined, activo: true }
    const viejo = { id: 'd3', nombre: 'Antiguo', porcentaje: 90, etiqueta: undefined, activo: false }
    const lista = [costaleros, todos, viejo]

    caso('al costalero se le ofrecen los dos', ['d1', 'd2'],
      m.descuentosPara(lista, ['Costalero'], true).map((d) => d.id))
    caso('al que no lo es, solo el general', ['d2'],
      m.descuentosPara(lista, ['Coro'], true).map((d) => d.id))
    caso('un descuento apagado no se ofrece', false,
      m.descuentosPara(lista, ['Costalero'], true).some((d) => d.id === 'd3'))
    // A quien no es hermano, ninguno: en el mostrador es fácil dejarse puesto
    // el de la venta anterior sin darse cuenta.
    caso('a quien no es hermano, ninguno', 0, m.descuentosPara(lista, undefined, false).length)
    caso('y sin etiquetas, solo el general', ['d2'],
      m.descuentosPara(lista, undefined, true).map((d) => d.id))
  }

  // 6. Reponer y agotarse son dos cosas distintas.
  {
    caso('queda poco', true, m.quedaPoco({ stock: 2, stockMinimo: 3 }))
    caso('justo en el mínimo todavía no', false, m.quedaPoco({ stock: 3, stockMinimo: 3 }))
    caso('sin mínimo puesto, no avisa nunca', false, m.quedaPoco({ stock: 0, stockMinimo: 0 }))
    caso('agotado es otra cosa', true, m.agotado({ stock: 0 }))
    caso('la referencia de la factura se lee', 'A-14', m.referenciaFactura({ serie: 'A', numero: 14 }))
  }
}
