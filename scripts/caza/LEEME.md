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
