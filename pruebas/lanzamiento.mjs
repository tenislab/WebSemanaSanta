#!/usr/bin/env node
/**
 * Comprobación previa al lanzamiento.
 *
 *   node pruebas/lanzamiento.mjs
 *
 * No sustituye a las pruebas: mira las cosas que solo se notan el día que se
 * pone en producción y que no da tiempo a arreglar con la hermandad delante.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'

const fallos = []
const avisos = []
const bien = []

function comprobar(nombre, condicion, comoSeArregla, grave = true) {
  if (condicion) bien.push(nombre)
  else (grave ? fallos : avisos).push(`${nombre}\n     → ${comoSeArregla}`)
}

const leer = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '')

// --- 1. Que no se escape ninguna clave en el repositorio ---
const env = leer('.env')
comprobar(
  'El .env no está en el repositorio',
  !existsSync('.git') || !readFileSync('.gitignore', 'utf8').split('\n').every((l) => l.trim() !== '.env'),
  'Añade «.env» al .gitignore. Si ya se subió, rota las claves en Supabase.',
)
/**
 * Una clave de servicio DE VERDAD, no la palabra suelta: los comentarios que
 * avisan de «no pongas aquí la service_role» decían la palabra y hacían saltar
 * la comprobación, que es justo lo contrario de lo que se quiere.
 *
 * Un token de Supabase es un JWT en tres partes; el `role` va en la segunda,
 * codificada en base64. Se decodifica y se mira ahí.
 */
function tieneClaveDeServicio(texto) {
  for (const jwt of texto.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
    try {
      const carga = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
      if (carga.role && carga.role !== 'anon') return true
    } catch {
      // Un token que no se puede leer no es una clave nuestra.
    }
  }
  return false
}

const fuentes = readdirSync('src', { recursive: true })
  .filter((f) => /\.(ts|tsx)$/.test(String(f)))
  .map((f) => leer(`src/${f}`))
comprobar(
  'No hay ninguna clave de servicio en el código',
  !tieneClaveDeServicio(env) && !fuentes.some(tieneClaveDeServicio),
  'La clave service_role NUNCA va en el navegador: da acceso total saltándose las políticas.',
)

// --- 2. Que el despliegue sepa qué hacer ---
const vercel = leer('vercel.json')
comprobar('vercel.json existe', vercel !== '', 'Sin él, al recargar en /app/hermanos sale un 404.')
comprobar(
  'Las rutas internas caen en index.html',
  /"destination":\s*"\/index\.html"/.test(vercel),
  'Falta la regla comodín «/(.*)» → /index.html en vercel.json.',
)
comprobar(
  'La web pública pasa por la función que pone las etiquetas',
  /\/api\/w/.test(vercel),
  'Sin esto, al pegar el enlace en WhatsApp la vista previa sale genérica.',
)
comprobar('El sitemap y el robots están enrutados', /\/api\/seo/.test(vercel), 'Google no encontrará el sitemap.')

// --- 3. Los archivos SQL, en el orden que hay que ejecutarlos ---
const SQL = [
  'schema.sql', 'rls-cargos.sql', 'rls-endurecer.sql',
  'hermano-auth.sql', 'web-publica.sql', 'mensajes-web.sql', 'storage-archivo.sql',
]
SQL.forEach((f) => comprobar(`supabase/${f}`, existsSync(`supabase/${f}`), 'Falta el archivo; sin él, esa parte no funciona.'))
comprobar(
  'rls-endurecer.sql sigue siendo obligatorio',
  /obligatorio/i.test(leer('supabase/rls-endurecer.sql')) || /endurecer/i.test(leer('README.md')),
  'Sin ejecutarlo, cualquiera que se registre obtiene acceso de escritura a toda la base.',
)

// --- 4. Lo legal, que es lo que puede costar dinero ---
const legal = leer('src/data/legal.ts')
comprobar('Aviso legal', /slug: 'aviso-legal'/.test(legal), 'Es obligatorio para un servicio en internet.')
comprobar('Política de privacidad', /slug: 'privacidad'/.test(legal), 'Obligatoria: se tratan datos personales.')
comprobar('Condiciones de uso', /slug: 'condiciones'/.test(legal), 'Definen qué se contrata y con qué límites.')
comprobar(
  'Se dice quién es responsable y quién encargado',
  /encargada? del tratamiento/i.test(legal),
  'La hermandad es la responsable; Cabildo, la encargada. Tiene que estar escrito.',
)
comprobar(
  'Se reconoce que el censo es dato de categoría especial',
  /categor[íi]a especial|art[íi]culo 9/i.test(legal),
  'Pertenecer a una hermandad revela convicciones religiosas: es dato especial del art. 9 del RGPD y exige más garantías.',
)
comprobar(
  'Existe el contrato de encargo de tratamiento',
  existsSync('docs/CONTRATO-ENCARGO.md'),
  'El art. 28 del RGPD lo exige POR ESCRITO entre la hermandad y Cabildo. Sin él, la hermandad está incumpliendo.',
)

// --- 5. Que quede claro qué falta por conectar ---
comprobar('Guía de conexión', existsSync('docs/CONECTAR.md'), 'Sin ella, nadie sabe qué contratar ni en qué orden.')
comprobar('Guía de lanzamiento', existsSync('docs/LANZAMIENTO.md'), 'El paso a paso del día del despliegue.')
comprobar(
  'Análisis honesto del estado',
  existsSync('docs/ESTA-PARA-SALIR.md'),
  'Conviene tener escrito qué falta, para no prometer de más.', false,
)

// --- Resultado ---
console.log(`\n✓ ${bien.length} comprobaciones pasadas.`)
if (avisos.length) {
  console.log(`\n⚠  ${avisos.length} aviso(s):`)
  avisos.forEach((a) => console.log(`   · ${a}`))
}
if (fallos.length) {
  console.log(`\n✗ ${fallos.length} cosa(s) que hay que resolver ANTES de lanzar:`)
  fallos.forEach((f) => console.log(`   · ${f}`))
  process.exit(1)
}
console.log('\nListo para desplegar. Sigue docs/LANZAMIENTO.md.\n')
