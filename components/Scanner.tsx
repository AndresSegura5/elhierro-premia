"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, CheckCircle2, Keyboard, ScanLine, Wallet } from "lucide-react";
import { formatDate, formatDateTime, formatEuros } from "@/lib/bonos";
import type { Coupon, Redemption } from "@/lib/types";
import { normalizeCouponCode } from "@/lib/coupon-code";

type Lookup = {
  coupon: Coupon;
  raceName: string;
  businessName: string;
  redemptions: Redemption[];
};

type BarcodeDetectorShape = { detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorShape;

const statusLabels = {
  "not-started": "Aún no vigente",
  available: "Disponible",
  partial: "Uso parcial",
  redeemed: "Agotado",
  expired: "Caducado",
};

export function Scanner({ businessName, businessId }: { businessName: string; businessId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScan = useRef("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async (value: string) => {
    const code = normalizeCouponCode(value);
    setResult(null);
    setError("");
    setNotice("");
    if (!code) return;
    try {
      const response = await fetch(`/api/bonos/${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo consultar el bono.");
      setResult(data as Lookup);
      setManualCode(code);
      setAmount("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo consultar el bono.");
    }
  }, []);

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("El navegador no permite acceder a la cámara.");
      return;
    }
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      lastScan.current = "";
      setStream(cameraStream);
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
        await videoRef.current.play();
      }
    } catch {
      setError("No se pudo abrir la cámara. Puedes introducir el código manualmente.");
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
  }

  useEffect(() => {
    if (!stream) return;
    const activeStream = stream;
    let cancelled = false;
    let frame = 0;
    const BarcodeDetectorClass = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!BarcodeDetectorClass) {
      setError("Este navegador no admite escaneo QR. Introduce el código manualmente.");
      return;
    }
    const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });

    async function tick() {
      if (cancelled || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const found = await detector.detect(canvas);
          const raw = found[0]?.rawValue;
          if (raw && raw !== lastScan.current) {
            lastScan.current = raw;
            activeStream.getTracks().forEach((track) => track.stop());
            setStream(null);
            void lookup(raw);
            return;
          }
        } catch {
          setError("No se pudo leer el QR. Introduce el código manualmente.");
          return;
        }
      }
      if (!cancelled) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [stream, lookup]);

  useEffect(() => () => { stream?.getTracks().forEach((track) => track.stop()); }, [stream]);

  async function registerExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/bonos/${encodeURIComponent(result.coupon.code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo registrar el gasto.");
      setResult(data as Lookup);
      setAmount("");
      setNotice("Gasto registrado. El saldo ya está actualizado.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar el gasto.");
    } finally {
      setBusy(false);
    }
  }

  const balance = result ? result.coupon.amountCents - result.coupon.usedCents : 0;
  const canRedeem = result?.coupon.status === "available" || result?.coupon.status === "partial";

  return (
    <section className="scanner" aria-label="Comprobar bono">
      <div className="scanner-view">
        <span className="scanner-view-label"><Camera size={16} aria-hidden="true" /> Cámara</span>
        <video ref={videoRef} muted playsInline aria-label="Vista de la cámara" />
        <canvas ref={canvasRef} hidden />
        <span className="scan-frame" aria-hidden="true" />
        {!stream && <div className="scanner-empty">
          <ScanLine size={54} strokeWidth={1.4} aria-hidden="true" />
          <strong>Escanear código QR</strong>
          <button className="camera-start" onClick={startCamera} type="button"><Camera size={18} aria-hidden="true" /> Activar cámara</button>
        </div>}
        {stream && <button className="camera-stop" onClick={stopCamera} type="button"><CameraOff size={17} aria-hidden="true" /> Detener cámara</button>}
      </div>

      <div className="scanner-side">
        <p className="eyebrow">{businessName}</p>
        <h2>Comprueba el bono</h2>
        <p>Escanea el QR o introduce el código. Cada compra descuenta únicamente el importe registrado.</p>
        <p className="scanner-demo-note">Solo se pueden canjear los bonos asignados a este comercio.</p>
        <form className="manual-form" onSubmit={(event) => { event.preventDefault(); void lookup(manualCode); }}>
          <label htmlFor="manual-code"><Keyboard size={17} aria-hidden="true" /> Código manual</label>
          <div>
            <input id="manual-code" className="mono" type="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} required value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="EH-BES-A1B23NQ" />
            <button type="submit" className="button"><ScanLine size={17} aria-hidden="true" /> Consultar</button>
          </div>
        </form>
        {error && <p className="alert" role="alert">{error}</p>}
        {notice && <p className="scanner-success" role="status">{notice}</p>}
        {result && <div className="scanner-coupon" role="status" aria-live="polite">
          <div className="scanner-coupon-head"><CheckCircle2 size={20} aria-hidden="true" /><strong className="mono">{result.coupon.code}</strong><span className={`status-dot ${result.coupon.status}`}>{statusLabels[result.coupon.status]}</span></div>
          <dl>
            <div><dt>Comercio asignado</dt><dd>{result.businessName}</dd></div>
            <div><dt>Carrera</dt><dd>{result.raceName}</dd></div>
            <div><dt>Válido hasta</dt><dd>{formatDate(result.coupon.expiresAt)}</dd></div>
            <div><dt>Gastado</dt><dd>{formatEuros(result.coupon.usedCents)}</dd></div>
          </dl>
          <p className="scanner-balance"><Wallet size={20} aria-hidden="true" /> Saldo: <strong>{formatEuros(balance)}</strong></p>
          {result.redemptions.length > 0 && <ul className="scanner-movements">{result.redemptions.map((entry) => <li key={entry.id}><span>{formatDateTime(entry.createdAt)}</span><strong>{formatEuros(entry.amountCents)}</strong></li>)}</ul>}
          {canRedeem && result.coupon.businessId === businessId && <form className="scanner-spend" onSubmit={registerExpense}>
            <label htmlFor="expense-amount">Importe de esta compra</label>
            <div><input id="expense-amount" type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} required /><button type="submit" className="button" disabled={busy}>{busy ? "Registrando..." : "Registrar gasto"}</button></div>
            <small>Máximo disponible: {formatEuros(balance)}. Solo se admite el comercio asignado.</small>
          </form>}
        </div>}
      </div>
    </section>
  );
}
