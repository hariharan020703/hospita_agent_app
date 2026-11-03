// Camera QR scanning: the rear camera streams into a <video>; frames are decoded with the browser's BarcodeDetector
// when it supports QR codes, otherwise with jsQR (loaded on demand) about every 250 ms. All camera tracks are stopped
// when scanning ends, the component unmounts or the kiosk resets.
import { useEffect, useRef, useState } from 'react';

/** Minimal typing for the Shape Detection API (not in TypeScript's DOM lib yet). */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

type Decoder = (video: HTMLVideoElement) => Promise<string | null>;

export type ScannerStatus = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'error';

const SCAN_INTERVAL_MS = 250;

async function createDecoder(): Promise<Decoder> {
  if ('BarcodeDetector' in window) {
    const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorConstructor }).BarcodeDetector;
    try {
      const formats = (await Detector.getSupportedFormats?.()) ?? ['qr_code'];
      if (formats.includes('qr_code')) {
        const detector = new Detector({ formats: ['qr_code'] });
        return async (video) => {
          if (video.readyState < 2) return null;
          const codes = await detector.detect(video);
          return codes[0]?.rawValue ?? null;
        };
      }
    } catch {
      // Fall through to jsQR.
    }
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return (video) => {
    if (!context || video.readyState < 2 || !video.videoWidth) return Promise.resolve(null);
    // Downscale large frames: QR codes held up to the camera decode fine at 640 px and much faster.
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
    return Promise.resolve(code?.data ?? null);
  };
}

function statusFromError(error: unknown): ScannerStatus {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return 'unavailable';
  }
  return 'error';
}

/**
 * Starts the camera while `active` and calls `onCode` with every decoded value. Return `true` from `onCode`
 * to accept the code and stop scanning; return `false` to keep looking.
 */
export function useQrScanner(active: boolean, onCode: (value: string) => boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ScannerStatus>('starting');
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const video = videoRef.current;

    const stopCamera = () => {
      window.clearTimeout(timer);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        // Only detach our own stream: a newer run of this effect may already own the <video>.
        if (video?.srcObject === stream) {
          video.pause();
          video.srcObject = null;
        }
      }
      stream = null;
    };

    const start = async () => {
      setStatus('starting');
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (error) {
        if (!cancelled) setStatus(statusFromError(error));
        return;
      }
      if (cancelled || !video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay of a muted inline video is allowed; ignore the rare interruption error.
      }
      let decode: Decoder;
      try {
        decode = await createDecoder();
      } catch {
        // The decoder chunk could not load (e.g. offline): manual entry still works.
        if (!cancelled) setStatus('error');
        stopCamera();
        return;
      }
      if (cancelled) return;
      setStatus('scanning');

      const tick = async () => {
        if (cancelled) return;
        try {
          const value = await decode(video);
          if (cancelled) return;
          if (value && onCodeRef.current(value)) {
            stopCamera();
            return;
          }
        } catch {
          // A frame that fails to decode is simply skipped.
        }
        timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS);
      };
      void tick();
    };

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [active]);

  return { videoRef, status };
}
