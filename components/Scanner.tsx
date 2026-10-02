"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CameraOff, Keyboard, ScanLine, Wallet, X } from "lucide-react";
import jsQR from "jsqr";
import { formatEuros, parseEuros } from "@/lib/bonos";
import type { Coupon, Redemption } from "@/lib/types";
import { normalizeCouponCode } from "@/lib/coupon-code";
import { getPendingRedemptions, removePendingRedemption, savePendingRedemption, type PendingRedemption } from "@/lib/redemption-outbox";

type Lookup = {
  coupon: Coupon;
  raceName: string;
  businessName: string;
  redemptions: Redemption[];
};

export function Scanner({ businessName, businessId }: { businessName: string; businessId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const expenseInputRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef("");
  const purchaseAttempt = useRef<{ code: string; amount: string; key: string } | null>(null);
  const submitting = useRef(false);
  const syncingOutbox = useRef(false);
  const outboxRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(2_000);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [entryMode, setEntryMode] = useState<"idle" | "camera" | "manual">("idle");
  const [manualCode, setManualCode] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRedemptions, setPendingRedemptions] = useState<PendingRedemption[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [wrongBusiness, setWrongBusiness] = useState<{ businessName: string } | null>(null);
  const [exhaustedCoupon, setExhaustedCoupon] = useState<{ businessName: string } | null>(null);

  const lookup = useCallback(async (value: string) => {
    const code = normalizeCouponCode(value);
    setResult(null);
    setError("");
    setNotice("");
    setWrongBusiness(null);
    setExhaustedCoupon(null);
    if (!code) return;
    try {
      const response = await fetch(`/api/bonos/${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 409) {
        setManualCode(code);
        setEntryMode("idle");
        setWrongBusiness({ businessName: data.businessName ?? "otro comercio" });
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "No se pudo consultar el bono.");
      if (data.coupon?.businessId !== businessId) {
        setManualCode(data.coupon?.code ?? code);
        setEntryMode("idle");
        setWrongBusiness({ businessName: data.businessName ?? "otro comercio" });
        return;
      }
      const remainingCents = Number(data.coupon?.amountCents) - Number(data.coupon?.usedCents);
      if (data.coupon?.status === "redeemed" || (Number.isFinite(remainingCents) && remainingCents <= 0)) {
        setManualCode(data.coupon?.code ?? code);
        setEntryMode("idle");
        setExhaustedCoupon({ businessName: data.businessName ?? businessName });
        return;
      }
      setResult(data as Lookup);
      setEntryMode("idle");
      setManualCode(code);
      setAmount("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo consultar el bono.");
    }
  }, [businessId, businessName]);

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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
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
      setEntryMode("camera");
      setStream(cameraStream);
    } catch {
      setEntryMode("idle");
      setError("No se pudo abrir la cámara. Puedes introducir el código manualmente.");
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setEntryMode("idle");
  }

  useEffect(() => {
    if (!stream || entryMode !== "camera" || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => setError("No se pudo abrir la cámara. Puedes introducir el código manualmente."));
  }, [entryMode, stream]);

  useEffect(() => {
    if (!stream) return;
    const activeStream = stream;
    let cancelled = false;
    let frame = 0;
    let lastRead = 0;

    function scanCanvas(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, video: HTMLVideoElement) {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      const fullScale = Math.min(1, 1280 / sourceWidth);
      const fullWidth = Math.max(1, Math.round(sourceWidth * fullScale));
      const fullHeight = Math.max(1, Math.round(sourceHeight * fullScale));
      canvas.width = fullWidth;
      canvas.height = fullHeight;
      context.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, 0, fullWidth, fullHeight);
      const fullResult = jsQR(context.getImageData(0, 0, fullWidth, fullHeight).data, fullWidth, fullHeight, { inversionAttempts: "attemptBoth" });
      if (fullResult) return fullResult.data;

      // The guide is centered over the QR. This second pass preserves more
      // pixels on phones where the complete camera frame is much wider.
      const cropSize = Math.floor(Math.min(sourceWidth, sourceHeight) * 0.78);
      const cropScale = Math.min(1.5, 1200 / cropSize);
      const cropWidth = Math.max(1, Math.round(cropSize * cropScale));
      const cropX = Math.floor((sourceWidth - cropSize) / 2);
      const cropY = Math.floor((sourceHeight - cropSize) / 2);
      canvas.width = cropWidth;
      canvas.height = cropWidth;
      context.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropWidth, cropWidth);
      const cropResult = jsQR(context.getImageData(0, 0, cropWidth, cropWidth).data, cropWidth, cropWidth, { inversionAttempts: "attemptBoth" });
      return cropResult?.data ?? null;
    }

    function tick() {
      if (cancelled || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          const context = canvas.getContext("2d", { willReadFrequently: true });
          const now = performance.now();
          const raw = context && now - lastRead >= 140 ? scanCanvas(context, canvas, video) : null;
          if (raw) lastRead = now;
          if (raw && raw !== lastScan.current) {
            lastScan.current = raw;
            activeStream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setEntryMode("idle");
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

  useEffect(() => {
    if (!result || !canRedeem) return;
    const focusTimer = window.setTimeout(() => expenseInputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [canRedeem, result]);

  useEffect(() => {
    if (entryMode !== "manual") return;
    const focusTimer = window.setTimeout(() => manualInputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [entryMode]);

  function openManualEntry() {
    setError("");
    setNotice("");
    setEntryMode("manual");
  }

  function resetScanner() {
    stopCamera();
    setResult(null);
    setManualCode("");
    setAmount("");
    setError("");
    setNotice("");
  }

  return (
    <section className="scanner" aria-label="Comprobar bono">
      {isMobile ? <>
      {!result && entryMode === "idle" && <div className="scanner-quick-start">
        <button type="button" className="scanner-quick-action scanner-quick-action-camera" onClick={() => void startCamera()}>
          <ScanLine size={29} aria-hidden="true" />
          <span>Escanear código QR</span>
        </button>
        <button type="button" className="scanner-quick-action" onClick={openManualEntry}>
          <Keyboard size={28} aria-hidden="true" />
          <span>Introducir código del bono</span>
        </button>
      </div>}

      {entryMode === "camera" && <div className="scanner-view">
        <span className="scanner-view-label"><Camera size={16} aria-hidden="true" /> Cámara</span>
        <video ref={videoRef} muted playsInline aria-label="Vista de la cámara" />
        <canvas ref={canvasRef} hidden />
        <span className="scan-frame" aria-hidden="true" />
        <button className="camera-stop" onClick={stopCamera} type="button"><CameraOff size={17} aria-hidden="true" /> Cancelar</button>
      </div>}

      {entryMode === "manual" && <div className="scanner-side scanner-manual-entry">
        <div className="scanner-entry-heading"><h2>Introducir código</h2><button type="button" className="scanner-manual-cancel" onClick={resetScanner}>CANCELAR</button></div>
        <form className="manual-form" onSubmit={(event) => { event.preventDefault(); void lookup(manualCode); }}>
          <label htmlFor="manual-code"><Keyboard size={17} aria-hidden="true" /> Código del bono</label>
          <div>
            <input ref={manualInputRef} id="manual-code" className="mono" type="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} required value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="EH-BES-A1B23NQ" />
            <button type="submit" className="button"><ScanLine size={17} aria-hidden="true" /> Buscar</button>
          </div>
        </form>
      </div>}

      {error && <p className="alert scanner-alert" role="alert">{error}</p>}
      {notice && <p className="scanner-success" role="status">{notice}</p>}
      {pendingRedemptions.length > 0 && <div className="scanner-pending" role="status" aria-live="polite">
        <strong>{pendingRedemptions.length} {pendingRedemptions.length === 1 ? "compra pendiente" : "compras pendientes"}</strong>
        <span>Guardadas en este móvil; se enviarán al recuperar la conexión. Mantén abierta la sesión del comercio hasta que se sincronicen.</span>
        {isOnline && <button type="button" onClick={() => void syncOutbox()}>Reintentar envío</button>}
      </div>}
      {result && <div className="scanner-side scanner-result" role="status" aria-live="polite">
        <div className="scanner-balance-stack">
          {result.coupon.usedCents > 0 && <p className="scanner-balance scanner-balance-spent"><Wallet size={20} aria-hidden="true" /> Saldo gastado: <strong>{formatEuros(result.coupon.usedCents)}</strong></p>}
          <p className="scanner-balance scanner-balance-available"><Wallet size={20} aria-hidden="true" /> Saldo disponible: <strong>{formatEuros(balance)}</strong>{pendingForCoupon > 0 && <small> (incluye {formatEuros(pendingForCoupon)} pendiente de sincronizar)</small>}</p>
        </div>
        {canRedeem && result.coupon.businessId === businessId && <form className="scanner-spend" onSubmit={registerExpense}>
          <label htmlFor="expense-amount">Importe de la compra</label>
          <div><input ref={expenseInputRef} id="expense-amount" type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} required /><button type="submit" className="button" disabled={busy}>{busy ? "Guardando..." : "Guardar gasto"}</button></div>
        </form>}
      </div>}
      </> : <div className="scanner-desktop">
        <div className="scanner-view">
          <span className="scanner-view-label"><Camera size={16} aria-hidden="true" /> Cámara</span>
          <video ref={videoRef} muted playsInline aria-label="Vista de la cámara" />
          <canvas ref={canvasRef} hidden />
          <span className="scan-frame" aria-hidden="true" />
          {!stream && <div className="scanner-empty">
            <ScanLine size={54} strokeWidth={1.4} aria-hidden="true" />
            <strong>Escanear código QR</strong>
            <button className="camera-start" onClick={() => void startCamera()} type="button"><Camera size={18} aria-hidden="true" /> Activar cámara</button>
          </div>}
          {stream && <button className="camera-stop" onClick={stopCamera} type="button"><CameraOff size={17} aria-hidden="true" /> Detener cámara</button>}
        </div>
        <div className="scanner-side">
          <p className="eyebrow">{businessName}</p>
          <h2>Comprueba el bono</h2>
          <p>Escanea el QR o introduce el código. Cada compra descuenta únicamente el importe registrado.</p>
          <form className="manual-form" onSubmit={(event) => { event.preventDefault(); void lookup(manualCode); }}>
            <label htmlFor="manual-code"><Keyboard size={17} aria-hidden="true" /> Código del bono</label>
            <div>
              <input ref={manualInputRef} id="manual-code" className="mono" type="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} required value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="EH-BES-A1B23NQ" />
              <button type="submit" className="button"><ScanLine size={17} aria-hidden="true" /> Buscar</button>
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
            <div className="scanner-balance-stack">
              {result.coupon.usedCents > 0 && <p className="scanner-balance scanner-balance-spent"><Wallet size={20} aria-hidden="true" /> Saldo gastado: <strong>{formatEuros(result.coupon.usedCents)}</strong></p>}
              <p className="scanner-balance scanner-balance-available"><Wallet size={20} aria-hidden="true" /> Saldo disponible: <strong>{formatEuros(balance)}</strong>{pendingForCoupon > 0 && <small> (incluye {formatEuros(pendingForCoupon)} pendiente de sincronizar)</small>}</p>
            </div>
            {canRedeem && result.coupon.businessId === businessId && <form className="scanner-spend" onSubmit={registerExpense}>
              <label htmlFor="expense-amount">Importe de la compra</label>
              <div><input ref={expenseInputRef} id="expense-amount" type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} required /><button type="submit" className="button" disabled={busy}>{busy ? "Guardando..." : "Guardar gasto"}</button></div>
            </form>}
          </div>}
        </div>
      </div>}
      {wrongBusiness && <div className="scanner-modal-backdrop" role="presentation">
        <section className="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-wrong-business-title">
          <button type="button" className="scanner-modal-close" onClick={() => setWrongBusiness(null)} aria-label="Cerrar aviso"><X size={20} aria-hidden="true" /></button>
          <AlertTriangle size={34} aria-hidden="true" className="scanner-modal-icon" />
          <h2 id="scanner-wrong-business-title">Bono de otro comercio</h2>
          <p>Este bono está asignado a <strong>{wrongBusiness.businessName}</strong>. Este comercio no puede consultar ni registrar compras con él.</p>
          <button type="button" className="button" onClick={() => setWrongBusiness(null)}>Entendido</button>
        </section>
      </div>}
      {exhaustedCoupon && <div className="scanner-modal-backdrop" role="presentation">
        <section className="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-exhausted-title">
          <button type="button" className="scanner-modal-close" onClick={() => setExhaustedCoupon(null)} aria-label="Cerrar aviso"><X size={20} aria-hidden="true" /></button>
          <AlertTriangle size={34} aria-hidden="true" className="scanner-modal-icon" />
          <h2 id="scanner-exhausted-title">Bono agotado</h2>
          <p>El bono de <strong>{exhaustedCoupon.businessName}</strong> ya no tiene saldo disponible.</p>
          <button type="button" className="button" onClick={() => setExhaustedCoupon(null)}>Entendido</button>
        </section>
      </div>}
    </section>
  );
}
