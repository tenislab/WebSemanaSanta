# La web pública: análisis y fases

Estado a agosto de 2026, tras el rediseño del editor. Este documento mira solo
la **web pública de la hermandad** (`/w/:slug`) y su editor: qué tiene, qué le
falta para parecerse a la web de una hermandad de verdad, y en qué orden
conviene hacerlo.

---

## Lo que ya hay

Ocho secciones (Historia, Titulares, Cultos, Galería, Actualidad, Páginas,
Boletines, Contacto), ocho estilos completos de un clic, cinco plantillas,
paletas y parejas tipográficas, cabecera y pie configurables, mapa incrustado,
vista previa a tamaño real, y un editor con raíl de secciones, deshacer y
barra de progreso. La web no desborda a 1600, 1280, 1000 ni 390 px, y los
ocho estilos están comprobados en la web publicada.

Es una **base sólida**. Lo que sigue es lo que le falta.

---

## El problema gordo: hoy la web no se puede compartir

Es lo primero que hay que entender, porque condiciona el orden de todo.

La web es una aplicación de una sola página. El título, la descripción y la
imagen se ponen **desde el navegador**, con JavaScript, cuando la página ya se
ha cargado. Pero **WhatsApp, Facebook, X y buena parte de los rastreadores no
ejecutan JavaScript**: piden el HTML y leen lo que hay.

Y lo que hay hoy es esto:

```
$ curl https://…/w/mi-hermandad
<title>Cabildo — Software para gestionar tu hermandad</title>
<meta name="description" content="Cabildo — el software para gestionar tu
hermandad o cofradía: hermanos, cuotas, papeletas de sitio…">
```

Cero contenido de la hermandad.

**Consecuencia práctica:** si el hermano mayor pega el enlace de su web en el
grupo de WhatsApp de la hermandad, la vista previa dice *«Cabildo — Software
para gestionar tu hermandad»*. Y Google, si llega a indexarla, indexa eso.

La pestaña «Al compartir» del editor deja escribir un título y una
descripción preciosos… que hoy solo ve quien ya está dentro de la página.

Esto **no se arregla desde el navegador**: hace falta que el servidor
devuelva el HTML con los datos de esa hermandad. Es la fase W9 y necesita
Supabase y el despliegue. Mientras tanto, todo lo demás sí se puede hacer.

---

## Fases

Las W1–W8 se pueden hacer **hoy**, sin depender de nadie. Las W9 y W10
necesitan servidor.

| Fase | Qué entra | ¿Necesita servidor? | Estado |
|------|-----------|---------------------|--------|
| **W1** | Navegación de una web de verdad | No | Hecha |
| **W2** | Las secciones que faltan | No | Hecha |
| **W3** | Noticias con cuerpo y enlace propio | No | Hecha |
| **W4** | Titulares y patrimonio con foto | No | Hecha |
| **W5** | Diseño editorial: romper el centrado | No | Hecha |
| **W6** | Imágenes y peso de la página | No | Hecha |
| **W7** | Accesibilidad e idioma | No | Hecha |
| **W8** | El editor, a la altura | No | Hecha |
| **W9** | Que se comparta y se encuentre | **Sí** | Hecha (falta encenderla) |
| **W10** | Formularios, donativos y dominio | **Sí** | Pendiente |

---

## W1 — Navegación de una web de verdad

Hoy el menú es una fila de enlaces sueltos que se parte en varias líneas. Con
las ocho secciones puestas, en un móvil ocupa tres renglones antes de que
empiece la web.

- **Menú de hamburguesa en móvil**: panel a pantalla completa, se cierra al
  elegir, se puede cerrar con Escape y no deja la página desplazándose debajo.
- **Agrupar secciones en el menú**: «La Hermandad» con Historia, Junta,
  Patrimonio y Estación de penitencia colgando. Ocho enlaces sueltos no caben
  en ninguna cabecera.
- **Marcar dónde estás** al bajar por la página (el enlace de la sección que
  se está viendo, resaltado).
