#!/usr/bin/env bash
#
# ROMPER A PROPÓSITO, PARA VER SI EL GUARDIA SALTA.
#
# Una prueba que no ha fallado nunca no es una prueba: es un comentario con
# sintaxis. Ha pasado dos veces en este proyecto —un guardia escrito, en verde,
# que NO saltaba al romper justo lo que vigilaba— y por eso la fase 2 del plan
# de bugs pide esto: romper a propósito cada guardia nuevo antes de darlo por
# bueno. El plan nombraba este script como si existiera; ahora existe.
#
# CÓMO SE USA
#
#   scripts/romper.sh "lo que voy a romper" <orden que lo rompe>
#
#   # con sed, para un cambio de una línea
#   scripts/romper.sh "el aviso ya no dice el importe" \
#     sed -i 's/formatCurrency(sobra)/0/' src/pages/app/Campanas.tsx
#
#   # con un guion aparte, para algo más largo
#   scripts/romper.sh "vuelve la herencia del contacto" /tmp/rompe-contacto.sh
#
# QUÉ HACE, EN ORDEN
#
#   1. Guarda TODOS los ficheros que lleva git (no solo unas carpetas: la
#      primera versión de esto respaldaba `src pruebas scripts supabase` a mano
#      y se dejaba fuera `api/`, así que una rotura ahí había que deshacerla a
#      mano y con suerte).
#   2. Aplica la rotura.
#   3. Regenera lo que se genera (el SQL de una pieza y el de actualizar), que
#      si no la rotura se nota donde no toca.
#   4. Corre las pruebas y enseña las que fallan.
#   5. Deja el árbol como estaba. También si la rotura falla, también si las
#      pruebas se cuelgan y se corta con Ctrl-C: el respaldo se restaura desde
#      un `trap`, no desde la última línea.
#
# LO QUE DEVUELVE, Y ES LO IMPORTANTE
#
#   0  si algo ha fallado  → el guardia salta, la prueba sirve.
#   1  si todo sigue verde → EL GUARDIA NO SALTA. Es la respuesta que hay que
#      buscar y la que hay que arreglar: la prueba está escrita pero no vigila.
#   2  si no puede responder (no hay repositorio, o la rotura es de `supabase/`
#      y no hay un Postgres al lado para comprobar el SQL).
#
# Está al revés que un programa normal a propósito: aquí la buena noticia es
# que se rompa. Así se puede encadenar con `&&` sin pensarlo.
#
# CON LA BASE DE DATOS DELANTE, si la rotura toca el SQL:
#
#   PGHOST=/tmp PGPORT=5433 GOBERGO_PG_OBLIGATORIO=1 scripts/romper.sh "…" …
#
# Sin eso, las ~550 pruebas del SQL se saltan EN VERDE y la respuesta sería
# «no salta» sin haber mirado nada.
#
set -uo pipefail

if [ "$#" -lt 2 ]; then
  echo "uso: scripts/romper.sh \"qué se rompe\" <orden que lo rompe>" >&2
  exit 2
fi

DESC="$1"; shift

RAIZ=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "romper.sh: esto tiene que ser un repositorio de git — es de donde sale el respaldo." >&2
  exit 2
}
cd "$RAIZ" || exit 2

# Las pruebas se pueden cambiar por otra orden. Sirve para probar ESTE script
# sin correr las 5.000 pruebas dentro de sí mismo (ver pruebas/romper.prueba.mjs).
PRUEBAS=${PRUEBAS:-node pruebas/correr.mjs}

RESPALDO=$(mktemp -d) || exit 2
# Todo lo que lleva git, con los nombres separados por cero: hay ficheros con
# espacios y con acentos, y una lista partida por espacios se los come.
git ls-files -z | tar --null -T - -cf "$RESPALDO/arbol.tar" || {
  echo "romper.sh: no se ha podido respaldar el árbol; no se rompe nada." >&2
  rm -rf "$RESPALDO"
  exit 2
}

