"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, ScanLine, X } from "lucide-react";
import jsQR from "jsqr";
import { couponCodeFromQr } from "@/lib/coupon-code";

export function CouponQrScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const frameRef = useRef(0);
  const titleId = useId();
  const descriptionId = useId();
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    const request = ++requestRef.current;
    stopCamera();
    setError("");
    setStatus("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Este navegador no permite abrir la cámara. Puedes introducir el código manualmente.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!mountedRef.current || request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      if (!mountedRef.current || request !== requestRef.current) return;
      setStatus("scanning");
      let lastRead = 0;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !context) throw new Error("canvas");

      function readFrame(now: number) {
        if (!mountedRef.current || request !== requestRef.current || !streamRef.current || !canvas || !context) return;
        if (video && video.readyState >= 2 && video.videoWidth && now - lastRead >= 150) {
          lastRead = now;
          try {
            const scale = Math.min(1, 720 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
            if (result) {
              const code = couponCodeFromQr(result.data);
              if (code) {
                stopCamera();
                onScan(code);
                return;
              }
              setError("Este QR no contiene un código de bono. Apunta al QR de El Hierro Premia Deportistas.");
            }
          } catch {
            stopCamera();
            setStatus("error");
            setError("No se pudo leer la imagen de la cámara. Puedes volver a activarla o introducir el código manualmente.");
            return;
          }
        }
        frameRef.current = requestAnimationFrame(readFrame);
      }
      frameRef.current = requestAnimationFrame(readFrame);
    } catch (caught) {
      if (!mountedRef.current || request !== requestRef.current) return;
      stopCamera();
      setStatus("error");
      const denied = caught instanceof DOMException && (caught.name === "NotAllowedError" || caught.name === "SecurityError");
      setError(denied
        ? "No se ha permitido el acceso a la cámara. Puedes habilitarlo en el navegador o introducir el código manualmente."
        : "No se pudo abrir la cámara. Comprueba que esté disponible o introduce el código manualmente.");
    }
  }, [onScan, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    void startCamera();
    const pauseWhenHidden = () => {
      if (document.hidden) {
        ++requestRef.current;
        stopCamera();
        setStatus("error");
        setError("La cámara se ha detenido. Pulsa «Activar cámara» para continuar.");
      }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      mountedRef.current = false;
      ++requestRef.current;
      stopCamera();
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [startCamera, stopCamera]);

  return <dialog
    className="coupon-qr-dialog"
    ref={dialogRef}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <div className="coupon-qr-dialog-body">
      <header className="coupon-qr-dialog-heading">
        <h2 id={titleId}><ScanLine size={24} aria-hidden="true" />Escanea tu bono</h2>
        <button type="button" className="coupon-qr-dialog-close" aria-label="Cerrar lector QR" onClick={onClose} autoFocus><X size={22} aria-hidden="true" /></button>
      </header>
      <p id={descriptionId}>Apunta la cámara al QR de tu bono para consultar su saldo.</p>
      <div className="coupon-qr-camera">
        <video ref={videoRef} muted playsInline autoPlay aria-label="Vista de la cámara para leer el bono" />
        <canvas ref={canvasRef} hidden />
        {status === "scanning" && <span className="coupon-qr-frame" aria-hidden="true" />}
        {status !== "scanning" && <div className="coupon-qr-camera-status" role="status">
          <Camera size={44} aria-hidden="true" />
          {status === "starting" ? "Abriendo cámara…" : "Cámara detenida"}
        </div>}
      </div>
      {error && <p className="coupon-qr-error" role="alert">{error}</p>}
      <div className="coupon-qr-dialog-actions">
        {status === "error" && <button type="button" className="button" onClick={() => void startCamera()}><Camera size={18} aria-hidden="true" />Activar cámara</button>}
        <button type="button" className="button subtle" onClick={onClose}>Introducir código</button>
      </div>
    </div>
  </dialog>;
}
