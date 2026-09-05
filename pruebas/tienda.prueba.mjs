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

  // El corredor solo llama a `default`: sin esto, lo de abajo no se ejecuta.
  await laCestaDeLaWeb({ cargar, caso })
  await laFacturaCuadra({ cargar, caso })
  await lasCifrasDeLosDatos({ cargar, caso })
}

/**
 * LO QUE SE APARTA DESDE LA WEB.
 *
 * Reservar no es vender: no baja el stock, no hace factura y no toca la
 * tesorería. Lo único que se calcula de este lado es el total que se le enseña
 * a quien está llenando la cesta —los precios los pone la base, y quien
 * reserva no tiene sesión— y cuánto le cabe todavía.
 *
 * El resto del circuito —que no se aparte más de lo disponible, que el precio
 * del navegador se ignore, que la factura nazca al recoger— se prueba contra
 * un Postgres de verdad en `basedatos.prueba.mjs`: son cosas que solo fallan
 * con dos personas apartando lo mismo a la vez.
 */
export async function laCestaDeLaWeb({ cargar, caso }) {
  const m = await cargar('src/data/tienda.ts')
  const art = (id, precio, disponible) => ({
    id, codigo: id, nombre: id, descripcion: '', precio, iva: 21, disponible,
  })

  // 1. El total, en céntimos. Tres a 6,10 tienen que dar 18,30 y no
  // 18,299999999999997, que en pantalla sale como «18,3 €».
  {
    const a = art('a', 6.1, 10)
    caso('tres a 6,10 dan 18,30', 18.3, m.totalDeLaCesta([{ articulo: a, cantidad: 3 }]))
    caso('la cesta vacía vale cero', 0, m.totalDeLaCesta([]))
    caso('dos artículos distintos se suman', 33.3, m.totalDeLaCesta([
      { articulo: a, cantidad: 3 }, { articulo: art('b', 15, 4), cantidad: 1 },
    ]))
  }

  /*
   * 2. LO QUE CABE TODAVÍA se mide contra lo que YA HAY EN LA CESTA, no solo
   * contra lo disponible. Sin eso se puede añadir de uno en uno hasta pasarse,
   * y el rechazo llega al final, después de escribir el nombre y el teléfono.
   */
  {
    const a = art('a', 10, 3)
    caso('con la cesta vacía caben las tres', 3, m.cabenTodavia(a, []))
    caso('con dos puestas, cabe una', 1, m.cabenTodavia(a, [{ articulo: a, cantidad: 2 }]))
    caso('con las tres puestas, ninguna', 0, m.cabenTodavia(a, [{ articulo: a, cantidad: 3 }]))
    // Nunca negativo: si la hermandad ha vendido en el mostrador entre medias,
    // lo disponible baja y la cesta se queda por encima.
    caso('nunca en negativo', 0, m.cabenTodavia(a, [{ articulo: a, cantidad: 9 }]))
    caso('lo de otro artículo no cuenta', 3, m.cabenTodavia(a, [{ articulo: art('b', 5, 5), cantidad: 4 }]))
    caso('lo agotado se ve', true, m.seAgoto(art('c', 5, 0)))
    caso('y lo que queda, también', false, m.seAgoto(art('c', 5, 1)))
  }

  /*
   * 3. QUÉ SE LE PUEDE HACER A UNA RESERVA. Solo lo pendiente se toca: una
   * entregada ya es una venta y se anula desde la venta —si no, la factura se
   * queda en el aire—, y una anulada o caducada está cerrada.
   */
  {
    caso('una pendiente se entrega', true, m.sePuedeEntregar({ estado: 'pendiente' }))
    caso('una entregada, no otra vez', false, m.sePuedeEntregar({ estado: 'entregada' }))
    caso('una anulada tampoco', false, m.sePuedeEntregar({ estado: 'anulada' }))
    caso('ni una caducada', false, m.sePuedeEntregar({ estado: 'caducada' }))
  }

  /*
   * 4. EL PLAZO, COMPARANDO CADENAS y no objetos `Date`.
   *
   * Es la misma trampa que hizo nacer `lib/hoy.ts`: `new Date('2026-08-26')`
   * se interpreta en UTC, que en España es la 01:00 o las 02:00 del día 26, y
   * comparar eso con `new Date()` a mediodía daba la reserva por vencida con
   * horas de adelanto. Con cadenas «2026-08-26», la comparación es la del
   * calendario, que es la que entiende quien está en el mostrador.
   */
  {
    const r = (recogerAntesDe, estado = 'pendiente') => ({ estado, recogerAntesDe })
    caso('ayer venció', true, m.seLePasoElPlazo(r('2026-08-25'), '2026-08-26'))
    caso('hoy todavía no', false, m.seLePasoElPlazo(r('2026-08-26'), '2026-08-26'))
    caso('mañana tampoco', false, m.seLePasoElPlazo(r('2026-08-27'), '2026-08-26'))
    caso('una entregada nunca vence', false, m.seLePasoElPlazo(r('2020-01-01', 'entregada'), '2026-08-26'))
    caso('sin plazo puesto, no vence', false, m.seLePasoElPlazo(r(''), '2026-08-26'))
    // Y el cambio de año, que es donde se rompe una comparación por texto mal
    // hecha: «2026-12-31» tiene que ser anterior a «2027-01-01».
    caso('el fin de año se compara bien', true, m.seLePasoElPlazo(r('2026-12-31'), '2027-01-01'))
  }
}


