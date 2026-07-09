function celda(valor: string | number) {
  const texto = String(valor)
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function toCsv(columnas: string[], filas: (string | number)[][]) {
  const lineas = [columnas, ...filas].map((fila) => fila.map(celda).join(';'))
  return lineas.join('\n')
}

export function descargarArchivo(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8;') {
  // El BOM ayuda a Excel a detectar UTF-8 en CSV, pero rompe la validación
  // de XML en muchos bancos: solo se antepone para contenido de tipo CSV/texto.
  const conBom = tipo.includes('csv') || tipo.includes('text/plain')
  const blob = new Blob([conBom ? '﻿' + contenido : contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
