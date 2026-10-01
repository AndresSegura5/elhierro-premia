"use client";
import { useCallback, useId, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { QrCode, Search, Smartphone } from "lucide-react";
import { normalizeCouponCode } from "@/lib/coupon-code";

const CouponQrScanner = dynamic(() => import("./CouponQrScanner").then((module) => module.CouponQrScanner), { ssr: false });

export function BonoLookupInline() {
  const [code, setCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputId = useId();
  const router = useRouter();
  const closeScanner = useCallback(() => setScannerOpen(false), []);
  const openCoupon = useCallback((value: string) => {
    const normalized = normalizeCouponCode(value);
    if (!normalized) return;
    setScannerOpen(false);
    setCode(normalized);
    router.push(`/bono/${encodeURIComponent(normalized)}`);
  }, [router]);
  return (
    <div className="bono-lookup-inline">
      <Smartphone className="bono-lookup-deco bono-lookup-deco--phone" size={138} strokeWidth={1.15} aria-hidden="true" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          openCoupon(code);
        }}
      >
        <h2>Buscador de bono</h2>
        <label className="bono-lookup-instruction" htmlFor={inputId}>Introduce tu código o escanea el QR</label>
        <div>
          <div className="bono-lookup-field">
            <Search size={22} aria-hidden="true" />
            <input
              id={inputId}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Introduce tu código o escanea el QR"
              aria-label="Código del bono"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="button" className="bono-lookup-scan" aria-label="Escanear el QR del bono con la cámara" aria-haspopup="dialog" title="Escanear QR" onClick={() => setScannerOpen(true)}><Smartphone size={27} strokeWidth={1.8} aria-hidden="true" /></button>
          </div>
          <button className="button" type="submit">
            Consultar
          </button>
        </div>
      </form>
      <QrCode className="bono-lookup-deco bono-lookup-deco--qr" size={138} strokeWidth={1.15} aria-hidden="true" />
      {scannerOpen && <CouponQrScanner onScan={openCoupon} onClose={closeScanner} />}
    </div>
  );
}
