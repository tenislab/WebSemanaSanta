/**
 * LOS DOCUMENTOS del archivo · camelCase (aplicación) ⇄ snake_case (tabla).
 *
 * Un fichero por tabla, y los dos traductores se le pasan a `useSupabaseTable`.
 * El porqué de que esto esté en un solo sitio, y los TRES SITIOS que hay que
 * tocar al añadir un campo —el tipo, los dos traductores y la columna—, está
 * contado en `lib/db/hermanos.ts`. Olvidar `fromRow` no da error: el dato se
 * guarda y no vuelve, y eso se lee como «se ha perdido».
 */
import type { Documento } from '../../data/documentos'

export function documentoToRow(d: Documento): Record<string, unknown> {
  return {
    id: d.id,
    numero: d.numero,
    nombre: d.nombre,
    categoria: d.categoria,
    fecha: d.fecha,
    fecha_alta: d.fechaAlta,
    descripcion: d.descripcion,
    archivado_por: d.archivadoPor,
    cargos_con_acceso: d.cargosConAcceso,
    publicacion: d.publicacion,
    tipo_cabildo: d.tipoCabildo,
    proveedor: d.proveedor,
    vigencia_hasta: d.vigenciaHasta,
    estado_expediente: d.estadoExpediente,
    archivo_nombre: d.archivoNombre,
    archivo_tipo: d.archivoTipo,
    archivo_tamano: d.archivoTamano,
  }
}

export function rowToDocumento(r: Record<string, unknown>): Documento {
  return {
    id: r.id as string,
    numero: r.numero as number,
    nombre: r.nombre as string,
    categoria: r.categoria as Documento['categoria'],
    fecha: r.fecha as string,
    fechaAlta: r.fecha_alta as string,
    descripcion: r.descripcion as string,
    archivadoPor: (r.archivado_por as string | null) ?? null,
    cargosConAcceso: (r.cargos_con_acceso as Documento['cargosConAcceso']) ?? null,
    /*
     * SIN `publicacion` SE QUEDA EN LA JUNTA, que es el único valor por
     * defecto admisible: un documento de una base que todavía no tiene la
     * columna —o una fila del espejo viejo del navegador— no puede aparecer
     * en internet por no traer el campo. Lo que falta se queda dentro.
     */
    publicacion: (r.publicacion as Documento['publicacion']) ?? 'junta',
    tipoCabildo: (r.tipo_cabildo as Documento['tipoCabildo']) ?? null,
    proveedor: (r.proveedor as string | null) ?? null,
    vigenciaHasta: (r.vigencia_hasta as string | null) ?? null,
    estadoExpediente: (r.estado_expediente as Documento['estadoExpediente']) ?? null,
    archivoNombre: (r.archivo_nombre as string | null) ?? null,
    archivoTipo: (r.archivo_tipo as string | null) ?? null,
    archivoTamano: (r.archivo_tamano as number | null) ?? null,
  }
}
