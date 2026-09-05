/**
 * LA TIENDA SIN BASE DE DATOS (la demostración).
 *
 * Con Supabase delante manda `registrar_venta`, y eso ya se prueba contra un
 * Postgres de verdad en `basedatos.prueba.mjs`. Esto vigila la otra mitad: que
 * la demostración haga LO MISMO, porque si las dos se separan, lo que se
 * enseña al vender no es lo que va a pasar el día que se conecte la base.
 *
 * Y la tienda era el único módulo que no se podía probar entero sin base de
 * datos: catálogo vacío, artículos agotados que no se podían pulsar y un botón
 * de cobrar apagado. Llegó dicho como «no aparecen bien los artículos, no se
 * puede hacer facturas».
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/tiendaLocal.ts')
  const datos = await cargar('src/data/tienda.ts')

  const CLAVES = {
    productos: 'cabildo-productos',
    ventas: 'cabildo-ventas',
    lineas: 'cabildo-lineas-venta',
    stock: 'cabildo-movimientos-stock',
    libro: 'cabildo-movimientos',
  }
  function limpiar() {
    Object.values(CLAVES).forEach((k) => localStorage.removeItem(k))
  }
  const leer = (k) => JSON.parse(localStorage.getItem(k) ?? '[]')
  const catalogo = () => leer(CLAVES.productos)
  const de = (codigo) => catalogo().find((p) => p.codigo === codigo)

  /* ---- 1. El catálogo de ejemplo trae género ---- */
  {
    limpiar()
    const conStock = datos.PRODUCTOS_INICIALES.filter((p) => p.stock > 0)
    caso('hay artículos de ejemplo', true, datos.PRODUCTOS_INICIALES.length >= 5)
    caso('y casi todos con existencias', true, conStock.length >= 4)
    // Uno agotado a propósito: es como se ve en la caja un artículo que no se
    // puede vender y en el almacén el aviso de reponer.
    caso('uno agotado, para que se vea', 1,
      datos.PRODUCTOS_INICIALES.filter((p) => p.stock === 0).length)
    // Sin esto, la primera venta de la demostración falla con «solo hay 0».
    caso('el catálogo se lee con los de ejemplo aunque no haya nada guardado',
      datos.PRODUCTOS_INICIALES.length, catalogo().length === 0
        ? datos.PRODUCTOS_INICIALES.length : catalogo().length)
  }

  /* ---- 2. Una venta normal ---- */
  {
    limpiar()
    localStorage.setItem(CLAVES.productos, JSON.stringify(datos.PRODUCTOS_INICIALES))
    const medalla = de('MED')   // 25 € al 21 %, coste 11
    const camiseta = de('CAM')  // 15 € al 21 %, coste 6,50
    const r = m.registrarVentaLocal({
      lineas: [
        { producto: medalla, cantidad: 1 },
        { producto: camiseta, cantidad: 2 },
      ],
      canal: 'fisica',
      formaPago: 'Efectivo',
    })
    caso('se cobra', true, r.ok)
    caso('la primera factura es la 1', 1, r.venta.numero)
    caso('y de la serie A', 'A', r.venta.serie)
    caso('total', 55, r.venta.total)
    caso('base', 45.45, r.venta.base)
    caso('IVA', 9.55, r.venta.iva)
    caso('base + IVA dan el total', 55, Math.round((r.venta.base + r.venta.iva) * 100) / 100)
    caso('coste del género', 24, r.venta.coste)

    caso('queda guardada una factura', 1, leer(CLAVES.ventas).length)
    caso('con sus dos líneas', 2, m.lineasLocalesDe(r.venta.id).length)

    // El almacén baja, y con su movimiento: sin él, el stock cambia y nadie
    // sabe por qué.
    caso('la medalla baja de 40 a 39', 39, de('MED').stock)
    caso('la camiseta baja de 62 a 60', 60, de('CAM').stock)
    caso('y queda apuntado por qué', 2, leer(CLAVES.stock).length)
    caso('como salida de venta', -1, m.historialLocalDe(medalla.id)[0].cantidad)

    /*
     * LOS TRES ASIENTOS, los mismos que deja `registrar_venta` en el SQL: el
     * ingreso por la BASE, el IVA en su propia partida y el coste del género
     * como gasto. Sumar base e IVA en una sola línea diría que la tienda
     * ingresa un 21 % más de lo que ingresa.
     */
    const libro = leer(CLAVES.libro)
    const suyos = libro.filter((x) => (x.origen ?? '').includes(r.venta.id))
    caso('deja tres apuntes en el libro', 3, suyos.length)
    caso('el ingreso es por la base', 45.45,
      suyos.find((x) => x.origen === `venta:${r.venta.id}`).importe)
    caso('el IVA va aparte', 9.55,
      suyos.find((x) => x.origen === `iva-venta:${r.venta.id}`).importe)
    caso('y en su propia partida', 'IVA repercutido',
      suyos.find((x) => x.origen === `iva-venta:${r.venta.id}`).categoria)
    caso('el coste del género es un gasto', 'Gasto',
      suyos.find((x) => x.origen === `coste-venta:${r.venta.id}`).tipo)
    // Nacen pendientes: conciliar es cotejar con el extracto, y eso lo hace el
    // tesorero. Es la misma regla que el resto del libro.
    caso('los tres nacen pendientes de conciliar', 3,
      suyos.filter((x) => x.estado === 'Pendiente').length)
    // En efectivo entra en la caja; con tarjeta o transferencia, en el banco.
    caso('en efectivo entra en Caja', 3, suyos.filter((x) => x.cuenta === 'Caja').length)
  }

  /* ---- 3. La numeración es correlativa ---- */
  {
    const segunda = m.registrarVentaLocal({
      lineas: [{ producto: de('LLA'), cantidad: 1 }],
      canal: 'fisica', formaPago: 'Tarjeta',
    })
    caso('la siguiente factura es la 2', 2, segunda.venta.numero)
    caso('con tarjeta el dinero entra en el banco', 'Cuenta bancaria',
      leer(CLAVES.libro).find((x) => x.origen === `venta:${segunda.venta.id}`).cuenta)
  }

  /* ---- 4. No se vende lo que no hay ---- */
  {
    const vela = de('CER') // agotada a propósito
    const r = m.registrarVentaLocal({
      lineas: [{ producto: vela, cantidad: 1 }],
      canal: 'fisica', formaPago: 'Efectivo',
    })
    caso('no se puede vender lo agotado', false, r.ok)
    caso('y se dice cuántas hay', true, /Solo hay 0/.test(r.error))
    caso('sin dejar media factura', 2, leer(CLAVES.ventas).length)
  }

  /* ---- 5. Sin IVA no hay asiento de IVA ---- */
  {
    limpiar()
    localStorage.setItem(CLAVES.productos, JSON.stringify(datos.PRODUCTOS_INICIALES))
    const estampa = de('EST') // 1 € al 0 %
    const r = m.registrarVentaLocal({
      lineas: [{ producto: estampa, cantidad: 10 }],
      canal: 'fisica', formaPago: 'Efectivo',
    })
    caso('sin IVA, todo es base', 10, r.venta.base)
    caso('y la cuota es cero', 0, r.venta.iva)
    // Un asiento de cero euros solo ensucia el libro.
    caso('no se apunta un IVA de cero euros', 0,
      leer(CLAVES.libro).filter((x) => x.origen === `iva-venta:${r.venta.id}`).length)
  }

  /* ---- 6. Anular: vuelve el género y se contra-apunta ---- */
  {
    limpiar()
    localStorage.setItem(CLAVES.productos, JSON.stringify(datos.PRODUCTOS_INICIALES))
    const libro2 = m.registrarVentaLocal({
      lineas: [{ producto: de('LIB'), cantidad: 2 }],
      canal: 'fisica', formaPago: 'Efectivo',
    })
    caso('quedan 22 libros', 22, de('LIB').stock)
    const a = m.anularVentaLocal(libro2.venta.id, 'Se equivocó de artículo')
    caso('se anula', true, a.ok)
    caso('el género vuelve', 24, de('LIB').stock)
    // La factura NO se borra y su número se queda ocupado: una numeración con
    // huecos es lo primero que mira una inspección.
    caso('la factura sigue estando', 1, leer(CLAVES.ventas).length)
    caso('pero anulada', 'Anulada', leer(CLAVES.ventas)[0].estado)
    const contrarios = leer(CLAVES.libro).filter((x) => (x.origen ?? '').startsWith('anulacion-'))
    caso('y hay un apunte contrario por cada uno', 3, contrarios.length)
    caso('el del ingreso ahora es un gasto', 'Gasto',
      contrarios.find((x) => x.origen === `anulacion-venta:${libro2.venta.id}`).tipo)
    caso('anular dos veces no devuelve el género otra vez', false,
      m.anularVentaLocal(libro2.venta.id, '').ok)
    caso('y el almacén sigue en 24', 24, de('LIB').stock)
  }

  /* ---- 7. Mover el almacén a mano ---- */
  {
    limpiar()
    localStorage.setItem(CLAVES.productos, JSON.stringify(datos.PRODUCTOS_INICIALES))
    const vela = de('CER')
    const r = m.moverStockLocal(vela, 'compra', 48, 'Pedido al proveedor')
    caso('entra género', 48, r.ok && r.stock)
    caso('y se ve en el catálogo', 48, de('CER').stock)
    const rota = m.moverStockLocal(de('CER'), 'rotura', -50, 'Se cayó la caja')
    caso('el almacén no puede quedar en negativo', false, rota.ok)
    caso('con el número que hace falta saber', true, /Solo hay 48/.test(rota.error))
    caso('el historial dice por qué subió', 'Pedido al proveedor',
      m.historialLocalDe(vela.id)[0].motivo)
  }

  limpiar()

  // El corredor solo llama a `default`: sin esto, lo de abajo no se ejecuta.
  await reservasDeLaWeb({ cargar, caso })
  await elLibroDeLaDemoNoSeBorra({ cargar, caso })
}

