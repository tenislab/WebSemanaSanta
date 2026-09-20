#!/usr/bin/env bash
#
# A/B ALTERNADO, tres pasadas por lado.
#
# Una sola medición por lado no vale: el `ms/tecla` oscila ±40 % entre pasadas
# en esta máquina, y con eso se puede «demostrar» cualquier cosa. Se alternan
# los lados (A B A B A B) para que una máquina que se va calentando o
# enfriando no se cuele como si fuera el cambio.
set -uo pipefail
cd /home/user/WebSemanaSanta
OUT=/tmp/claude-0/ab.txt
: > "$OUT"

guardar () { git stash push -u -q -m "ab-medicion" >/dev/null 2>&1 && echo si || echo no; }
volver ()  { git stash pop -q >/dev/null 2>&1 && echo si || echo no; }

pasada () {
  local lado="$1"
  npm run build > /tmp/claude-0/ab-build.log 2>&1
  node scripts/caza/cronometro.mjs 2>/dev/null \
    | grep -E "Hermanos|Cuotas|Papeletas|Tesorería" \
    | sed "s/^/$lado /" >> "$OUT"
}

for vuelta in 1 2 3; do
  echo "# vuelta $vuelta — ANTES (sin los cambios)" >> "$OUT"
  echo "guardando cambios: $(guardar)"
  pasada "ANTES  "
  echo "devolviendo cambios: $(volver)"
  echo "# vuelta $vuelta — DESPUES (con los cambios)" >> "$OUT"
  pasada "DESPUES"
done

echo; echo "=================== RESUMEN (ms por tecla)"
python3 - <<'PY'
import re, statistics
filas = {}
for l in open('/tmp/claude-0/ab.txt'):
    m = re.match(r'(ANTES|DESPUES)\s+(\d+) ms\s+(\d+) ms/tecla.*?(Hermanos|Cuotas|Papeletas|Tesorería)', l.strip())
    if not m: continue
    lado, pintar, tecla, pant = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
    filas.setdefault((pant, lado), []).append((pintar, tecla))
print(f'{"pantalla":12} {"lado":8} {"pintar (mediana)":>18} {"tecla (mediana)":>17}   muestras')
for pant in ['Hermanos', 'Cuotas', 'Papeletas', 'Tesorería']:
    for lado in ['ANTES', 'DESPUES']:
        v = filas.get((pant, lado))
        if not v: continue
        pin = statistics.median(x[0] for x in v)
        tec = statistics.median(x[1] for x in v)
        crudos = ' '.join(str(x[1]) for x in v)
        print(f'{pant:12} {lado:8} {pin:>15.0f} ms {tec:>14.0f} ms   [{crudos}]')
PY
