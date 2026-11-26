'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCodeImage({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(value, { width: 180, margin: 1, errorCorrectionLevel: 'M' }).then(setSrc);
  }, [value]);
  return src ? <img src={src} width={180} height={180} alt={`QR Code do equipamento ${label}`} /> : null;
}