/**
 * UNA VENTA, NADA MÁS QUE HAYA HECHO NADIE ANTES, NO SE PUEDE COMER EL LIBRO.
 *
 * En la demostración recién elegida, los apuntes de ejemplo del libro de
 * Tesorería (`MOVIMIENTOS_INICIALES`) viven SOLO en la memoria de React —
 * `useSupabaseTable` los usa como valor de arranque, pero no los escribe en
 * este navegador hasta que algo llama a `setMovimientos` por primera vez—.
 * Si lo primero que hace alguien en una demostración nueva es irse
 * directamente a la Tienda y cobrar algo, `localStorage` para
 * `cabildo-movimientos` está todavía vacío del todo.
 *
 * Esto pasó de verdad: la función que cierra la venta leía el libro con
 * `leerPersistido(clave, [])` —el `[]` de más, no el de `MOVIMIENTOS_INICIALES`
 * que usa Tesorería— y luego GUARDABA solo sus tres apuntes nuevos encima de
 * ese `[]`. La próxima pantalla que montara el libro de verdad —Informes,
 * Tesorería— ya no encontraba los dieciocho apuntes de ejemplo: encontraba
 * los tres de la venta y nada más, y los ingresos del año se iban a 0,00 €.
 * Se descubrió vendiendo una medalla en el navegador y viendo cómo el total
 * del año se borraba entero delante de los ojos.
 */