/**
 * QUE LA FACTURA CUADRE.
 *
 * Aquí no se prueba que se pinte bonito: se prueba que los números sumen. Una
 * factura donde el desglose de IVA no da el total de la cabecera es una
 * factura mal hecha, y es lo primero que mira una inspección.
 *
 * El detalle que lo decide todo: la base se calcula LÍNEA A LÍNEA y luego se
 * agrupa por tipo, igual que hace `registrar_venta()` en la base. Agrupando
 * primero y dividiendo después —que es lo natural de escribir— los redondeos
 * caen en otro sitio y el desglose suma un céntimo distinto del total.
 */
export async function laFacturaCuadra({ cargar, caso }) {
  const m = await cargar('src/data/tienda.ts')
  const l = (cantidad, precioUnitario, iva, precioTarifa = precioUnitario) => ({
    id: 'x', ventaId: 'v', codigo: 'C', nombre: 'N',
    cantidad, precioUnitario, precioTarifa, costeUnitario: 0, iva,
  })

  // 1. Un solo tipo: base + cuota = total, exacto.
  {
    const t = m.desgloseIvaPorTipo([l(2, 15, 21)])
    caso('un solo tramo', 1, t.length)
    caso('al 21 %', 21, t[0].tipo)
    caso('base', 24.79, t[0].base)
    caso('cuota', 5.21, t[0].cuota)
    caso('y suman el total', 30, t[0].total)
  }

  /*
   * 2. DOS TIPOS EN LA MISMA VENTA: una camiseta al 21 % y un libro al 4 %.
   * Es el caso que obliga a desglosar, y el que no se puede resolver con un
   * «IVA total» a secas.
   */
  {
    const t = m.desgloseIvaPorTipo([l(1, 15, 21), l(1, 28, 4), l(2, 4.5, 21)])
    caso('dos tramos', 2, t.length)
    caso('el más alto primero', [21, 4], t.map((x) => x.tipo))
    caso('el del 21 junta camiseta y llaveros', 24, t[0].total)
    caso('y el del 4, el libro', 28, t[1].total)
    const s = m.sumaDelDesglose(t)
    caso('el desglose suma el total', 52, s.total)
    caso('y base + cuota da el total', 52, Math.round((s.base + s.cuota) * 100) / 100)
  }

  /*
   * 3. Y LO QUE DE VERDAD IMPORTA: que el desglose sume EXACTAMENTE lo que
   * calculó la base de datos. `registrar_venta()` hace, por cada línea,
   * `round(bruto / (1 + iva/100), 2)` y las suma. Aquí se reproduce esa cuenta
   * sobre precios elegidos para que el redondeo caiga mal —0,07 al 21 % da
   * 0,0578…— y se compara.
   */
  {
    const lineas = [l(3, 0.07, 21), l(7, 1.13, 21), l(1, 9.99, 10), l(5, 2.35, 4)]
    const comoLaBase = lineas.reduce((acc, x) => {
      const bruto = Math.round(Math.round(x.precioUnitario * 100) * x.cantidad)
      const base = Math.round(bruto / (1 + x.iva / 100))
      return { base: acc.base + base, iva: acc.iva + (bruto - base), total: acc.total + bruto }
    }, { base: 0, iva: 0, total: 0 })
    const s = m.sumaDelDesglose(m.desgloseIvaPorTipo(lineas))
    caso('la base es la misma que la de la base de datos', comoLaBase.base / 100, s.base)
    caso('y la cuota también', comoLaBase.iva / 100, s.cuota)
    caso('y el total', comoLaBase.total / 100, s.total)
  }

  /*
   * 4. Y AGRUPAR ANTES DE DIVIDIR DARÍA OTRA COSA. Esta comprobación existe
   * para que se vea el fallo que se está evitando: si alguien «simplifica»
   * `desgloseIvaPorTipo` sumando los brutos por tipo y dividiendo una sola vez,
   * esto lo delata.
   */
  {
    const lineas = [l(1, 0.07, 21), l(1, 0.07, 21), l(1, 0.07, 21)]
    const bien = m.sumaDelDesglose(m.desgloseIvaPorTipo(lineas))
    // Agrupando primero: 21 céntimos entre 1,21 = 17,355… → 17.
    const agrupando = Math.round(21 / 1.21) / 100
    caso('línea a línea da 0,18', 0.18, bien.base)
    caso('agrupando daría 0,17: por eso no se agrupa', 0.17, agrupando)
  }

  // 5. Sin líneas no hay tramos, y la suma es cero (no NaN).
  {
    caso('sin líneas, sin tramos', 0, m.desgloseIvaPorTipo([]).length)
    caso('y la suma es cero', 0, m.sumaDelDesglose([]).total)
  }

  /*
   * 6. IVA AL 0 %, que es el caso normal de una hermandad exenta. Tiene que
   * salir en el desglose igualmente: una factura sin línea de IVA no dice si
   * es que está exenta o si se olvidó.
   */
  {
    const t = m.desgloseIvaPorTipo([l(2, 10, 0)])
    caso('el 0 % también es un tramo', 0, t[0].tipo)
    caso('con cuota cero', 0, t[0].cuota)
    caso('y base igual al total', 20, t[0].base)
  }

  // 7. Lo rebajado se reconoce, para poder enseñar la tarifa al lado.
  {
    caso('un precio por debajo de tarifa es rebaja', true, m.seRebajo({ precioUnitario: 7.5, precioTarifa: 15 }))
    caso('al mismo precio, no', false, m.seRebajo({ precioUnitario: 15, precioTarifa: 15 }))
    caso('sin tarifa apuntada, tampoco', false, m.seRebajo({ precioUnitario: 7.5, precioTarifa: 0 }))
    // Por encima de tarifa no es rebaja (ni se tacha nada).
    caso('por encima no es rebaja', false, m.seRebajo({ precioUnitario: 20, precioTarifa: 15 }))
  }
}


