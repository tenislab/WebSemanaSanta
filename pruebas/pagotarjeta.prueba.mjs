/**
 * EL PAGO CON TARJETA DEL HERMANO (C4).
 *
 * Tres cosas que, si se rompen, cuestan dinero de verdad:
 *
 *   1. QUE EL IMPORTE NO SALGA DEL NAVEGADOR. Si `crear-pago` se creyera lo
 *      que le mandan, cualquiera pagaría su cuota de 60 € por un céntimo.
 *   2. QUE DÉ POR COBRADO EL WEBHOOK Y NO LA VUELTA DEL NAVEGADOR. Esa
 *      dirección se escribe a mano; es la misma lección que costó C1.
 *   3. QUE NADIE PUEDA ESCRIBIR EN `pagos_tarjeta` DESDE EL NAVEGADOR. Poder
 *      hacerlo sería marcarse la cuota como pagada sin pagar.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const p = await cargar('src/lib/pagoTarjeta.ts')

  /* ---- 1. El botón no se enseña si la hermandad no ha enlazado su cuenta ---- */
  // Sin base de datos conectada `isSupabaseConfigured` es falso, así que aquí
  // lo único que se puede comprobar es que una cuenta vacía nunca vale.
  caso('sin cuenta enlazada no hay tarjeta', false, p.pagoConTarjetaDisponible(''))
  caso('ni con espacios', false, p.pagoConTarjetaDisponible('   '))
  caso('ni sin nada', false, p.pagoConTarjetaDisponible(null))

  /* ---- 2. La vuelta de la pasarela ---- */
  caso('vuelve de pagar', 'hecho', p.comoVuelveDePagar('?pago=hecho'))
  caso('se arrepintió', 'cancelado', p.comoVuelveDePagar('?pago=cancelado'))
  caso('cualquier otra cosa, nada', null, p.comoVuelveDePagar('?pago=si'))
  caso('sin parámetro, nada', null, p.comoVuelveDePagar('?dni=12345678Z'))

  /* ---- 3. «Ya lo estoy pagando»: lo que evita pagar dos veces ---- */
  const ahora = new Date('2026-03-10T12:00:00Z')
  const hace = (minutos) => new Date(ahora.getTime() - minutos * 60000).toISOString()
  const intento = (extra) => ({
    id: 'i1', tipo: 'cuota', referenciaId: 'c1', importeCent: 3000,
    estado: 'abierto', creadoEn: hace(2), ...extra,
  })

  caso('un pago recién abierto se avisa', 'i1',
    p.pagoEnMarcha([intento()], 'cuota', 'c1', ahora)?.id ?? null)
  caso('el de otro recibo no', null,
    p.pagoEnMarcha([intento()], 'cuota', 'otra', ahora))
  caso('ni el de una papeleta con el mismo id', null,
    p.pagoEnMarcha([intento()], 'papeleta', 'c1', ahora))
  caso('uno ya pagado no está «en marcha»', null,
    p.pagoEnMarcha([intento({ estado: 'pagado' })], 'cuota', 'c1', ahora))
  // Alguien que abrió la pasarela por la mañana y cerró la pestaña no está
  // pagando: avisarle de eso sería asustar por nada.
  caso('uno de hace cinco horas ya no', null,
    p.pagoEnMarcha([intento({ creadoEn: hace(300) })], 'cuota', 'c1', ahora))
  // Y una fecha ilegible se avisa igual: más vale un aviso de más que un cobro
  // duplicado.
  caso('una fecha que no se entiende avisa igual', 'i1',
    p.pagoEnMarcha([intento({ creadoEn: 'vete a saber' })], 'cuota', 'c1', ahora)?.id ?? null)

  /*
   * «NO LO SÉ» NO ES «NO HAY NINGUNO».
   *
   * Con `null` —no se pudo mirar— no se puede decir que no haya nada en
   * marcha, porque entonces la pantalla invitaría a pagar otra vez justo
   * cuando lo que pasa es que no hemos podido comprobarlo.
   */
  caso('sin saberlo, no se afirma nada', null, p.pagoEnMarcha(null, 'cuota', 'c1', ahora))

  const fuente = await readFile('src/lib/pagoTarjeta.ts', 'utf8')
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  caso('la lista de intentos devuelve null cuando falla', true,
    /if \(error\) return null/.test(sinComentarios))
  /*
   * EL IMPORTE NO VIAJA. Se mira lo que se le manda a `crear-pago` —el objeto
   * `body` de la llamada, no el fichero entero— porque el fichero sí habla de
   * importes en otro sitio: la lista de intentos los trae para pintarlos.
   */
  const cuerpoDeLaLlamada = sinComentarios.slice(
    sinComentarios.indexOf("invoke('crear-pago'"),
  ).split('})')[0]
  caso('lo que se manda son tipo, referencia y de dónde viene', 'tipo,referencia,origen',
    (cuerpoDeLaLlamada.match(/^\s{8}(\w+)[,:]/gm) ?? []).map((x) => x.trim().replace(/[,:]$/, '')).join(','))

  /* ---- 4. Lo que la base no deja hacer ---- */
  const sql = await readFile('supabase/pago-tarjeta.sql', 'utf8')
  const sqlLimpio = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')

  // Desde el navegador solo se puede LEER. Ni insert, ni update, ni delete.
  caso('el navegador solo puede leer los intentos', true,
    /grant select on pagos_tarjeta to authenticated/.test(sqlLimpio))
  caso('y no se le da nada más', false,
    /grant (insert|update|delete|all)[^;]*on pagos_tarjeta/i.test(sqlLimpio))

  // Las tres funciones que mueven dinero, quitadas de las manos de cualquiera
  // que no sea el servidor.
  for (const f of ['cobrar_pago_tarjeta', 'abrir_pago_tarjeta', 'fijar_sesion_pago']) {
    caso(`${f} no la puede llamar el navegador`, true,
      new RegExp(`revoke all on function ${f}\\([^)]*\\) from public, anon, authenticated`).test(sqlLimpio))
  }

  // El hermano ve LOS SUYOS, y la tesorería los de su hermandad: es lo que
  // hace que «yo pagué» se pueda comprobar en vez de discutir.
  caso('el hermano ve sus intentos', true, /hermano_id = hermano_propio_id\(\)/.test(sqlLimpio))
  caso('y nada de otra hermandad', true, /hermandad_id = hermandad_actual\(\)/.test(sqlLimpio))

  // Stripe reintenta los avisos: cobrar dos veces el mismo dinero metería dos
  // asientos en el libro por un ingreso que entró una vez.
  caso('un aviso repetido no cobra dos veces', true,
    /if v_pago\.estado = 'pagado' then\s+return true;/.test(sqlLimpio))

  /* ---- 5. El webhook: quien de verdad da por cobrado ---- */
  const hook = await readFile('supabase/functions/webhook-stripe/index.ts', 'utf8')
  const hookLimpio = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  caso('el webhook distingue la cuota de la suscripción', true,
    /metadata\.tipo === 'cuota' \|\| metadata\.tipo === 'papeleta'/.test(hookLimpio))
  caso('y llama a la función que apunta el cobro', true,
    /llamarRpc\('cobrar_pago_tarjeta'/.test(hookLimpio))
  // Si no se puede apuntar, 502: con un 200 Stripe lo daría por resuelto y la
  // cuota se quedaría pendiente para siempre con el dinero ya cobrado.
  caso('si no se puede apuntar, Stripe lo reintenta', true,
    /if \(!ok\) return respuesta\(\{ error: 'No se ha podido apuntar el cobro\.' \}, 502\)/.test(hookLimpio))

  /* ---- 6. La pantalla no da nada por cobrado al volver ---- */
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  caso('la vuelta de la pasarela no dice «pagado»', false,
    /pago=hecho[\s\S]{0,400}?[Pp]agada/.test(portal))
}