- **Saltar al contenido** también en la web pública: hoy solo está en el panel.
- **Botón flotante de contacto** opcional (teléfono o WhatsApp), que es como
  llega la mitad de la gente.

## W2 — Las secciones que faltan

Estas son las que más se buscan en la web de una hermandad y hoy no hay forma
de publicarlas.

- **Hazte hermano.** Lo más importante que le falta. Requisitos, cuota,
  qué supone, y un formulario que entra en el módulo de solicitudes de alta
  que **ya existe** en el panel. (El envío real es W10; en local ya funciona.)
- **Estación de penitencia.** Día, hora de salida, itinerario calle a calle
  con sus horas de paso, y recomendaciones. Es *el* dato que se busca en
  Semana Santa, y hoy no cabe en ninguna sección.
- **Horario de secretaría.** Cuándo y dónde se atiende, y para qué (papeletas,
  altas, pagos). Media docena de llamadas al día se ahorran con esto.
- **Patrimonio.** Los pasos, la orfebrería, los bordados. Se puede alimentar
  del **Inventario**, que ya está en el panel: marcar un enser como
  «publicable» y sale en la web con su foto y su ficha.
- **Junta de gobierno.** Cargos y nombres, que es lo que pide cualquier
  visita institucional.

## W3 — Noticias con cuerpo y enlace propio

Hoy una noticia es un titular, una fecha, una foto y un resumen. No tiene
cuerpo, ni enlace propio, ni se puede compartir una sola.

- Cuerpo largo con el mismo editor de párrafos que la Historia.
- **Enlace propio** (`/w/slug/n/id-de-la-noticia`), que es lo que se pega en
  redes.
- **Destacada** (la primera, a lo grande) y orden a mano.
- **Programar la publicación**: escribirla hoy y que salga el día del cabildo.
- Listado con paginación cuando pasen de doce.
- La sección de la portada enseña solo las tres últimas, con «ver todas».

## W4 — Titulares y patrimonio con foto

El modelo **ya guarda foto y texto largo de cada titular**, pero la web los
pinta como tres líneas de texto centrado. Es la sección con más devoción
detrás y la que peor sale.

**Hecho:**

- Titular a lo ancho: foto grande a un lado y su texto al otro, **alternando el
  lado** en cada uno. En la portada se asoma el arranque de su historia; lo
  demás vive en su ficha.
- **Ficha propia** por titular (`/w/slug/t/…`), con su foto, su historia
  entera, sus fotos y los demás titulares al pie. Comparte su propio título,
  su descripción y su imagen al pegar el enlace.
- **Crédito de la fotografía** y **texto alternativo** por titular, y **autor**
  en cada foto de la galería (también en el visor a pantalla completa).
- **Marca de agua** con el nombre de la hermandad y **aviso de derechos** bajo
  las fotos, los dos opcionales, en «Titulares → Derechos de las fotos».
- En el editor: reordenar titulares, más fotos por titular, enlace propio
  editable con aviso si dos quedan repetidos, y aviso si ningún titular tiene
  foto.

Queda para W6 el peso de estas fotos (hoy van como *data URL*), y para W7 el
texto alternativo de las fotos sueltas de la ficha.

## W5 — Diseño editorial: romper el centrado

Todas las secciones son texto centrado, una detrás de otra. Con contenido de
verdad se hace largo y plano, y se nota que es una plantilla.

**Hecho:**

- **Disposiciones alternas**: las fotos de una sección ya no se amontonan en
  una rejilla antes del texto; se reparten entre los párrafos, foto a un lado
  y texto al otro, cambiando de lado en cada bloque.
- **Franjas de fondo alternas** por sección, de borde a borde, para que se
  separen sin una sola línea.
- **Foto a sangre** con su frase encima, colocada detrás de la sección que
  elija la hermandad.
- **Cita destacada**: cualquier párrafo se marca como cita desde el editor, y
  su subtítulo pasa a ser la firma. **Capitular** como interruptor propio (y
  puesta de fábrica en el estilo «Boletín»).