restaurar() {
  tar -xf "$RESPALDO/arbol.tar" -C "$RAIZ"
  rm -rf "$RESPALDO"
}

# LO QUE GIT NO LLEVA NO SE RESPALDA, y por tanto no se restaura. Un fichero
# nuevo sin `git add` que la rotura toque —o que los generadores reescriban—
# se queda como lo dejen. Pasó: la prueba de una rotura corrió con un módulo
# nuevo roto de la rotura anterior, y su respuesta no valía. Se avisa antes.
SUELTOS=$(git ls-files --others --exclude-standard | grep -v '^dist/' || true)
if [ -n "$SUELTOS" ]; then
  echo "romper.sh: aviso — estos ficheros no los lleva git y NO se van a restaurar si la rotura o los generadores los tocan:" >&2
  echo "$SUELTOS" | sed 's/^/    /' >&2
  echo "  (haz git add de lo que sea nuevo antes de romper nada)" >&2
fi
# Pase lo que pase: rotura que falla, pruebas que se cuelgan, Ctrl-C.
trap restaurar EXIT
trap 'exit 130' INT TERM

# La rotura. Si falla, no se para: a veces se rompe con un `sed` que no
# encuentra nada, y eso también hay que verlo —sale en verde y ya se sabe que
# la rotura no se aplicó.
"$@" || echo "romper.sh: la orden de romper ha devuelto error; se sigue para ver qué dicen las pruebas." >&2

# Lo generado se regenera: si no, romper una pieza de SQL hace fallar la prueba
# de que el fichero de una pieza está al día, y eso tapa lo que se buscaba.
node scripts/generar-actualizar.mjs >/dev/null 2>&1
node scripts/generar-todo-en-uno.mjs >/dev/null 2>&1

SALIDA=$(eval "$PRUEBAS" 2>&1)

echo "### $DESC"

# ¿HA CORRIDO LA SUITE ENTERA? Sin un Postgres al lado, las pruebas del SQL se
# saltan EN VERDE y son unas quinientas cincuenta: romper algo de `supabase/`
# daría «no salta» sin haberlo mirado, que es la respuesta más engañosa que
# puede dar esta herramienta. La propia suite lo dice en su salida, así que se
# le hace caso.
# (Sin tuberías con `grep -q`: con `pipefail`, grep cierra la tubería al
# primer acierto, `echo` muere de SIGPIPE y la condición sale FALSA justo
# cuando acierta. Este aviso no salió ni una vez por eso.)
case "$SALIDA" in *'SIN POSTGRES'*) SIN_SQL=1 ;; *) SIN_SQL=0 ;; esac
if [ "$SIN_SQL" = 1 ]; then
  if [ -z "$(git status --porcelain -- supabase/)" ]; then
    echo "    (aviso: sin un Postgres al lado no se han comprobado las ~550 pruebas del SQL;"
    echo "     para esta rotura no hace falta, pero para una de supabase/ sí)"
  else
    echo "    LA ROTURA ES DE supabase/ Y EL SQL NO SE HA COMPROBADO."
    echo "    Sin un Postgres al lado esas pruebas se saltan en verde, así que esto"
    echo "    no puede decir ni que salta ni que no. Arranca uno y vuelve:"
    echo "      PGHOST=/tmp PGPORT=5433 GOBERGO_PG_OBLIGATORIO=1 scripts/romper.sh …"
    exit 2
  fi
fi
FALLOS=$(echo "$SALIDA" | grep '✗' || true)
if [ -n "$FALLOS" ]; then
  echo "$FALLOS" | sed 's/^/    /' | head -20
  CUANTOS=$(echo "$FALLOS" | wc -l | tr -d ' ')
  echo "$SALIDA" | tail -1
  echo "→ salta: $CUANTOS comprobación(es) fallan al romper esto."
  exit 0
fi

echo "$SALIDA" | tail -1
echo "→ NO SALTA: se ha roto «$DESC» y todo sigue en verde."
echo "  La prueba que debería vigilar esto está escrita pero no vigila nada."
exit 1