/**
 * LAS CIFRAS DE LA PANTALLA DE DATOS.
 *
 * Lo que hay detrás de las gráficas. Aquí no se prueba que se dibujen, se
 * prueba que los números que dibujan sean los correctos — que es lo que decide
 * si una junta toma una decisión con la cifra buena o con otra.
 */
export async function lasCifrasDeLosDatos({ cargar, caso }) {
  const m = await cargar('src/data/tienda.ts')
  const mes = (n, canal, total, coste = 0, ventas = 1) => ({
    mes: n, canal, total, base: total, iva: 0, coste, ventas,
  })

  /*
   * 1. EL RESUMEN, en céntimos y sin mezclar canales.
   *
   * El margen es lo cobrado menos lo que costó el género: es la cifra que de
   * verdad le queda a la hermandad, y la que no se puede confundir con «lo
   * facturado».
   */
  {
    const meses = [mes(1, 'fisica', 100, 40, 4), mes(1, 'online', 50, 20, 2), mes(2, 'fisica', 30, 12, 1)]
    const todo = m.resumenDeTienda(meses, 'todos')
    caso('el total junta los dos canales', 180, todo.total)
    caso('y el margen descuenta el coste', 108, todo.margen)
    caso('con sus siete facturas', 7, todo.ventas)
    const solo = m.resumenDeTienda(meses, 'fisica')
    caso('el mostrador va aparte', 130, solo.total)
    caso('e internet también', 50, m.resumenDeTienda(meses, 'online').total)
  }

  /*
   * 2. LO QUE SE LLEVA CADA UNO. Sin ventas NO se divide: daría `NaN` y la
   * pantalla pondría «NaN €», que es de las pocas cosas que hacen que alguien
   * deje de fiarse de todo lo demás de la página.
   */
  {
    caso('la media por factura', 25, m.resumenDeTienda([mes(1, 'fisica', 100, 0, 4)], 'todos').ticketMedio)
    caso('sin ventas, cero y no NaN', 0, m.resumenDeTienda([], 'todos').ticketMedio)
    caso('y el resto también es cero', 0, m.resumenDeTienda([], 'todos').total)
    // Y con importes que no dividen redondo, en céntimos.
    caso('10 € entre 3 son 3,33 €', 3.33, m.resumenDeTienda([mes(1, 'fisica', 10, 0, 3)], 'todos').ticketMedio)
  }

  /*
   * 3. LOS DOCE MESES, SIEMPRE. Es el detalle que decide si la gráfica dice la
   * verdad: la base solo devuelve los meses que tienen algo, y una gráfica a
   * la que le faltan los vacíos pega junio con septiembre como si fueran
   * consecutivos.
   */
  {
    const doce = m.doceMeses([mes(6, 'fisica', 100), mes(9, 'fisica', 50)], 'todos')
    caso('siempre salen doce', 12, doce.length)
    caso('junio en su sitio', 100, doce[5])
    caso('julio y agosto, a cero', [0, 0], [doce[6], doce[7]])
    caso('y septiembre en el suyo', 50, doce[8])
    // Los dos canales del mismo mes se suman.
    caso('los dos canales de un mes se suman', 150,
      m.doceMeses([mes(3, 'fisica', 100), mes(3, 'online', 50)], 'todos')[2])
    caso('y filtrando, no', 100, m.doceMeses([mes(3, 'fisica', 100), mes(3, 'online', 50)], 'fisica')[2])
    // Un mes fuera de rango no puede tirar la gráfica.
    caso('un mes imposible se ignora', 12, m.doceMeses([mes(13, 'fisica', 99), mes(0, 'fisica', 99)], 'todos').length)
    caso('y no suma en ningún sitio', 0, m.doceMeses([mes(13, 'fisica', 99)], 'todos').reduce((a, b) => a + b, 0))
  }

  /*
   * 4. EL RANKING. Junta canales por código, ordena por lo que deja, corta, y
   * DICE LO QUE HA DEJADO FUERA: una lista de «los que más se venden» que se
   * calla que hay otros treinta se lee como si fueran todos.
   */
  {
    const a = (codigo, canal, unidades, importe) => ({
      codigo, nombre: codigo, canal, unidades, importe, coste: 0,
    })
    const lista = [
      a('CAM', 'fisica', 2, 30), a('CAM', 'online', 3, 45),
      a('LIB', 'fisica', 1, 28), a('LLA', 'fisica', 4, 18),
    ]
    const r = m.losQueMasSeVenden(lista, 'todos', 2)
    caso('la camiseta junta sus dos canales', 75, r.lista[0].importe)
    caso('con sus cinco unidades', 5, r.lista[0].unidades)
    caso('el segundo es el libro', 'LIB', r.lista[1].codigo)
    caso('y se dice cuántos quedan fuera', 1, r.resto)
    caso('y por cuánto', 18, r.restoImporte)
    // Filtrando por canal, solo lo de ese canal.
    caso('filtrado por internet, solo la camiseta', ['CAM'],
      m.losQueMasSeVenden(lista, 'online').lista.map((x) => x.codigo))
    caso('sin nada, lista vacía y sin resto', [0, 0], (() => {
      const v = m.losQueMasSeVenden([], 'todos')
      return [v.lista.length, v.resto]
    })())
  }

  // 5. Las formas de pago, juntadas y de más a menos.
  {
    const f = (forma, canal, total, ventas) => ({ forma, canal, total, ventas })
    const r = m.comoPagaLaGente([
      f('Efectivo', 'fisica', 100, 8), f('Bizum', 'online', 45, 3), f('Bizum', 'fisica', 60, 4),
    ], 'todos')
    caso('el bizum de los dos canales se junta', 105, r[0].total)
    caso('con sus siete ventas', 7, r[0].ventas)
    caso('y va primero por importe', 'Bizum', r[0].forma)
    caso('el efectivo detrás', 'Efectivo', r[1].forma)
  }

  /*
   * 6. EL TECHO DEL EJE. Un eje que acaba en 4.317 € hace que lo primero que
   * se lea de la gráfica sea ese número raro.
   */
  {
    caso('4.317 sube a 5.000', 5000, m.techoRedondo(4317))
    caso('120 sube a 150', 150, m.techoRedondo(120))
    caso('1.000 exacto se queda', 1000, m.techoRedondo(1000))
    caso('9.500 sube a 10.000', 10000, m.techoRedondo(9500))
    caso('7,5 sube a 10', 10, m.techoRedondo(7.5))
    // Sin datos NO devuelve cero: dividir por cero llenaría la gráfica de NaN.
    caso('sin datos, un techo cualquiera pero no cero', 100, m.techoRedondo(0))
    caso('ni con algo que no es número', 100, m.techoRedondo(Number.NaN))
    caso('ni con un negativo', 100, m.techoRedondo(-5))
  }
  /*
   * 7. EL PRECIO DE HERMANO EN LA WEB.
   *
   * Hasta ahora el descuento solo existía en el mostrador: el hermano que
   * compraba por internet pagaba tarifa, sin que nada le dijera que entrando en
   * su área le habría costado menos.
   *
   * `precioHermano` VACÍO NO ES «igual que el precio». Son dos cosas distintas
   * —«no le corresponde ninguno, o no ha entrado» frente a «le corresponde»— y
   * la página las dice distinto: a uno le ofrece entrar y al otro le enseña la
   * tarifa tachada. Rellenarlo con `precio` cuando no hay descuento borraría esa
   * diferencia y el enlace de «entra y verás tu precio» no saldría nunca.
   */
  {
    const tarifa = { precio: 25 }
    const rebajado = { precio: 25, precioHermano: 22.5 }
    caso('sin descuento se paga la tarifa', 25, m.precioParaMi(tarifa))
    caso('y no se dice que esté rebajado', false, m.seRebajoParaMi(tarifa))
    caso('con descuento se paga el suyo', 22.5, m.precioParaMi(rebajado))
    caso('y sí se dice', true, m.seRebajoParaMi(rebajado))
    // Un descuento del 0 % existe y no es una rebaja: enseñar la tarifa tachada
    // al lado del mismo número es de las cosas que hacen desconfiar de un precio.
    caso('un 0 % no se pinta como rebaja', false,
      m.seRebajoParaMi({ precio: 25, precioHermano: 25 }))

    /*
     * Y EL TOTAL DE LA CESTA CON EL PRECIO DE HERMANO. Es lo que se le enseña
     * antes de dar los datos y lo que va escrito en el resguardo: si aquí
     * saliera la tarifa, la web prometería un importe y el mostrador cobraría
     * otro, con un papel de por medio.
     */
    const art = (id, precio, precioHermano) => ({
      id, codigo: id, nombre: id, descripcion: '', precio, iva: 21, disponible: 10, precioHermano,
    })
    caso('la cesta suma con el precio de hermano', 22.5 * 2 + 5.4,
      m.totalDeLaCesta([
        { articulo: art('a', 25, 22.5), cantidad: 2 },
        { articulo: art('b', 6, 5.4), cantidad: 1 },
      ]))
    caso('y sin él, con la tarifa', 25 * 2 + 6,
      m.totalDeLaCesta([
        { articulo: art('a', 25), cantidad: 2 },
        { articulo: art('b', 6), cantidad: 1 },
      ]))
    /*
     * En céntimos, como todo lo demás de este archivo. Tres artículos de 6,10
     * sumados con decimales dan 18,299999999999997, y en pantalla «18,3 €».
     */
    caso('y en céntimos, sin arrastrar decimales', 18.3,
      m.totalDeLaCesta([{ articulo: art('c', 7, 6.1), cantidad: 3 }]))
  }

  /*
   * 8. CUÁNTO MÁS CABE: la misma cuenta para la web y para el mostrador.
   *
   * Estaba escrita dos veces con dos criterios: la web contra lo disponible y
   * la caja contra nada en absoluto —dejaba teclear 99 de algo de lo que
   * quedaban 3, y el rechazo llegaba al cobrar, con la persona delante—.
   */
  {
    caso('caben las que quedan menos las puestas', 2, m.loQueQuedaPorPoner(5, 3))
    caso('no cabe nada si ya están todas', 0, m.loQueQuedaPorPoner(3, 3))
    // Nunca negativo: un «caben −2» se usaría como número en algún sitio.
    caso('ni con más puestas de las que hay', 0, m.loQueQuedaPorPoner(3, 7))
    caso('ni con el disponible en negativo', 0, m.loQueQuedaPorPoner(-2, 0))
  }
}
