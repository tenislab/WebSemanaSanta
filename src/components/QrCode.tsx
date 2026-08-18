import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  /** Texto real que codifica el QR (legible al escanearlo con cualquier lector). */
  value: string
  size?: number
}

/**
 * Código QR real y escaneable (librería `qrcode`, generado en el navegador,
 * sin llamadas de red). Codifica los datos de la papeleta como texto plano:
 * cualquier lector de QR los mostrará. La verificación automática por URL
 * (abrir la papeleta directamente al escanear) llegará con la base de datos.
 */
export default function QrCode({ value, size = 96 }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    // Se genera SIEMPRE grande (480 px) y se enseña al tamaño que pida quien lo
    // use. Rasterizándolo a 96 px, un QR de 65 módulos salía a 1,4 px por
    // módulo y con la rejilla desigual (la librería redondea hacia abajo):
    // en pantalla pasaba, pero impreso a un centímetro no lo leía casi ningún
    // móvil. Al escalar una imagen grande hacia abajo, el navegador remuestrea
    // y los módulos quedan parejos.
    QRCode.toDataURL(value, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelado) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelado) setDataUrl(null)
      })
    return () => {
      cancelado = true
    }
  }, [value, size])

  if (!dataUrl) {
    return <div className="qr-preview" style={{ width: size, height: size }} aria-hidden="true" />
  }

  return <img src={dataUrl} alt={`Código QR: ${value}`} width={size} height={size} className="qr-preview" />
}
