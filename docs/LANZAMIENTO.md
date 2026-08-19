# Lanzar Cabildo

El paso a paso del día que esto deja de ser una demostración. Calcula **una
tarde** para lo técnico y una semana de margen para lo demás.

Antes de nada:

```
npm run typecheck && npm run lint && npm test && npm run build
node pruebas/lanzamiento.mjs
```

Lo último comprueba lo que solo se nota el día del despliegue y no da tiempo a
arreglar con la hermandad delante. Si sale algo en rojo, se resuelve primero.

---

## 1. Supabase (30 min)

1. Crear proyecto en [supabase.com](https://supabase.com). **Elegid región de
   la Unión Europea** (Frankfurt o Irlanda). No es un detalle: si los datos
   salen de la UE hay que amparar la transferencia con cláusulas contractuales,
   y la región no se puede cambiar después sin migrar.
2. Guardar la contraseña de la base de datos donde no se pierda.
3. **SQL Editor**, y ejecutar en este orden exacto:

   | # | Archivo | Qué hace |
   |---|---|---|
   | 1 | `supabase/schema.sql` | Crea todas las tablas |
   | 2 | `supabase/rls-cargos.sql` | Permisos por cargo |
   | 3 | `supabase/rls-endurecer.sql` | **Obligatorio.** Sin él, cualquiera que se registre en `/registro` escribe en toda la base |
   | 4 | `supabase/hermano-auth.sql` | Acceso del hermano a su propia ficha |
   | 5 | `supabase/web-publica.sql` | La web pública |
   | 6 | `supabase/mensajes-web.sql` | Buzón de los formularios |
   | 7 | `supabase/storage-archivo.sql` | Adjuntos del archivo documental |

   El paso 3 **no es opcional y no se puede dejar para luego**. Léelo antes de
   ejecutarlo: al final explica cómo dar de alta al titular a mano.

4. **Project Settings → API**: copiar la *Project URL* y la clave *anon public*.
   La *service_role* **no se usa nunca** en esta aplicación; si aparece en algún
   sitio del navegador, es un agujero.

---

## 2. Despliegue en Vercel (20 min)

1. Importar el repositorio. Vercel detecta Vite solo; no hay que tocar el
   comando de build.
2. **Settings → Environment Variables**, cuatro variables:

   | Nombre | Valor | Para qué |
   |---|---|---|
   | `VITE_SUPABASE_URL` | la Project URL | El navegador |
   | `VITE_SUPABASE_ANON_KEY` | la clave anon | El navegador |
   | `SUPABASE_URL` | la misma URL | Las funciones de servidor |
   | `SUPABASE_ANON_KEY` | la misma clave | Las funciones de servidor |

   Las dos últimas hacen falta porque las funciones de `api/` **no leen las
   `VITE_*` en ejecución**: esas se incrustan en el navegador al compilar.
   Sin ellas, la vista previa al compartir el enlace sale genérica y el sitemap
   vuelve vacío.

3. Desplegar y comprobar **a mano**, que es lo que de verdad dice si funciona:

   - [ ] Entra en `/` y carga.
   - [ ] Recarga estando en `/app/hermanos` — **no** debe salir un 404 (para eso
         está el `vercel.json`).
   - [ ] `/robots.txt` responde y nombra el sitemap.
   - [ ] `/sitemap.xml` responde.
   - [ ] Registra una cuenta en `/registro` y comprueba que sale el asistente
         de alta de la hermandad.
   - [ ] Ve a **Configuración → Puesta en marcha**: la base de datos tiene que
         aparecer como conectada.

---

## 3. Lo legal, antes de meter a un solo hermano (1 semana)

Esta es la parte que se salta todo el mundo y la que puede costar dinero.

- [ ] **Rellenar los datos del titular** en `src/data/legal.ts`: hay marcadores
      `[NOMBRE]`, `[NIF]`, `[CORREO DE CONTACTO]`. Búscalos y sustitúyelos.
- [ ] **Que un abogado de protección de datos revise** el aviso legal, la
      política de privacidad y las condiciones, y sobre todo el
      [contrato de encargo](CONTRATO-ENCARGO.md).
- [ ] **Firmar el contrato de encargo con cada hermandad.** Es obligatorio por
      escrito (art. 28 RGPD) y sin él la hermandad incumple desde el primer día.
- [ ] Tener claro que **el censo de una hermandad es dato de categoría
      especial**: revela convicciones religiosas (art. 9 RGPD). No es un censo
      de socios cualquiera y las garantías son mayores.

> No sé qué hermandad ni qué asesoría tienes; esto es lo que hay que llevarle
> ya masticado, no un sustituto de su revisión.

---

## 4. Correo, cobros y dominio

Los tres son opcionales para arrancar y los contrata la hermandad a su nombre.
Están explicados paso a paso en [`CONECTAR.md`](CONECTAR.md).

**El correo se puede probar hoy mismo, gratis y sin dominio**: cuenta en Resend,
`supabase secrets set RESEND_API_KEY=…`, `supabase functions deploy
enviar-correo`, y el botón de prueba en Configuración → Correo. Sin dominio solo
escribe a tu propia dirección, que es justo lo que hace falta para comprobar que
funciona.

Mientras no estén, la aplicación **lo dice en rojo** en cada sitio donde se
nota, y sigue funcionando: los avisos van al buzón interno y se cobra por Bizum
con confirmación de la tesorería.

---

## 5. El día que entra la primera hermandad

Por este orden, que importa:

1. **Contrato de encargo firmado.** Antes de tocar un dato.
2. **Alta de la hermandad**: el asistente pide CIF, dirección, IBAN, escudo y
   día de salida. Que lo rellene alguien de la junta, no tú: son sus datos.
3. **Traer su censo**: Hermanos → Exportar → «Traer vuestro censo». Que
   preparen su Excel guardado como CSV.
   - Se emparejan las columnas a mano. **Revísalo con ellos**, mirando los
     ejemplos que salen debajo de cada casilla.
   - El ensayo enseña fila a fila qué va a pasar **antes** de tocar nada.
   - Si algo sale mal, hay botón de deshacer mientras la ventana siga abierta.
4. **Comprobar la numeración con ellos.** Es lo que más duele si sale mal: que
   dos o tres hermanos veteranos confirmen que su número es el que esperan.
5. **Configurar cuerpos y tramos** con sus aforos reales, y los roles por tramo
   si quieren (costalero, acólito…).
6. **Emitir la cuota del ejercicio** desde Cuotas.
7. **Dar acceso al área del hermano** a unos pocos primero —la junta y cuatro
   voluntarios— antes de anunciarlo a los mil.
8. **Copia de seguridad** desde Configuración → Copias y datos. Y enseñarles a
   hacerla ellos.

---

## 6. Y después

- **Copia de seguridad semanal** durante el primer mes. Se descarga sola desde
  Configuración; que lo haga alguien de la junta y la guarde fuera.
- **Un canal para que avisen de fallos.** Un correo basta, pero que exista y que
  se conteste.
- **Acompañar una temporada entera**, de la emisión de cuotas a la salida. Es lo
  que falta de verdad para saber si esto está listo, y no hay atajo:
  ver [`ESTA-PARA-SALIR.md`](ESTA-PARA-SALIR.md).

---

## Si algo se rompe

| Qué se ve | Qué suele ser |
|---|---|
| 404 al recargar en `/app/algo` | Falta el `vercel.json` o no se aplicó |
| «Los datos solo están en este navegador» | Faltan las `VITE_*` en Vercel, o no se redesplegó tras ponerlas |
| Vista previa genérica al compartir el enlace | Faltan `SUPABASE_URL` y `SUPABASE_ANON_KEY` (sin el `VITE_`) |
| El hermano no puede entrar | No tiene cuenta de acceso: se le da desde su ficha. Los importados no la traen (ver `CONECTAR.md`) |
| Un cargo ve módulos que no le tocan | No se ejecutó `rls-endurecer.sql` |
| «No se pudo guardar» al subir fotos | Se llenó el almacenamiento del navegador. Con Supabase conectado no pasa |

**Marcha atrás:** en Vercel, *Deployments* → el despliegue anterior →
*Promote to Production*. Vuelve en segundos. Los datos no se tocan.
