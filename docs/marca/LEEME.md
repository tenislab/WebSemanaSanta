# La marca

El logotipo de Gobergo: una orla de filigrana en oro con la **G**, el **farol
encendido** y la **cruz** de remate, con las hojas granates alrededor.

## Los archivos

| Archivo | Qué es |
|---|---|
| `gobergo-original.webp` | El original tal cual llegó, con su fondo hueso. **De aquí sale todo lo demás.** |
| `marca-completa.png` | La orla entera, recortada y con el fondo quitado. Resolución completa. |
| `marca-reducida.png` | La misma marca **sin la orla**: la G con su farol. Resolución completa. |

En la aplicación se usan las versiones ligeras (`.webp`), en
`src/assets/gobergo-marca.webp` y `src/assets/gobergo-marca-reducida.webp`.

## Por qué hay dos versiones

A 96 píxeles la orla es una preciosidad. A 32 —la pestaña del navegador, la
cabecera del panel, el membrete de un recibo— se convierte en **una mancha
dorada** donde no se distingue nada. No es un defecto del dibujo: le pasa a
cualquier marca ceremonial, y por eso las casas serias tienen una versión
reducida.

La reducida es **la misma marca** sin la orla. Se lee a 24 píxeles y sigue
siendo reconocible a 16.

**No hay que elegir a mano.** Se pide siempre `<LogoMark size={…} />` y el
componente decide: de 56 píxeles para arriba, la completa; por debajo, la
reducida. Se puede forzar con `variante="completa"` o `"reducida"` para los
casos raros.

Dónde sale la completa hoy: el lacre del área del hermano (64 px) y la pantalla
de suscripción (64 px). En todo lo demás —cabeceras, recibos, papeletas, web
pública— manda la reducida, que es lo correcto.

## El icono de la pestaña

Sale de la reducida, sobre una **baldosa color hueso** con las esquinas
redondeadas: la marca es oro y granate, y suelta sobre una pestaña oscura el
farol se pierde. Con la baldosa detrás se lee igual en clara y en oscura, que
es lo único que importa en 16 píxeles.

Se regenera con:

```
node scripts/generar-favicon.mjs
```

Eso reescribe `public/favicon-32.png`, `public/favicon-48.png`,
`public/apple-touch-icon.png` y las etiquetas de `index.html`. Hay una prueba
que comprueba que están al día, así que no se pueden despegar del logo.

Al cambiar el dibujo hay que **subir `VERSION_ICONO`** en ese script: la caché
de iconos de Chrome no se va ni recargando con Ctrl+F5, y sin cambiar la
dirección un logo nuevo tarda días en verse.

## Los colores

En `src/lib/marca.ts`, con nombre y en un solo sitio:

| | |
|---|---|
| Granate `#7B1520` | El hábito. Es el color de la cabecera y el de la barra del navegador en el móvil. |
| Oro `#C9A55C` | La orfebrería: la orla, la G y el farol. |
| Hueso `#F7F1E4` | El papel. Es el fondo de la baldosa del icono. |

## Si algún día cambia el logo

1. Deja el original nuevo en `docs/marca/gobergo-original.webp`.
2. Vuelve a sacar `marca-completa.png` y `marca-reducida.png` (fondo quitado,
   recortadas y cuadradas), y las dos `.webp` de `src/assets/`.
3. `node scripts/generar-favicon.mjs`, subiendo antes `VERSION_ICONO`.
4. `npm test`: la prueba de la marca dice si ha quedado algo despegado.
