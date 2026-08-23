#!/usr/bin/env node
/**
 * IMPORTAR DE PUNTA A PUNTA, con los archivos de prueba de verdad.
 *
 *     node scripts/probar-importacion.mjs
 *
 * No es una prueba unitaria: es pasar los cuatro ficheros que se le dan a una
 * hermandad —censo, historial de cuotas, libro de caja e inventario, en CSV y
 * en XLSX— por exactamente el mismo camino que sigue el asistente: leer el
 * archivo, emparejar columnas, ensayar y aplicar. Y contar qué sale.
 *
 * POR QUÉ HACE FALTA ESTO Y NO BASTAN LAS PRUEBAS. Las pruebas comprueban cada
 * pieza con datos escritos a mano en la propia prueba. Lo que rompe de verdad
 * es otra cosa: una columna que en el fichero real se llama distinto, un Excel
 * cuyas fechas vienen como números, un separador que no es el que se esperaba.
 * Eso solo sale pasando los ficheros de verdad.
 *
 * Y sirve para contestar la pregunta que hace una hermandad antes de empezar:
 * «¿esto lee mi Excel?». La respuesta es lo que imprime este script.
 *
 * LO QUE NO COMPRUEBA: que lo importado llegue a Supabase. Eso depende de los
 * permisos de la base de datos de cada hermandad, no del código, y se ve en la
 * propia aplicación —si la escritura falla, sale un aviso rojo—. Aquí se
 * comprueba lo anterior: que el archivo se entiende.
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const salida = mkdtempSync(join(tmpdir(), 'imp-'))
async function cargar(ruta) {
  const destino = join(salida, ruta.replace(/[/.]/g, '_') + '.mjs')
  const res = await build({
    entryPoints: [ruta], bundle: true, format: 'esm', platform: 'node', write: false,
    alias: { '@supabase/supabase-js': 'pruebas/stub-supabase.mjs' },
    define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }) },
  })
  writeFileSync(destino, res.outputFiles[0].text)
  return import(destino)
}
globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 }

const tablas = await cargar('src/lib/tablasImportables.ts')
const motor = await cargar('src/lib/importarTabla.ts')
const leer = await cargar('src/lib/leerTabla.ts')
const censoMod = await cargar('src/lib/importar.ts')
const excel = await cargar('src/lib/leerExcel.ts')

/** Lee un fichero por su extensión, igual que hace el asistente. */
async function filasDe(ruta) {
  if (ruta.endsWith('.xlsx')) {
    const bytes = new Uint8Array(readFileSync(ruta))
    if (!excel.pareceXlsx(bytes)) throw new Error('no parece xlsx')
    return excel.leerXlsx(bytes)
  }
  return leer.leerCsv(readFileSync(ruta, 'utf8'))
}

// El censo de verdad: el mismo fichero de prueba que se le da a la hermandad,
// ya importado. Es lo que hace que el enlace por DNI del historial de cuotas
// signifique algo.
const censoTexto = readFileSync('docs/censo-de-prueba/censo-de-prueba.csv', 'utf8')
const censoFilas = leer.leerCsv(censoTexto)
const censoEnsayo = censoMod.ensayar(censoFilas, censoMod.proponerEmparejado(censoFilas[0]), [])
let nId = 0
const CENSO = censoMod.aplicar(censoEnsayo, [], { conLosQueYaEstan: 'anadir' }, () => `h-${nId += 1}`).censo

// Los catálogos DE FÁBRICA, no unos inventados: es lo que tiene delante una
// hermandad que acaba de darse de alta.
const movs = await cargar('src/data/movimientos.ts')
const enseresMod = await cargar('src/data/enseres.ts')
const CTX = {
  hermanos: CENSO,
  anioEnCurso: 2026,
  categoriasIngreso: [...movs.CATEGORIAS_INGRESO],
  categoriasGasto: [...movs.CATEGORIAS_GASTO],
  cuentas: ['Caja', 'Banco'],
  categoriasEnser: [...(enseresMod.CATEGORIAS_ENSER ?? [])],
}

