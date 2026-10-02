"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, CheckCircle2, Keyboard, ScanLine, Wallet } from "lucide-react";
import { formatDate, formatDateTime, formatEuros, parseEuros } from "@/lib/bonos";
import type { Coupon, Redemption } from "@/lib/types";
import { normalizeCouponCode } from "@/lib/coupon-code";
import { getPendingRedemptions, removePendingRedemption, savePendingRedemption, type PendingRedemption } from "@/lib/redemption-outbox";

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
  const purchaseAttempt = useRef<{ code: string; amount: string; key: string } | null>(null);
  const submitting = useRef(false);
  const syncingOutbox = useRef(false);
  const outboxRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(2_000);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRedemptions, setPendingRedemptions] = useState<PendingRedemption[]>([]);
  const [isOnline, setIsOnline] = useState(true);

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

  const syncOutbox = useCallback(async () => {
    if (!navigator.onLine || syncingOutbox.current) return;
    if (outboxRetry.current) clearTimeout(outboxRetry.current);
    outboxRetry.current = null;
    syncingOutbox.current = true;
    try {
      const pending = await getPendingRedemptions(businessId);
      setPendingRedemptions(pending);
      for (const entry of pending) {
        let response: Response;
        try {
          response = await fetch(`/api/bonos/${encodeURIComponent(entry.code)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": entry.key },
            body: JSON.stringify({ amount: entry.amount }),
          });
        } catch {
          const delay = retryDelay.current;
          retryDelay.current = Math.min(retryDelay.current * 2, 60_000);
          outboxRetry.current = setTimeout(() => { void syncOutbox(); }, delay);
          break;
        }
        if (response.ok) {
          retryDelay.current = 2_000;
          const data = await response.json() as Lookup;
          await removePendingRedemption(entry.key);
          setPendingRedemptions((current) => current.filter((item) => item.key !== entry.key));
          setResult((current) => current?.coupon.code === entry.code ? data : current);
          setNotice("Compras pendientes sincronizadas con el servidor.");
          continue;
        }
        if (response.status === 400 || response.status === 404) {
          const data = await response.json().catch(() => ({})) as { error?: string };
          await removePendingRedemption(entry.key);
          setPendingRedemptions((current) => current.filter((item) => item.key !== entry.key));
          setError(`Una compra pendiente de ${entry.amount} € no se registró: ${data.error ?? "el servidor la rechazó"}`);
          continue;
        }
        if (response.status === 401 || response.status === 403) {
          setError("La sesión del comercio no está activa. La compra pendiente sigue guardada; inicia sesión de nuevo para sincronizarla.");
          break;
        }
        // Keep the same operation key after auth, rate-limit, or server errors;
        // replay is safe because the server applies the key and debit atomically.
        if (response.status === 429 || response.status >= 500) {
          const serverDelay = Number(response.headers.get("retry-after"));
          const delay = response.status === 429 && Number.isFinite(serverDelay) && serverDelay > 0 ? Math.min(serverDelay * 1_000, 300_000) : retryDelay.current;
          retryDelay.current = Math.min(retryDelay.current * 2, 60_000);
          outboxRetry.current = setTimeout(() => { void syncOutbox(); }, delay);
        }
        break;
      }
      const remaining = await getPendingRedemptions(businessId);
      setPendingRedemptions(remaining);
      if (remaining.length === 0) router.refresh();
    } catch {
      // Keep the local outbox intact; a later online event can retry it.
    } finally {
      syncingOutbox.current = false;
    }
  }, [businessId, router]);

  useEffect(() => {
    void getPendingRedemptions(businessId).then(setPendingRedemptions).catch(() => undefined);
    setIsOnline(navigator.onLine);
    const handleOnline = () => { setIsOnline(true); void syncOutbox(); };
    const handleOffline = () => {
      setIsOnline(false);
      if (outboxRetry.current) clearTimeout(outboxRetry.current);
      outboxRetry.current = null;
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (navigator.onLine) void syncOutbox();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (outboxRetry.current) clearTimeout(outboxRetry.current);
    };
  }, [businessId, syncOutbox]);

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
    if (!result || submitting.current) return;
    submitting.current = true;
    if (!purchaseAttempt.current || purchaseAttempt.current.code !== result.coupon.code || purchaseAttempt.current.amount !== amount) {
      purchaseAttempt.current = { code: result.coupon.code, amount, key: crypto.randomUUID() };
    }
    setBusy(true);
    setError("");
    setNotice("");
    const attempt = purchaseAttempt.current;
    const amountCents = parseEuros(attempt!.amount);
    const entry: PendingRedemption | null = amountCents === null ? null : { ...attempt!, businessId, amountCents, createdAt: Date.now() };
    const showQueued = () => {
      if (!entry) return;
      setPendingRedemptions((current) => [...current.filter((item) => item.key !== entry.key), entry].sort((a, b) => a.createdAt - b.createdAt));
      purchaseAttempt.current = null;
      setAmount("");
      setNotice("Compra guardada en este móvil; se enviará al recuperar la conexión y abrir de nuevo el área del comercio.");
    };
    try {
      if (!entry) throw new Error("Indica un importe válido, con hasta dos decimales.");
      // Persist the operation before sending it. If the connection drops after
      // the server commits but before its reply arrives, replay uses this same key.
      await savePendingRedemption(entry);
      setPendingRedemptions((current) => [...current.filter((item) => item.key !== entry.key), entry].sort((a, b) => a.createdAt - b.createdAt));
      if (!navigator.onLine) {
        showQueued();
        return;
      }
      let response: Response;
      try {
        response = await fetch(`/api/bonos/${encodeURIComponent(result.coupon.code)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": attempt!.key },
          body: JSON.stringify({ amount: attempt!.amount }),
        });
      } catch {
        showQueued();
        if (navigator.onLine) {
          outboxRetry.current = setTimeout(() => { void syncOutbox(); }, retryDelay.current);
          retryDelay.current = Math.min(retryDelay.current * 2, 60_000);
        }
        return;
      }
      if (response.status === 429 || response.status >= 500) {
        showQueued();
        const serverDelay = Number(response.headers.get("retry-after"));
        const delay = response.status === 429 && Number.isFinite(serverDelay) && serverDelay > 0 ? Math.min(serverDelay * 1_000, 300_000) : retryDelay.current;
        outboxRetry.current = setTimeout(() => { void syncOutbox(); }, delay);
        return;
      }
      if (!response.ok) {
        const details = await response.json().catch(() => ({})) as { error?: string };
        await removePendingRedemption(entry.key);
        setPendingRedemptions((current) => current.filter((item) => item.key !== entry.key));
        purchaseAttempt.current = null;
        throw new Error(details.error ?? "No se pudo registrar el gasto.");
      }
      const data = await response.json() as Lookup;
      await removePendingRedemption(entry.key);
      setPendingRedemptions((current) => current.filter((item) => item.key !== entry.key));
      setResult(data as Lookup);
      purchaseAttempt.current = null;
      setAmount("");
      setNotice("Gasto registrado. El saldo ya está actualizado.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar el gasto.");
      if (caught instanceof TypeError && entry && navigator.onLine) {
        outboxRetry.current = setTimeout(() => { void syncOutbox(); }, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, 60_000);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const serverBalance = result ? result.coupon.amountCents - result.coupon.usedCents : 0;
  const pendingForCoupon = result ? pendingRedemptions.filter((entry) => entry.code === result.coupon.code).reduce((sum, entry) => sum + entry.amountCents, 0) : 0;
  const balance = Math.max(0, serverBalance - pendingForCoupon);
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
        {pendingRedemptions.length > 0 && <div className="scanner-pending" role="status" aria-live="polite">
          <strong>{pendingRedemptions.length} {pendingRedemptions.length === 1 ? "compra pendiente" : "compras pendientes"}</strong>
          <span>Guardadas en este móvil; se enviarán al recuperar la conexión. Mantén abierta la sesión del comercio hasta que se sincronicen.</span>
          {isOnline && <button type="button" onClick={() => void syncOutbox()}>Reintentar envío</button>}
        </div>}
        {result && <div className="scanner-coupon" role="status" aria-live="polite">
          <div className="scanner-coupon-head"><CheckCircle2 size={20} aria-hidden="true" /><strong className="mono">{result.coupon.code}</strong><span className={`status-dot ${result.coupon.status}`}>{statusLabels[result.coupon.status]}</span></div>
          <dl>
            <div><dt>Comercio asignado</dt><dd>{result.businessName}</dd></div>
            <div><dt>Carrera</dt><dd>{result.raceName}</dd></div>
            <div><dt>Válido hasta</dt><dd>{formatDate(result.coupon.expiresAt)}</dd></div>
            <div><dt>Gastado</dt><dd>{formatEuros(result.coupon.usedCents)}</dd></div>
          </dl>
          <p className="scanner-balance"><Wallet size={20} aria-hidden="true" /> Saldo disponible: <strong>{formatEuros(balance)}</strong>{pendingForCoupon > 0 && <small> (incluye {formatEuros(pendingForCoupon)} pendiente de sincronizar)</small>}</p>
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
