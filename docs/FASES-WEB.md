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
| **W5** | Diseño editorial: romper el centrado | No | Pendiente |
| **W6** | Imágenes y peso de la página | No | Pendiente |
| **W7** | Accesibilidad e idioma | No | Pendiente |
| **W8** | El editor, a la altura | No | Pendiente |
| **W9** | Que se comparta y se encuentre | **Sí** | Pendiente |
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

- **Disposiciones alternas**: foto a la izquierda y texto a la derecha, y al
  revés en la siguiente.
- **Fondos alternos** por sección, para que se separen sin líneas.
- **Imagen a sangre** (de borde a borde) como separador entre bloques.
- **Cita destacada** y **capitular** en los textos largos.
- Entrada suave al hacer scroll, respetando «reducir movimiento».
- Dos o tres bloques nuevos para la portada: cuenta atrás a la salida,
  próximo culto destacado, cifras de la hermandad.

## W6 — Imágenes y peso de la página

Las fotos se guardan como *data URL* dentro del propio contenido. Una galería
de treinta fotos son varios megas que viajan en cada carga.

- Comprimir mejor al subir y guardar **dos tamaños** (una pequeña para la
  rejilla, la grande solo al abrirla).
- `width` y `height` en todas las imágenes, para que la página no salte
  mientras carga.
- `loading="lazy"` en todas (hoy en tres sitios).
- **Aviso de peso en el editor**: «tu web pesa 8 MB; en un móvil con mala
  cobertura tarda 20 segundos».
- Pasar las fotos a un almacén de verdad cuando haya Supabase (enlaza con W10).

## W7 — Accesibilidad e idioma

- Texto alternativo obligatorio en las fotos que se suben (hoy va vacío).
- Contraste comprobado también en la web pública, no solo en el editor.
- Foco visible y orden de tabulación revisado en el menú y en el visor de
  fotos.
- Tamaños de pulsación cómodos en el menú de móvil.
- Preparar el terreno para una **segunda lengua** (muchas hermandades quieren
  al menos la portada en inglés por el turismo).

## W8 — El editor, a la altura

- **Vista previa de cómo se ve en Google** y en WhatsApp, con el recorte real.
- **Deshacer por secciones** y aviso al salir con cambios sin publicar.
- **Publicar por partes**: dejar una sección en borrador sin ocultarla entera.
- **Plantillas de contenido**: «rellena tu historia» con un guion de ejemplo,
  para la hermandad que se queda mirando la caja vacía.
- **Duplicar** páginas y noticias.
- Buscar dentro del editor (con doce secciones ya hace falta).

## W9 — Que se comparta y se encuentre *(necesita Supabase + despliegue)*

La fase de más impacto y la única que no se puede cerrar desde el navegador.

- **HTML servido con los datos de la hermandad**: una función en el borde
  (Vercel/Netlify) que lea la web de esa hermandad y devuelva el HTML con su
  título, su descripción y su imagen. Es lo que arregla el problema del
  principio.
- **Datos estructurados** (JSON-LD): la hermandad como `Organization`, la sede
  como `Place` y **cada culto como `Event`**, que es lo que hace que los
  cultos salgan en Google con su fecha y su hora.
- `canonical`, `og:url`, `theme-color` y **favicon con el escudo** de la
  hermandad.
- `robots.txt` y `sitemap.xml` generados con las páginas y las noticias.
- Redirección del enlace largo al dominio propio.

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