const CASOS = [
  ['Historial de cuotas', tablas.TABLA_CUOTAS, 'docs/tablas-de-prueba/historial-de-cuotas-de-prueba.csv'],
  ['Historial de cuotas', tablas.TABLA_CUOTAS, 'docs/tablas-de-prueba/historial-de-cuotas-de-prueba.xlsx'],
  ['Libro de caja', tablas.TABLA_MOVIMIENTOS, 'docs/tablas-de-prueba/libro-de-caja-de-prueba.csv'],
  ['Libro de caja', tablas.TABLA_MOVIMIENTOS, 'docs/tablas-de-prueba/libro-de-caja-de-prueba.xlsx'],
  ['Inventario', tablas.TABLA_ENSERES, 'docs/tablas-de-prueba/inventario-de-prueba.csv'],
  ['Inventario', tablas.TABLA_ENSERES, 'docs/tablas-de-prueba/inventario-de-prueba.xlsx'],
]

for (const [nombre, tabla, ruta] of CASOS) {
  const filas = await filasDe(ruta)
  const cabeceras = filas[0]
  const emparejado = motor.proponerColumnas(tabla.campos, cabeceras)
  const faltan = motor.faltanColumnas(tabla.campos, emparejado).map((c) => c.etiqueta ?? c.id).join(', ')
  const ensayo = motor.ensayarTabla(filas, emparejado, [], tabla, CTX)
  const ok = ensayo.filas.filter((f) => f.problemas.length === 0)
  const mal = ensayo.filas.filter((f) => f.problemas.length > 0)
  const aplicado = motor.aplicarTabla(ensayo, [], tabla, { conLosQueYaEstan: 'anadir' }, () => `id-${Math.random()}`)
  console.log(`\n── ${nombre} (${ruta.split('/').pop()})`)
  console.log(`   columnas del archivo: ${cabeceras.length} · emparejadas: ${Object.values(emparejado).filter((v) => v !== null).length}`)
  console.log(`   faltan columnas obligatorias: ${faltan || 'ninguna'}`)
  console.log(`   filas leídas: ${ensayo.filas.length} · válidas: ${ok.length} · con error: ${mal.length} · nuevos: ${ensayo.nuevos}`)
  console.log(`   IMPORTADAS de verdad: ${aplicado.lista.length}`)
  if (mal.length) console.log(`   errores: ${[...new Set(mal.flatMap((f) => f.problemas))].join(' | ')}`)
  if (ensayo.avisos?.length) console.log(`   avisos: ${ensayo.avisos.join(' | ')}`)
}

// --- Y el censo, que va por su propio importador ---
for (const rutaCenso of ['docs/censo-de-prueba/censo-de-prueba.csv', 'docs/censo-de-prueba/censo-de-prueba.xlsx']) {
const filasCenso = await filasDe(rutaCenso)
const empCenso = censoMod.proponerEmparejado(filasCenso[0])
const ensayoCenso = censoMod.ensayar(filasCenso, empCenso, [])
const okC = ensayoCenso.filas.filter((f) => f.problemas.length === 0)
const malC = ensayoCenso.filas.filter((f) => f.problemas.length > 0)
console.log(`\n── Censo (${rutaCenso.split('/').pop()})`)
console.log(`   filas leídas: ${ensayoCenso.filas.length} · válidas: ${okC.length} · con error: ${malC.length}`)
if (malC.length) console.log(`   errores: ${[...new Set(malC.flatMap((f) => f.problemas))].join(' | ')}`)
const aplicadoC = censoMod.aplicar(ensayoCenso, [], { conLosQueYaEstan: 'anadir' }, () => `id-${Math.random()}`)
console.log(`   IMPORTADOS de verdad: ${aplicadoC.censo.length}`)
}
