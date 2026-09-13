/**
 * LA HERRAMIENTA DE ROMPER A PROPÓSITO.
 *
 * La fase 2 del plan de bugs pide romper cada guardia nuevo antes de darlo por
 * bueno —ya ha pasado dos veces que un guardia mío no saltaba al romper lo que
 * vigilaba— y nombraba `romper.sh` como si existiera. No existía en el
 * repositorio: vivía en un directorio temporal fuera del proyecto, así que en
 * otras manos no estaba. Ahora es `scripts/romper.sh`.
 *
 * ESTO SE EJECUTA, NO SE LEE: se llama al script de verdad y se mira qué
 * devuelve y cómo deja el árbol.
 *
 * PERO NO SOBRE ESTE REPOSITORIO. Se le monta un repositorio de mentira en un
 * directorio temporal, con sus ficheros, y se le suelta ahí (el script se
 * coloca solo en la raíz del repositorio que encuentre). La primera versión de
 * esta prueba lo llamaba sobre el proyecto de verdad y era un problema de los
 * que cuesta ver: `romper.sh` respalda y restaura TODO el árbol y regenera el
 * SQL, así que al correr la suite dentro de él estas comprobaciones andaban
 * tocando ficheros por debajo de las otras cinco mil. Se notó en la cuenta:
 * 4.744 pruebas en vez de 5.298.
 *
 * Y la orden de las pruebas se sustituye con `PRUEBAS` —que el script lee
 * justo para esto— porque si no, cada comprobación de aquí correría la suite
 * entera dentro de sí misma.
 *
 * LO QUE IMPORTA de esta herramienta es que devuelve AL REVÉS que un programa
 * normal: 0 cuando algo se rompe (el guardia salta) y 1 cuando todo sigue
 * verde (el guardia no vigila nada). Si eso se invirtiera, «romper» diría que
 * todo va bien justamente cuando la prueba es un comentario.
 */
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const correr = promisify(execFile)
const AQUI = process.cwd()

/**
 * Un repositorio de mentira con dos ficheros dentro de git. Uno va en `api/`
 * a propósito: la primera versión de `romper.sh` respaldaba a mano `src
 * pruebas scripts supabase` y se dejaba fuera `api/`, así que una rotura ahí
 * había que deshacerla a mano y con suerte. Ahora respalda lo que lleva git,
 * y esto es lo que lo comprueba.
 */
function repoDeMentira() {
  const raiz = mkdtempSync(join(tmpdir(), 'romper-'))
  mkdirSync(join(raiz, 'api'))
  writeFileSync(join(raiz, 'fichero.txt'), 'INTACTO\n')
  writeFileSync(join(raiz, 'api/w.ts'), 'export const intacto = true\n')
  return raiz
}

const CON_FALLO = '  ✗ una comprobación que sí vigila\\n  ✗ y otra\\n5279/5281 pruebas pasan\\n'
const TODO_VERDE = '5281/5281 pruebas pasan\\n'

