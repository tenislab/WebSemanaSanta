# Activar el dominio de una hermandad

Lo que hay que hacer **tú** cuando llega un aviso de «Activar dominio».

El correo trae ya el dominio, la hermandad, por dónde va su web ahora y a quién
contestar, así que no hace falta preguntar nada.

---

## Antes de tocar nada: mira que su web esté publicada

Es lo primero y lo que más veces va a fallar. El servidor solo reconoce un
dominio si la web de esa hermandad está **publicada**; si no, quien escriba su
dominio verá la página de venta de Gobergo y nadie entenderá por qué.

Se comprueba entrando en su web por el enlace largo: `gobergo.com/w/su-slug`.
Si se ve, está publicada. Si no, avísales de que le den a publicar antes de
seguir.

---

## Los cuatro pasos

### 1. Añadir el dominio en Vercel

Vercel → el proyecto de Gobergo → **Settings → Domains → Add**.

Añade **los dos**:

- `hermandaddetriana.es`
- `www.hermandaddetriana.es`

Los dos, siempre. Media España escribe el `www` y la otra media no; con uno
solo, la mitad de los visitantes se queda fuera. Vercel te ofrecerá que uno
redirija al otro: dile que sí, y da igual cuál sea el principal.

### 2. Copiar los DNS que te dé Vercel

En cuanto añades el dominio, Vercel enseña **los registros exactos** que hay
que poner. Suelen ser un registro `A` para el dominio pelado y un `CNAME` para
el `www`.

**Copia lo que te enseñe Vercel, no lo que recuerdes.** Esos valores cambian, y
un registro mal copiado son tres días de «no me funciona» hasta que alguien se
da cuenta.

### 3. Mandárselos a la hermandad

Respóndeles al correo del aviso con los registros tal cual, y diciendo dónde
van: en el panel de su registrador (IONOS, GoDaddy, Namecheap…), en la sección
de DNS.

Merece la pena decirles también que **puede tardar un rato**: normalmente
minutos, a veces horas. Si no se avisa, vuelven a escribir a los diez minutos
pensando que algo va mal.

### 4. Comprobar

En su pantalla de Web pública hay un botón, **«Comprobar si ya apunta aquí»**,
que lo dice de verdad en vez de fiarse de que esté bien escrito. Que le den
ellos, o dale tú desde su cuenta.

El candado de seguridad (HTTPS) se emite solo en cuanto los DNS resuelven. No
hay que comprar nada ni renovar nada.

---

## Si algo no va

**Se ve la página de Gobergo en vez de su web.** Su web no está publicada, o el
dominio no está escrito igual en su pantalla de Web pública. El servidor busca
por ese texto: si ahí pone `www.hermandaddetriana.es` y el visitante entra por
`hermandaddetriana.es`, funciona igual —se prueban los dos—, pero si hay una
errata, no.

**Funciona sin `www` pero no con `www` (o al revés).** Falta uno de los dos en
Vercel, o falta la redirección.

**Sigue sin ir después de horas.** Que miren en su registrador si hay otro
registro `A` o `CNAME` antiguo para el mismo nombre. Es lo más común: el
registrador trae uno puesto de fábrica apuntando a su página de «en
construcción», y hasta que no se borra, gana el viejo.
