/**
 * PINTA LOS DOCUMENTOS QUE SALEN EN PAPEL, para poder MIRARLOS.
 *
 * El certificado de antigüedad, el carné del hermano, la factura de la tienda
 * y la hoja de asistencia de un tramo son los documentos que la hermandad
 * imprime, sella y entrega. Un desajuste ahí no se arregla después: ya está
 * repartido.
 *
 * Y ninguno de los cuatro aparecía nombrado en ninguna prueba, ni se podía
 * mirar: los cuatro viven dentro de un cajón que se abre pulsando un botón, no
 * en una dirección a la que se pueda ir.
 *
 * ESTO NO AÑADE NADA A LA APLICACIÓN. No hay una pantalla nueva ni una ruta de
 * más: se monta el componente aquí, con `renderToStaticMarkup`, con los mismos
 * estilos que usa la aplicación, y sale un HTML que se puede abrir o
 * fotografiar. Una pantalla de galería dentro del panel sería superficie nueva
 * en producción para un problema que es solo de mirar.
 *
 *   node scripts/pintar-los-papeles.mjs
 *   → /tmp/papeles/*.html
 */
import { build } from 'esbuild'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SALIDA = process.env.PAPELES_SALIDA ?? '/tmp/papeles'

/*
 * El `localStorage` de mentira va ANTES de cargar nada: varios de estos
 * componentes lo consultan de pasada al montarse —«¿son datos de ejemplo?»,
 * «¿quién ha marcado asistencia?»— y en Node no existe.
 */
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
  clear: () => memoria.clear(),
  key: (i) => [...memoria.keys()][i] ?? null,
  get length() { return memoria.size },
}
globalThis.sessionStorage = globalThis.localStorage

/*
 * El compilado va DENTRO del proyecto, en `node_modules/.gobergo-papeles/`.
 *
 * React y `react-dom/server` se dejan fuera del paquete a propósito —hacen
 * falta las mismas instancias que usa el renderizador— y un módulo suelto en
 * `/tmp` no encuentra `react`: Node lo busca subiendo carpetas desde donde
 * está el fichero, y desde `/tmp` no hay `node_modules` al que llegar.
 */
async function cargar(ruta) {
  const dir = join(raiz, 'node_modules/.gobergo-papeles')
  await mkdir(dir, { recursive: true })
  const destino = join(dir, `${ruta.replace(/[^a-z0-9]/gi, '_')}.mjs`)
  const res = await build({
    entryPoints: [join(raiz, ruta)],
    bundle: true,
    format: 'esm',
    /*
     * `browser` y no `node`, que es lo que de verdad usa la aplicación. Con
     * `node`, `qrcode` resolvía a su versión de servidor —la que pinta PNG con
     * `fs`— y el carné se caía con «Dynamic require of fs is not supported».
     * En el navegador resuelve a la versión que dibuja en un lienzo.
     */
    platform: 'browser',
    jsx: 'automatic',
    write: false,
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom'],
    alias: { '@supabase/supabase-js': join(raiz, 'pruebas/stub-supabase.mjs') },
    define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }) },
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl' },
  })
  await writeFile(destino, res.outputFiles[0].text)
  return import(destino)
}

const css = await readFile(join(raiz, 'src/styles/global.css'), 'utf8')

/**
 * La página que envuelve cada documento.
 *
 * Fondo gris y el papel centrado, como se ve en pantalla antes de imprimir. Y
 * el tema se puede cambiar: los dos existen y un documento se mira en los dos,
 * porque el fallo de los desplegables en zigzag solo se veía en uno.
 */
function pagina(titulo, cuerpo, tema) {
  return `<!doctype html>
<html lang="es" data-theme="${tema}">
<head><meta charset="utf-8"><title>${titulo}</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 2rem; background: var(--bg, #f2efe9); display: grid; place-items: start center; }
  .papel { background: #fff; box-shadow: 0 1px 12px rgba(0,0,0,.12); }
</style>
</head>
<body><div class="papel">${cuerpo}</div></body>
</html>`
}

await mkdir(SALIDA, { recursive: true })
const hechos = []

