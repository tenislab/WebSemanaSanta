# Las tres sondas del barrido

Tres guiones que **miden** lo que no se ve leyendo el código. Están aquí y no en
`/tmp` porque un hallazgo sin la forma de volver a medirlo no se puede
comprobar, y porque el mes que viene nadie se va a acordar de cómo se sacaron
los números de `docs/CAZA-DE-BUGS-2026-09-19.md`.

Los tres necesitan la aplicación **construida y servida**:

```bash
npm run build
npx vite preview --port 4173 --host 127.0.0.1 &
```

## `cronometro.mjs`

Siembra 800 hermanos, tres ejercicios de recibos y 3.000 apuntes —una hermandad
grande de verdad— y cronometra, pantalla a pantalla, lo que tarda en pintarse y
**lo que tarda en responder a una tecla del buscador**. Lo segundo es lo que se
nota: abrir en dos segundos se perdona, un cuarto de segundo por letra no.

```bash
node scripts/caza/cronometro.mjs
```

## `desbordes-y-contrastes.mjs`

Quince pantallas × móvil claro, móvil oscuro y escritorio oscuro. Mide si la
página se puede arrastrar de lado, **qué elemento concreto sobresale** —no
«algo se desborda»— y el contraste de cada texto contra el fondo que tiene
detrás de verdad, resuelto por el navegador.

Dos cosas que hay que saber de cómo mide, porque la primera versión se
autoengañó: `getComputedStyle` devuelve unos colores de 0 a 255 (`rgb(…)`) y
otros de 0 a 1 (`color(srgb …)`), y tratarlos igual da 1,00:1 contra cualquier
fondo; y un texto sobre una **foto** no se juzga, se salta.

```bash
node scripts/caza/desbordes-y-contrastes.mjs
```

## `ab.sh`

Mide un cambio de rendimiento **comparándolo contra el código sin el cambio**:
guarda lo que hay sin comprometer (`git stash -u`), construye, mide, lo
devuelve, construye, mide — y repite tres vueltas ALTERNANDO los lados.

Lo de alternar no es adorno. En esta máquina el `ms/tecla` oscila un ±40 %
entre pasadas de la misma versión: con una muestra por lado se puede
«demostrar» cualquier cosa, incluidas las dos contrarias. El primer «después»
que medí daba 304 → 153 ms y la mediana honesta era 179 → 60.

```bash
scripts/caza/ab.sh          # el resumen sale con medianas y muestras crudas
```

Deja el desglose en `/tmp/claude-0/ab.txt`. Al acabar hay que comprobar que el
árbol está como estaba: hace `stash` y `pop` seis veces.

## `ver-paginador.mjs`

Siembra una hermandad grande y enseña qué dice el paginador de cada tabla,
cuántas filas quedan en el DOM y cuántos nodos. Y lo prueba: salta a otra
página, pulsa «Ver todas» y vuelve.

```bash
node scripts/caza/ver-paginador.mjs     # deja las capturas en /tmp/claude-0/fotos-paginador
```

## `botones.mjs`

Pulsa los botones visibles de diecisiete pantallas y anota si la pantalla se
cae, si salta un error en la consola o si el botón **no cambia nada**.

Deja fuera por su texto lo que destruye datos o abre un diálogo del sistema
(borrar, enviar, imprimir, descargar…) y **recarga antes de cada pulsación**.
Eso último no es por limpieza: la primera versión guardaba los botones en una
variable y pulsaba por índice, y en cuanto uno repintaba la pantalla los
guardados quedaban desprendidos del documento. Pulsar un nodo desprendido no
hace nada, así que daba «no hace nada» en nueve botones que funcionan
perfectamente.

```bash
node scripts/caza/botones.mjs
```

Y al leer lo que saca: un filtro **ya activo** no cambia nada al pulsarlo, y un
`submit` con un campo obligatorio vacío tampoco —el navegador enseña su globo, y
eso no se ve desde aquí—. Los dos son normales.