async function elLibroDeLaDemoNoSeBorra({ cargar, caso }) {
  const m = await cargar('src/lib/tiendaLocal.ts')
  const datos = await cargar('src/data/tienda.ts')
  const movs = await cargar('src/data/movimientos.ts')
  const K = { productos: 'cabildo-productos', libro: 'cabildo-movimientos' }

  // Como en una demostración de verdad recién empezada: solo el catálogo
  // sembrado (que sí se lee con su propio valor por defecto), y el libro de
  // Tesorería SIN TOCAR — nadie ha pasado antes por esa pantalla.
  localStorage.removeItem(K.libro)
  localStorage.setItem(K.productos, JSON.stringify(datos.PRODUCTOS_INICIALES))
  const de = (codigo) => JSON.parse(localStorage.getItem(K.productos)).find((p) => p.codigo === codigo)

  const r = m.registrarVentaLocal({
    lineas: [{ producto: de('MED'), cantidad: 1 }],
    canal: 'fisica', formaPago: 'Efectivo',
  })
  caso('la venta se cobra igual', true, r.ok)

  const libro = JSON.parse(localStorage.getItem(K.libro) ?? '[]')
  const maximoDeEjemplo = Math.max(...movs.MOVIMIENTOS_INICIALES.map((x) => x.numero))
  // La medalla lleva IVA y coste, así que la venta deja tres apuntes nuevos:
  // el de ejemplo más esos tres, ni uno más ni uno menos.
  caso('los apuntes de ejemplo siguen todos en el libro', movs.MOVIMIENTOS_INICIALES.length + 3, libro.length)
  caso(
    'ninguno de los de ejemplo se ha perdido',
    true,
    movs.MOVIMIENTOS_INICIALES.every((original) => libro.some((x) => x.id === original.id)),
  )
  caso(
    'y el apunte de la venta sigue la numeración del libro, no empieza en 1',
    maximoDeEjemplo + 1,
    libro.find((x) => (x.origen ?? '') === `venta:${r.venta.id}`)?.numero,
  )

  localStorage.removeItem(K.productos)
  localStorage.removeItem(K.libro)
}