async function pintar(nombre, elemento) {
  const marca = renderToStaticMarkup(elemento)
  // Los dos temas SIEMPRE. El nombre del atributo y los valores son los de
  // `src/lib/tema.ts` —`data-theme`, `light` y `dark`—: la primera versión de
  // esto puso `data-tema` con `claro`/`oscuro`, que no existe en ninguna parte,
  // y las dos capturas salían idénticas sin que nada avisara.
  for (const tema of ['light', 'dark']) {
    const f = join(SALIDA, `${nombre}-${tema}.html`)
    await writeFile(f, pagina(nombre, marca, tema))
    hechos.push(f)
  }
}

// --- Los datos de la hermandad de ejemplo, los de verdad.
const demo = await cargar('src/lib/demo.ts')
demo.sembrarDemoLlena()
const ajustes = await cargar('src/lib/hermandadSettings.ts')
const hermandad = ajustes.getHermandadSettings()

// ---------------------------------------------------------------- certificado
const cert = await cargar('src/components/CertificadoAntiguedad.tsx')
await pintar('certificado', createElement(cert.default, {
  hermandad,
  certificado: {
    id: 'c1',
    anio: 2027,
    numero: 14,
    hermanoNombre: 'María del Carmen Ruiz Delgado',
    hermanoDni: '28456789K',
    hermanoNumero: 312,
    antiguedad: 1998,
    aniosDeAntiguedad: 29,
    motivo: 'Acreditar antigüedad ante el Consejo de Cofradías',
    firmaSecretario: 'Ana Belén Ortiz Salas',
    firmaHermanoMayor: 'José Manuel Prieto Cano',
    emitidoPor: 'Ana Belén Ortiz Salas',
    fecha: '11 de septiembre de 2026',
  },
}))

/*
 * Y LOS DATOS DE LOS DEMÁS SALEN DE LOS DEL PROPIO EJEMPLO.
 *
 * `CUOTAS_INICIALES`, `MOVIMIENTOS_INICIALES` y `HERMANOS_INICIALES` son los
 * que enseña la demo, así que un documento pintado con ellos es el que va a ver
 * cualquiera que entre. Inventar datos aquí sería pintar un papel que no
 * existe, y además se queda viejo: el día que a una cuota le pongan un campo
 * nuevo, estos lo tienen y los inventados no.
 */
const datosCuotas = await cargar('src/data/cuotas.ts')
const datosMovs = await cargar('src/data/movimientos.ts')
const datosHermanos = await cargar('src/data/hermanos.ts')
const unaCuota = datosCuotas.CUOTAS_INICIALES.find((c) => c.estado === 'Pagada')
  ?? datosCuotas.CUOTAS_INICIALES[0]
const suHermano = datosHermanos.HERMANOS_INICIALES.find((h) => h.id === unaCuota.hermanoId)
  ?? datosHermanos.HERMANOS_INICIALES[0]

// ---------------------------------------------------------------------- recibo
const recibo = await cargar('src/components/Recibo.tsx')
await pintar('recibo', createElement(recibo.default, {
  hermandad, cuota: unaCuota, hermano: suHermano,
}))

// --------------------------------------------------------------- justificante
const justi = await cargar('src/components/MovimientoJustificante.tsx')
await pintar('justificante', createElement(justi.default, {
  hermandad, movimiento: datosMovs.MOVIMIENTOS_INICIALES[0],
}))

// ------------------------------------------------------------ estado de cuentas
const estado = await cargar('src/components/EstadoCuentas.tsx')
await pintar('estado-de-cuentas', createElement(estado.default, {
  hermandad,
  anio: 2026,
  movimientos: datosMovs.MOVIMIENTOS_INICIALES,
  saldoInicial: 12450.75,
  generadoEl: '11 de septiembre de 2026',
}))

// ---------------------------------------------------------------------- carné
const carne = await cargar('src/components/CarneHermano.tsx')
const censo = await cargar('src/lib/db/hermanos.ts').catch(() => null)
await pintar('carne', createElement(carne.default, {
  hermandadNombre: hermandad.nombreLegal || 'Hermandad de prueba',
  logo: hermandad.logoDataUrl,
  hermano: {
    id: 'h1',
    numero: 312,
    nombre: 'María del Carmen Ruiz Delgado',
    dni: '28456789K',
    email: 'mcarmen@ejemplo.es',
    telefono: '655 44 33 22',
    antiguedad: 1998,
    estado: 'Activo',
    fechaNacimiento: '1972-04-18',
    direccion: 'C/ Pureza 53',
    poblacion: 'Sevilla',
  },
}))

console.log(`${hechos.length} ficheros en ${SALIDA}:`)
for (const f of hechos) console.log('  ' + f)
