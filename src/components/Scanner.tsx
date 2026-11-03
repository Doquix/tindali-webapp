import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

// Retail barcodes only, which keeps decoding fast on low-end phones.
const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
]);

const REPEAT_MS = 2500;

interface Props {
  /** While paused the camera keeps running but detections are ignored. */
  paused: boolean;
  onDetected: (code: string) => void;
}

export default function Scanner({ paused, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const pausedRef = useRef(paused);
  const onDetectedRef = useRef(onDetected);
  const lastRef = useRef({ code: "", at: 0 });
  const [status, setStatus] = useState<"starting" | "running" | "denied" | "unavailable">("starting");
  const [hasTorch, setHasTorch] = useState(false);
  const [torch, setTorch] = useState(false);

  pausedRef.current = paused;
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }
    let stopped = false;
    const reader = new BrowserMultiFormatReader(HINTS, { delayBetweenScanAttempts: 150 });
    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current!, (result) => {
        if (!result || pausedRef.current) return;
        const code = result.getText();
        const now = Date.now();
        if (code === lastRef.current.code && now - lastRef.current.at < REPEAT_MS) return;
        lastRef.current = { code, at: now };
        navigator.vibrate?.(60);
        onDetectedRef.current(code);
      })
      .then((controls) => {
        if (stopped) return controls.stop();
        controlsRef.current = controls;
        setHasTorch(Boolean(controls.switchTorch));
        setStatus("running");
      })
      .catch((err: unknown) => {
        if (!stopped) setStatus(err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "unavailable");
      });
    return () => {
      stopped = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  async function toggleTorch() {
    const controls = controlsRef.current;
    if (!controls?.switchTorch) return;
    await controls.switchTorch(!torch);
    setTorch(!torch);
  }

  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline />
      {status === "running" && (
        <>
          <div className="scan-frame"><div className="scan-line" /></div>
          {hasTorch && (
            <div className="scanner-tools">
              <button className="icon-btn" onClick={toggleTorch} aria-label={torch ? "Turn off flashlight" : "Turn on flashlight"} aria-pressed={torch}>
                <Icon name="torch" />
              </button>
            </div>
          )}
        </>
      )}
      {status === "starting" && <div className="scanner-msg">Starting camera…</div>}
      {status === "denied" && <div className="scanner-msg">Camera blocked. Allow camera access in your browser settings, or type the barcode below.</div>}
      {status === "unavailable" && <div className="scanner-msg">No camera found. The camera needs HTTPS or localhost. Type the barcode below.</div>}
    </div>
  );
}
