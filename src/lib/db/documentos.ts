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
    tipoCabildo: (r.tipo_cabildo as Documento['tipoCabildo']) ?? null,
    proveedor: (r.proveedor as string | null) ?? null,
    vigenciaHasta: (r.vigencia_hasta as string | null) ?? null,
    estadoExpediente: (r.estado_expediente as Documento['estadoExpediente']) ?? null,
    archivoNombre: (r.archivo_nombre as string | null) ?? null,
    archivoTipo: (r.archivo_tipo as string | null) ?? null,
    archivoTamano: (r.archivo_tamano as number | null) ?? null,
  }
}
