# Actualización Cabildo — bloques 1, 2 y 3

Descomprime el contenido de este zip **en la raíz de tu repositorio**,
respetando las carpetas (`src/...`). Sobrescribe los archivos que te pida.
Después, en **GitHub Desktop** verás todos los cambios listos para commit y push.

## Qué incluye

**Novedades ya funcionando (todo en modo local, sin base de datos):**

1. **Etiquetas de hermano + avisos segmentados**
   - Etiquetas por hermano (costalero, acólito, banda… + crear las tuyas), con
     filtro en el censo.
   - En Comunicados puedes dirigir un aviso a una etiqueta: se calcula a qué
     hermanos llegaría por email (envío real pendiente de conectar proveedor).

2. **Cuotas: mensual, mora manual, métodos y modelo de recibo**
   - Cuota mensual (emite 12 recibos) además de la puntual.
   - Método de cobro: Domiciliación, Transferencia, Efectivo, Bizum.
   - «En mora» manual (tesorero/secretario/titular); nada entra en mora solo.
   - Modelo de recibo personalizado: subes tu diseño y se rellena con los datos.

3. **Web pública con 3 plantillas**
   - Sección «Web pública» en el panel: eliges plantilla (Clásica/Sobria/Moderna),
     publicas/ocultas, personalizas el enlace `/w/tu-slug`, el contenido y el
     color (por defecto el de tu hermandad).
   - La web tiene un botón **«Entrar»** que lleva al portal del hermano (`/hermano`).

**También incluye lo de la sesión anterior:** modo local sin BD, modelo de
papeleta, acceso de hermano de un clic, y tolerancia a Supabase en pausa.

## Importante para desplegar en modo local

En Vercel, para funcionar sin base de datos (con los accesos demo), **no**
definas `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY`.

## Pendiente (siguiente entrega)
- Suscripción de la hermandad (20 €/mes · 300 €/año, sin cobro real todavía).
- Ajuste de mora (que la hermandad decida si basta un cargo o hacen falta dos).
- Envío real de emails (al conectar Brevo/Resend).