export default async function ({ caso }) {
  const raiz = mkdtempSync(join(tmpdir(), 'romper-'))
  rmSync(raiz, { recursive: true, force: true })

  /** Llama a romper.sh de verdad, dentro de un repositorio de mentira nuevo. */
  async function romper(desc, orden, salidaDeMentira) {
    const dir = repoDeMentira()
    try {
      await correr('git', ['init', '-q'], { cwd: dir })
      await correr('git', ['add', '.'], { cwd: dir })
      const opciones = {
        cwd: dir,
        env: { ...process.env, PRUEBAS: `printf ${JSON.stringify(salidaDeMentira)}` },
        timeout: 60_000,
      }
      let codigo = 0
      let texto = ''
      try {
        const r = await correr(join(AQUI, 'scripts/romper.sh'), [desc, ...orden], opciones)
        // Los dos chorros: los avisos del script («la rotura ha dado error»)
        // van por el de error, que es donde tienen que ir, y hay que mirarlos.
        texto = r.stdout + r.stderr
      } catch (e) {
        codigo = e.code ?? -1
        texto = (e.stdout ?? '') + (e.stderr ?? '')
      }
      return {
        codigo,
        texto,
        fichero: readFileSync(join(dir, 'fichero.txt'), 'utf8'),
        api: readFileSync(join(dir, 'api/w.ts'), 'utf8'),
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  /** Rompe el fichero de verdad: cambia INTACTO por ROTO. */
  const ROTURA = ['sed', '-i', 's/INTACTO/ROTO/', 'fichero.txt']

  /* 1. SE ROMPE Y ALGO FALLA → devuelve 0. El guardia salta. */
  {
    const r = await romper('el fichero dice ROTO', ROTURA, CON_FALLO)
    caso('si algo falla al romper, devuelve 0', 0, r.codigo)
    caso('y lo dice con todas las letras', true, r.texto.includes('→ salta'))
    caso('enseñando cuántas comprobaciones fallan', true, /2 comprobación/.test(r.texto))
    caso('y cuáles', true, r.texto.includes('una comprobación que sí vigila'))
    caso('con la descripción delante, para saber de qué rotura se habla', true,
      r.texto.includes('### el fichero dice ROTO'))
    // Y LO PRINCIPAL: el árbol queda como estaba.
    caso('el árbol se restaura', 'INTACTO\n', r.fichero)
  }

  /*
   * 2. SE ROMPE Y NADA FALLA → devuelve 1. Es el caso que hay que cazar: la
   *    prueba está escrita y no vigila nada.
   */
  {
    const r = await romper('el fichero dice ROTO', ROTURA, TODO_VERDE)
    caso('si todo sigue verde al romper, devuelve 1', 1, r.codigo)
    caso('y avisa de que el guardia no salta', true, r.texto.includes('NO SALTA'))
    caso('explicando qué significa', true, r.texto.includes('no vigila nada'))
    caso('y restaura igualmente', 'INTACTO\n', r.fichero)
  }

  /*
   * 3. LA ROTURA FALLA → se restaura de todas formas.
   *
   * Aquí es donde se pierde el trabajo si esto está mal hecho: un guion de
   * romper con una errata dejaba el árbol a medio romper y sin respaldo.
   */
  {
    const r = await romper('una rotura que no se aplica', ['false'], CON_FALLO)
    caso('una rotura que falla no impide correr las pruebas', 0, r.codigo)
    caso('y se avisa de que la rotura ha dado error', true, r.texto.includes('devuelto error'))
    caso('y el árbol sigue intacto', 'INTACTO\n', r.fichero)
  }

  /* 4. RESPALDA TODO LO QUE LLEVA GIT, no unas carpetas a mano: también api/. */
  {
    const enApi = ['sh', '-c', "printf '// roto a proposito\\n' >> api/w.ts"]
    const r = await romper('una rotura en api/', enApi, CON_FALLO)
    caso('rompiendo en api/ también devuelve 0', 0, r.codigo)
    caso('y api/ se restaura: se respaldó', 'export const intacto = true\n', r.api)
  }

  /*
   * 5. SIN ARGUMENTOS NO HACE NADA.
   *
   * `romper.sh` sin la orden de romper correría las pruebas y diría «no
   * salta» de algo que no se ha tocado: una respuesta falsa. Se para antes.
   */
  {
    const r = await romper('solo la descripción', [], TODO_VERDE)
    caso('sin orden que rompa, no se corre nada', 2, r.codigo)
    caso('y se explica cómo se usa', true, r.texto.includes('uso: scripts/romper.sh'))
  }

  /*
   * 6. Y FUERA DE UN REPOSITORIO NO SE ROMPE NADA.
   *
   * El respaldo sale de git. Sin git no hay respaldo, y romper sin respaldo es
   * perder el trabajo: se para y lo dice.
   */
  {
    const suelto = mkdtempSync(join(tmpdir(), 'sin-git-'))
    writeFileSync(join(suelto, 'fichero.txt'), 'INTACTO\n')
    let codigo = 0
    let texto = ''
    try {
      // `git` mira hacia arriba, así que se le dice que no salga de aquí.
      await correr(join(AQUI, 'scripts/romper.sh'), ['sin git', 'true'], {
        cwd: suelto,
        env: { ...process.env, PRUEBAS: 'true', GIT_CEILING_DIRECTORIES: suelto },
        timeout: 30_000,
      })
    } catch (e) {
      codigo = e.code ?? -1
      texto = (e.stdout ?? '') + (e.stderr ?? '')
    }
    caso('fuera de un repositorio se niega', 2, codigo)
    caso('y dice por qué', true, texto.includes('repositorio de git'))
    rmSync(suelto, { recursive: true, force: true })
  }
}
