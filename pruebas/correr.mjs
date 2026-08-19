/**
 * Corredor de pruebas mínimo, sin dependencias nuevas: compila cada módulo de
 * `src/lib` o `src/data` con el esbuild que ya trae Vite y ejecuta los
 * ficheros `*.prueba.mjs` de esta carpeta.
 *
 *   npm test
 *
 * No pretende ser un framework: son las funciones puras que mueven dinero,
 * fechas y sitios en el cortejo, que son las que no se pueden probar a ojo.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { writeFileSync, mkdtempSync } from 'node:fs'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = join(aqui, '..')
const salida = mkdtempSync(join(tmpdir(), 'cabildo-pruebas-'))

/** Compila un módulo del proyecto y lo devuelve importado. */
export async function cargar(ruta) {
  const destino = join(salida, ruta.replace(/[\/.]/g, '_') + '.mjs')
  const res = await build({
    entryPoints: [join(raiz, ruta)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    // Supabase no hace falta para las funciones puras, y `import.meta.env` es
    // cosa de Vite: aquí no existe.
    alias: { '@supabase/supabase-js': join(aqui, 'stub-supabase.mjs') },
    define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }) },
  })
  writeFileSync(destino, res.outputFiles[0].text)
  return import(destino)
}

let total = 0
let fallos = 0

export function caso(nombre, esperado, real) {
  total += 1
  const ok = JSON.stringify(esperado) === JSON.stringify(real)
  if (!ok) {
    fallos += 1
    console.log(`  ✗ ${nombre}`)
    console.log(`      esperado: ${JSON.stringify(esperado)}`)
    console.log(`      real    : ${JSON.stringify(real)}`)
  } else {
    console.log(`  ✓ ${nombre}`)
  }
}

const ficheros = readdirSync(aqui).filter((f) => f.endsWith('.prueba.mjs')).sort()
for (const f of ficheros) {
  console.log(`\n── ${f.replace('.prueba.mjs', '')} ──`)
  const mod = await import(join(aqui, f))
  await mod.default({ cargar, caso })
}

console.log(`\n${total - fallos}/${total} pruebas pasan`)
if (fallos > 0) process.exit(1)
