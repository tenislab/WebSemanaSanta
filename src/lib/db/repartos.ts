import type { Reparto } from '../repartos'

/**
 * `hermandad_id` no se manda: la pone la base con su disparador. El porcentaje
 * viaja en CENTÉSIMAS DE PUNTO y entero, por lo mismo que el dinero va en
 * céntimos: en `numeric` con decimales, JavaScript y Postgres no redondean
 * igual los empates, y un 12,345 % se guarda como una cosa y se lee como otra.
 */
export function repartoToRow(r: Reparto): Record<string, unknown> {
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    categoria_base: r.categoriaBase,
    porcentaje_cent: r.porcentajeCent,
    categoria_destino: r.categoriaDestino,
    activo: r.activo,
    nota: r.nota,
  }
}

export function rowToReparto(row: Record<string, unknown>): Reparto {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? '',
    tipo: (row.tipo as Reparto['tipo']) ?? 'reparto',
    categoriaBase: (row.categoria_base as string) ?? '',
    porcentajeCent: Number(row.porcentaje_cent ?? 0),
    categoriaDestino: (row.categoria_destino as string) ?? '',
    // Sin `!!` explícito, una fila vieja sin la columna dejaría la regla
    // apagada. Con `?? true` una regla recién creada nace encendida, que es lo
    // que espera quien acaba de escribirla.
    activo: row.activo === undefined || row.activo === null ? true : !!row.activo,
    nota: (row.nota as string | null) ?? '',
    creadoEn: (row.creado_en as string) ?? '',
  }
}