- **Entrada suave** al bajar, que se apaga sola con «reducir movimiento» y no
  se aplica en la vista previa del panel.
- **Tres bloques de portada**: cuenta atrás a la salida (con la fecha de la
  campaña de Papeletas si no hay una propia), próximo culto sacado del
  calendario, y las cifras de la hermandad.

El editor avisa si la fecha de la salida ya pasó: la cuenta atrás desaparecía
sola y la hermandad se quedaba con un dato viejo sin enterarse.

## W6 — Imágenes y peso de la página

Las fotos se guardan como *data URL* dentro del propio contenido. Una galería
de treinta fotos son varios megas que viajan en cada carga.

**Hecho:**

- **WebP** al comprimir, cuando el navegador sabe (todos desde hace años). En
  la prueba, una foto de 622 kB baja a 196 kB, y si sale más gorda que la
  original se queda la original.
- **Dos tamaños en la galería**: la rejilla usa una copia de 520 px (~55 kB) y
  la grande solo se descarga al abrir la foto. Con treinta fotos son varios
  megas que dejan de viajar.
- **Cada foto al tamaño en que se ve**: portada 1920 px, galería 1600, y las
  de sección, titular o noticia 1100, que nunca se ven a más de media página.
- **Botón «Aligerar las fotos»** para las subidas antes de esto: les hace la
  copia pequeña sin volver a comprimir la grande (recomprimir lo ya comprimido
  solo quita calidad).
- **Caja reservada** en todas las imágenes, con `aspect-ratio`: la página ya no
  da un salto cuando una foto acaba de cargar.
- **`loading="lazy"` y `decoding="async"`** en todas las que no se ven al
  entrar.
- **Aviso de peso en el editor**: «Tu web pesa 2,4 MB: unos 6 segundos en un
  móvil con mala cobertura», con el añadido de que pasados los 4 MB el
  navegador puede no dejar guardarla.

Queda para W10 pasar las fotos a un almacén de verdad cuando haya Supabase:
hoy viven dentro del propio contenido.

## W7 — Accesibilidad e idioma

**Hecho:**

- **Texto alternativo** en todas las fotos que llevan información: las de una
  sección (el modelo pasa de «una lista de imágenes» a imagen + qué se ve), las
  de un titular, las de galería (su pie) y la de una noticia. Las decorativas
  se quedan vacías a propósito, que es lo correcto. El editor avisa de las que
  se publican sin describir y dice en qué sección están.
- **Contraste medido en la web publicada**, con los ocho estilos de un clic y
  todo el contenido pintado: 0 problemas. (La primera medición decía que los
  dos estilos oscuros estaban a 1,12:1; era la propia medición, que leía
  `color(srgb 0.70 …)` como si fuera 0-255.)
- **El foco no se sale** del visor de fotos ni del menú de móvil mientras están
  abiertos, y vuelve a donde estaba al cerrarlos.
- **44 px de alto** en los enlaces del menú de móvil y en los botones del
  visor, que es lo que recomiendan Apple y Google para el dedo.
- **Idioma declarado** (`lang`): sin él un lector de pantalla lee el castellano
  con voz inglesa. Y un bloque de cuatro líneas en otra lengua bajo la portada,
  marcado con SU idioma, para el visitante de fuera.

Traducir la web entera sigue pendiente: no es realista para una hermandad y no
lo pide nadie todavía. El terreno está: idioma declarado y un sitio donde
escribir en otra lengua.

## W8 — El editor, a la altura

**Hecho:**

- **Previa de Google y de WhatsApp**, una al lado de la otra, con **el recorte
  de verdad** de cada sitio (60 y 155 caracteres en Google; 65 y 120 en la
  tarjeta de WhatsApp). Enseñar el texto entero era engañar: la hermandad
  escribía tres líneas y en Google salía una.
- **Publicar por partes**: cada sección puede estar publicada, **en borrador**
  (se ve en la vista previa con su marca, no en la web) u oculta. El editor
  avisa de cuántas hay en borrador y las publica todas de un clic.
