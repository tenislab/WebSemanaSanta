/** P3: lo que se puede probar sin navegador del tratamiento de imágenes. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/imagen.ts')

  // --- El peso real de un data URL ---
  // Base64 mete un tercio de más sobre el tamaño real. Si no se descuenta, los
  // avisos de peso mienten y dicen que una foto ocupa un tercio más de lo que
  // de verdad va a viajar.
  const cabecera = 'data:image/webp;base64,'
  caso('cuatro caracteres base64 son tres bytes', 3, m.pesoDeDataUrl(cabecera + 'AAAA'))
  caso('ocho son seis', 6, m.pesoDeDataUrl(cabecera + 'AAAAAAAA'))
  // El relleno («=») no son datos.
  caso('con un relleno se descuenta uno', 2, m.pesoDeDataUrl(cabecera + 'AAA='))
  caso('con dos rellenos se descuentan dos', 1, m.pesoDeDataUrl(cabecera + 'AA=='))
  caso('vacío pesa cero', 0, m.pesoDeDataUrl(cabecera))
  // Algo que no sea un data URL no revienta: se devuelve su longitud.
  caso('lo que no es un data URL no revienta', 5, m.pesoDeDataUrl('hola!'))
  // Una foto de 100 kB de base64 son unos 75 kB de verdad.
  const cien = cabecera + 'A'.repeat(100000)
  caso('100.000 caracteres son unos 75 kB', 75000, m.pesoDeDataUrl(cien))
}
