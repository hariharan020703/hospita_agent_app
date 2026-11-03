import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';

/** QR code that encodes the booking reference, scanned at the kiosk for check-in. */
export function BookingQr({ bookingRef, label, className }: { bookingRef: string; label: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    // Loaded on demand so the QR library is not part of the first download.
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(bookingRef, {
          margin: 1,
          width: 240,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        }),
      )
      .then((url) => active && setSrc(url))
      .catch(() => active && setSrc(null));
    return () => {
      active = false;
    };
  }, [bookingRef]);
  if (!src) return <Skeleton className={cn('h-40 w-40 rounded-lg', className)} />;
  return (
    <img
      src={src}
      alt={label}
      width={160}
      height={160}
      className={cn('h-40 w-40 rounded-lg bg-white p-1', className)}
    />
  );
}