- **Guiones de ejemplo** para la historia (cuatro apartados), la estación de
  penitencia (itinerario completo con horas) y la página de bolsa de caridad.
  Solo se ofrecen con la sección vacía.
- **Duplicar** noticias, titulares, cultos, álbumes y páginas. La copia sale
  sin publicar y con enlace nuevo (dos noticias con el mismo enlace y una no se
  puede abrir), y las fotos del álbum copiado llevan id nuevo (el visor las
  localiza por id y dos iguales lo descolocaban).
- **Buscar en el raíl**, por nombre o por lo que hay dentro: «itinerario»
  encuentra «Estación de penitencia». Enter abre la primera.
- El **deshacer dice qué deshace**: «Deshacer «los titulares» (3)».

El «aviso al salir con cambios sin publicar» no se ha hecho como diálogo del
navegador: el editor guarda solo en cada cambio, así que no hay nada que
perder al salir. Lo que sí falta es publicar, y de eso avisa el editor por
dentro, que es más útil y menos molesto.

## W9 — Que se comparta y se encuentre *(necesita Supabase + despliegue)*

La fase de más impacto y la única que no se puede cerrar desde el navegador.

**Hecho, y funcionando hoy** (Google sí ejecuta JavaScript al indexar):

- **Datos estructurados** (JSON-LD): la hermandad como `Organization`, la sede
  como `Place` y **cada culto como `Event`** con su fecha y su hora.
- `canonical`, `og:url`, `og:site_name`, `theme-color` y el **escudo de la
  hermandad en la pestaña**. Con dominio propio configurado, el `canonical`
  apunta al dominio y no al enlace largo.
- `sitemap.xml` y `robots.txt` **generados** con la portada, el listado de
  noticias, cada noticia publicada con su fecha y cada ficha de titular. Se
  descargan desde el editor. Una web sin publicar se cierra a los buscadores.

**Escrito y listo, falta encenderlo** (dos pasos, en `docs/SEO.md`):

- `api/w.ts` devuelve el `index.html` con la cabecera de esa hermandad. Es lo
  único que arregla la vista previa de WhatsApp, que no ejecuta JavaScript. Si
  no hay base de datos o no encuentra la web, devuelve la página tal cual: no
  hay forma de que rompa nada.
- `api/seo.ts` sirve el sitemap y el robots.
- `supabase/web-publica.sql` crea la tabla desde la que lo lee, y la aplicación
  ya sube ahí la web en cada guardado (primero al navegador, siempre).

Queda de verdad para W10: mientras las fotos vivan dentro del contenido como
`data:`, la tarjeta al compartir sale sin imagen. Ningún rastreador descarga un
`data:`, y el código ya lo tiene en cuenta: si la imagen no es una URL, no se
promete.

## W10 — Formularios, donativos y dominio *(necesita Supabase + banco)*

- **Formulario de contacto** que llegue a secretaría de verdad (hoy la web da
  el teléfono y el correo, pero no hay formulario porque enviarlo necesita
  servidor).
- **Solicitud de alta** desde la web, que entra en el módulo de solicitudes.
- **Donativos y lotería** con pasarela.
- **Papeleta de sitio** desde la web para el hermano.
- Dominio propio con su certificado.

---

## En qué orden

1. **W1 y W2 primero**: son las que se notan al entrar en la web. Sin menú que
   aguante y sin «hazte hermano», lo demás luce menos.
2. **W3, W4 y W5** después: contenido y diseño, que es lo que hace que la web
   parezca de la hermandad y no de una plantilla.
3. **W6 y W7** son de fondo: no se ven, pero son las que hacen que la web
   cargue rápido y la pueda usar todo el mundo.
4. **W8** cuando el contenido ya sea grande: las herramientas del editor hacen
   falta cuando hay mucho que editar.
5. **W9 y W10** el día que se conecte Supabase. W9 es la más importante de
   todas en impacto, y es la que no depende de nosotros.