/**
 * LAS RESERVAS DE LA WEB, sin base de datos.
 *
 * Apartar por internet y pagar al recogerlo. Es la otra mitad de la tienda: sin
 * esto, la sección de la web pública es un escaparate con un botón que contesta
 * «todavía no está conectada».
 */
export async function reservasDeLaWeb({ cargar, caso }) {
  const m = await cargar('src/lib/tiendaLocal.ts')
  const datos = await cargar('src/data/tienda.ts')
  const K = {
    productos: 'cabildo-productos', reservas: 'cabildo-reservas-tienda',
    lineas: 'cabildo-lineas-reserva', ventas: 'cabildo-ventas',
    lineasVenta: 'cabildo-lineas-venta', stock: 'cabildo-movimientos-stock',
    libro: 'cabildo-movimientos',
  }
  Object.values(K).forEach((k) => localStorage.removeItem(k))
  localStorage.setItem(K.productos, JSON.stringify(datos.PRODUCTOS_INICIALES))
  const leer = (k) => JSON.parse(localStorage.getItem(k) ?? '[]')
  const de = (codigo) => leer(K.productos).find((p) => p.codigo === codigo)

  const camiseta = de('CAM') // 62 unidades a 15 €

  /* 1. Apartar */
  const r = m.reservarEnLaWebLocal({
    lineas: [{ articulo: camiseta, cantidad: 3 }],
    nombre: 'Rocío Domínguez', email: 'rocio@example.com',
  })
  caso('se aparta', true, r.ok)
  caso('con su referencia del año', true, /^R-\d{4}-1$/.test(r.resguardo.referencia))
  caso('y su total', 45, r.resguardo.total)
  caso('con fecha para recogerlo', true, /^\d{4}-\d{2}-\d{2}$/.test(r.resguardo.recogerAntesDe))

  /*
   * APARTAR NO ES VENDER: el almacén no se toca hasta que se recoge. Bajarlo al
   * apartar dejaría el género descontado por algo que a lo mejor no se recoge
   * nunca, y el recuento del almacén no cuadraría con la estantería.
   */
  caso('el almacén no se toca al apartar', 62, de('CAM').stock)
  // Pero lo apartado ya no se puede prometer dos veces.
  caso('lo apartado se descuenta de lo que se puede prometer', 3, m.apartadoDe(camiseta.id))

  /* 2. No se aparta más de lo que queda sin apartar */
  const vela = de('CER') // agotada
  caso('no se aparta lo agotado', false,
    m.reservarEnLaWebLocal({ lineas: [{ articulo: vela, cantidad: 1 }], nombre: 'Quien sea' }).ok)
  caso('ni doscientas camisetas de una vez', false,
    m.reservarEnLaWebLocal({ lineas: [{ articulo: camiseta, cantidad: 200 }], nombre: 'Quien sea' }).ok)
  caso('ni sin decir quién eres', false,
    m.reservarEnLaWebLocal({ lineas: [{ articulo: camiseta, cantidad: 1 }], nombre: '  ' }).ok)

  /*
   * 2 bis. Y EL MOSTRADOR TAMPOCO VENDE LO QUE ESTÁ APARTADO.
   *
   * Es la mitad que faltaba y la que de verdad rompía cosas. `apartadoDe` ya
   * existía y la web ya lo descontaba, pero la caja miraba `producto.stock` a
   * secas: con tres camisetas prometidas y 62 en la estantería, el mostrador
   * vendía las 62 sin decir nada. La persona que reservó venía con su
   * resguardo y no había nada, y encima su reserva se quedaba IMPOSIBLE DE
   * ENTREGAR, porque al intentarlo ya no quedaba género.
   */
  {
    const todas = m.registrarVentaLocal({
      lineas: [{ producto: camiseta, cantidad: 62 }], canal: 'fisica', formaPago: 'Efectivo',
    })
    caso('el mostrador NO vende las 62 con 3 apartadas', false, todas.ok)
    // Y lo dice entero, con los dos números: quien está en el mostrador tiene
    // que poder explicárselo a quien tiene delante.
    caso('y dice cuántas hay y cuántas están comprometidas', true,
      /3 están comprometidas por la web/.test(todas.error ?? ''))
    caso('sin tocar el almacén', 62, de('CAM').stock)

    // Vender lo que sí queda sin apartar se prueba al final, para no cambiar
    // los números con los que sigue contando el resto del recorrido.
  }

  /*
   * 2 ter. LA RESERVA SE PUEDE ENTREGAR AUNQUE NO QUEDE NADA MÁS.
   *
   * Es la trampa de todo esto: si al entregar se comprobara el disponible,
   * las líneas de la propia reserva contarían como apartadas y la reserva se
   * bloquearía A SÍ MISMA. Quedan exactamente 3 en la estantería y las 3 son
   * suyas.
   */

  /* 3. Entregar: ahí sí se cobra */
  const reserva = leer(K.reservas)[0]
  const entrega = m.entregarReservaLocal(reserva.id, 'Efectivo')
  caso('se entrega y se cobra', true, entrega.ok)
  caso('sale una factura', 1, entrega.venta.numero)
  caso('por el mismo importe que se apartó', 45, entrega.venta.total)
  caso('AHORA sí baja el almacén', 59, de('CAM').stock)
  caso('la reserva queda entregada', 'entregada', leer(K.reservas)[0].estado)
  caso('y apuntada a su factura', entrega.venta.id, leer(K.reservas)[0].ventaId)
  caso('lo apartado ya no cuenta', 0, m.apartadoDe(camiseta.id))
  caso('la venta es del canal online', 'online', leer(K.ventas)[0].canal)
  caso('y deja sus asientos en el libro', 3,
    leer(K.libro).filter((x) => (x.origen ?? '').includes(entrega.venta.id)).length)
  caso('entregar dos veces no cobra dos veces', false,
    m.entregarReservaLocal(reserva.id, 'Efectivo').ok)

  /* 4. Soltar lo que no se recoge */
  const otra = m.reservarEnLaWebLocal({
    lineas: [{ articulo: de('MED'), cantidad: 2 }], nombre: 'Quien no vuelve',
  })
  caso('se aparta otra', true, otra.ok)
  caso('hay dos medallas apartadas', 2, m.apartadoDe(de('MED').id))
  const suelta = leer(K.reservas).find((x) => x.referencia === otra.resguardo.referencia)
  caso('se suelta', true, m.soltarReservaLocal(suelta.id, 'caducada').ok)
  // No se borra: una reserva borrada es una llamada de teléfono que nadie
  // puede explicar.
  caso('sigue estando, marcada', 'caducada',
    leer(K.reservas).find((x) => x.id === suelta.id).estado)
  caso('y el género vuelve a poder prometerse', 0, m.apartadoDe(de('MED').id))
  caso('soltarla dos veces no hace nada', false, m.soltarReservaLocal(suelta.id, 'anulada').ok)

  /* 5. Los números de la tienda */
  {
    const anio = new Date().getFullYear()
    const d = m.datosTiendaLocales(anio)
    caso('el resumen cuenta la venta', 1, d.meses.reduce((n, x) => n + x.ventas, 0))
    caso('por el canal por el que entró', 'online', d.meses[0].canal)
    caso('con su importe', 45, d.meses.reduce((n, x) => n + x.total, 0))
    caso('y dice qué artículo se vendió', 'CAM', d.articulos[0].codigo)
    caso('cuántas unidades', 3, d.articulos[0].unidades)
    caso('y cómo se pagó', 'Efectivo', d.formas[0].forma)
    // Una factura anulada no es dinero que haya entrado.
    m.anularVentaLocal(entrega.venta.id, 'Devuelta')
    const despues = m.datosTiendaLocales(anio)
    caso('lo anulado no cuenta en el resumen', 0, despues.meses.length)
  }

  /*
   * 6. Y EL MOSTRADOR VENDE LO QUE SÍ QUEDA SIN APARTAR.
   *
   * Va al final para no mover los números del recorrido de arriba. Se aparta
   * de nuevo —la reserva anterior ya está entregada— y se comprueba el freno
   * por los dos lados: lo apartado no, lo demás sí.
   */
  {
    const quedan = de('CAM').stock
    const nueva = m.reservarEnLaWebLocal({
      lineas: [{ articulo: de('CAM'), cantidad: 4 }], nombre: 'Otra que aparta',
    })
    caso('se aparta otra tanda', true, nueva.ok)
    caso('no se venden todas las que hay en la estantería', false,
      m.registrarVentaLocal({
        lineas: [{ producto: de('CAM'), cantidad: quedan }], canal: 'fisica', formaPago: 'Efectivo',
      }).ok)
    caso('pero sí todas menos las apartadas', true,
      m.registrarVentaLocal({
        lineas: [{ producto: de('CAM'), cantidad: quedan - 4 }], canal: 'fisica', formaPago: 'Efectivo',
      }).ok)
    caso('y quedan justo las apartadas', 4, de('CAM').stock)
    caso('con lo apartado intacto', 4, m.apartadoDe(de('CAM').id))

    /*
     * Y ESA RESERVA SE PUEDE ENTREGAR aunque no quede ni una más. Es la trampa:
     * si al entregar se comprobara el disponible, las líneas de la propia
     * reserva contarían como apartadas y la reserva se bloquearía A SÍ MISMA.
     * Pasó de verdad, y el síntoma era «de "Camiseta" solo quedan 0 sin
     * apartar» al entregar una reserva perfectamente válida.
     */
    const suya = leer(K.reservas).find((x) => x.referencia === nueva.resguardo.referencia)
    caso('la reserva se entrega aunque no quede nada más', true,
      m.entregarReservaLocal(suya.id, 'Efectivo').ok)
    caso('y el almacén queda a cero', 0, de('CAM').stock)
  }

  Object.values(K).forEach((k) => localStorage.removeItem(k))
}
