# Que la web se comparta y se encuentre (W9)

## El problema, en una línea

La web de la hermandad es una aplicación de una sola página. El título, la
descripción y la imagen los pone **el navegador**, con JavaScript, cuando la
página ya se ha cargado. Pero **WhatsApp, Facebook y X no ejecutan
JavaScript**: piden el HTML y leen lo que hay.

Resultado: si el hermano mayor pega el enlace de su web en el grupo de
WhatsApp, la vista previa dice *«Gobergo — Software para gestionar tu
hermandad»*.

---

## Lo que ya funciona hoy, sin tocar nada

Google **sí** ejecuta JavaScript al indexar, así que todo esto le llega:

| | |
|---|---|
| Título y descripción | Los de la hermandad, no los de Gobergo |
| `canonical` y `og:url` | La dirección buena de cada página (el dominio propio si lo hay) |
| `theme-color` | El color de la hermandad en la barra del móvil |
| Escudo en la pestaña | El de la hermandad |
| Datos estructurados | La hermandad como `Organization`, su sede como `Place` y **cada culto como `Event`**, con su fecha y su hora |
| Idioma | El `lang` de la página, y el del bloque en otra lengua |

Y desde el editor (**Al compartir → Para Google**) se descargan el
`sitemap.xml` y el `robots.txt` ya hechos, para subirlos donde esté alojada la
web.

---

## Lo que falta, y cómo se enciende

Para que la vista previa de WhatsApp diga el nombre de la hermandad hace falta
que **el servidor** devuelva el HTML ya con esos datos. Está escrito y probado:

- `api/w.ts` — devuelve el `index.html` con la cabecera de esa hermandad.
- `api/seo.ts` — sirve `sitemap.xml` y `robots.txt`.
- `src/lib/seoWeb.ts` — las funciones que arman todo eso (con pruebas).
- `supabase/web-publica.sql` — la tabla desde la que lo lee.

### Los dos pasos

**1. Crear la tabla.** En tu proyecto de Supabase, SQL Editor, ejecuta
`supabase/web-publica.sql`. Crea la tabla `web_publica` con dos políticas: una
web publicada la puede **leer cualquiera** (es pública, ese es el sentido), y
el personal de la hermandad la lee y la edita, esté publicada o no.

**2. Definir las variables en el despliegue.** En Vercel → Settings →
Environment Variables:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ…
```

Con las `VITE_…` que ya tengas puestas también vale: la función mira las dos.

Los `rewrites` de `vercel.json` ya están puestos y en el orden que toca
(`/w/*` y los dos archivos antes del comodín que manda todo a `index.html`).

### Qué pasa mientras no se haga

**Nada malo.** La función pide el `index.html` de siempre y, si no encuentra
base de datos o no encuentra la web, lo devuelve tal cual. La web sigue
funcionando exactamente igual que ahora. No hay forma de que esto rompa la
página.

### Cómo comprobar que ha funcionado

```
curl -s https://tu-dominio/w/tu-hermandad | head -20
```

Tiene que salir el nombre de tu hermandad en el `<title>`, no el de Gobergo. Y
después, en <https://developers.facebook.com/tools/debug/> pegando el enlace,
la vista previa buena. (Si WhatsApp ya se había guardado la mala, ahí mismo se
le dice que vuelva a mirar.)

---

## Detalles que conviene saber

- **Las fotos en `data:` no valen** como imagen al compartir: ningún rastreador
  las descarga. Mientras las fotos vivan dentro del propio contenido (ver W6),
  la tarjeta saldrá sin imagen. Se arregla en W10, al pasarlas a un almacén de
  verdad, y el código ya está preparado: si la imagen no es una URL, no se
  promete.
- **El `robots.txt` de una web sin publicar cierra la puerta a los
  buscadores**, a propósito: si Google indexa una hermandad a medio hacer,
  luego cuesta meses quitarlo.
- **Con dominio propio configurado**, el `canonical` apunta al dominio y no al
  enlace largo, para que Google no cuente dos webs distintas.

---

# Segunda vuelta (agosto 2026): que cada página sea lo que es

Lo de arriba resolvió **compartir**. Esto resuelve **encontrar**.

## Lo que se manda ahora

| Página | Qué le decimos a Google |
|---|---|
| Portada | `ReligiousOrganization` + `Place` (la sede, con su dirección) |
| Noticia | `NewsArticle` con titular, fecha, foto y editor |
| Titular | La ficha, con sus migas de pan |
| Actualidad | El listado, con sus migas de pan |

Y en todas, `BreadcrumbList`: lo que hace que en el buscador se lea
«Hermandad › Actualidad › El cartel de 2027» en vez de
`hermandad.es/n/cartel-2027`.

## Por qué la fecha importa tanto

Una `NewsArticle` sin `datePublished` no entra en Google Discover ni en los
resultados de «lo más reciente». Para una hermandad eso es justo lo que
interesa: el día que se publica el cartel o se anuncia el besamanos, esa
noticia tiene que poder salir. Sin fecha, no puede.

La fecha va también en `article:published_time`, que es lo que lee Facebook.

## El idioma

`index.html` trae `lang="es"` fijo, porque la aplicación es española. Pero la
web de la hermandad puede estar en otra lengua, y entonces esa etiqueta miente:
Google indexa la página como castellana y un lector de pantalla la lee con
acento castellano. El servidor lo corrige con `web.idioma`.

Va filtrado por `idiomaSeguro()`: un código de idioma es letras y guiones
(`es`, `en`, `pt-BR`). Si lo guardado no lo parece, se sirve en castellano. Sin
ese filtro, unas comillas escritas en el editor cerrarían el atributo y podrían
escribir HTML en la página.

## Detalle para quien lo mantenga

`seoWeb.ts` lee la web con interrogantes (`web.seo?.titulo`) **a propósito**.
El navegador rellena los huecos al cargar; el servidor no, lee el JSON crudo de
la base. Una web guardada antes de que existiera un campo no lo tiene, y sin
interrogante se cae la cabecera entera y la página sale sin una sola etiqueta,
sin dar error. Si añades un campo nuevo, léelo con interrogante.
