"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Search, Smartphone } from "lucide-react";

export function BonoLookupInline() {
  const [code, setCode] = useState("");
  const router = useRouter();
  return (
    <div className="bono-lookup-inline">
      <Smartphone className="bono-lookup-deco bono-lookup-deco--phone" size={138} strokeWidth={1.15} aria-hidden="true" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim())
            router.push(`/bono/${encodeURIComponent(code.trim().toUpperCase())}`);
        }}
      >
        <h2>Buscador de bono</h2>
        <div>
          <label className="bono-lookup-field">
            <Search size={22} aria-hidden="true" />
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Introduce tu código QR"
              aria-label="Código del bono"
            />
          </label>
          <button className="button" type="submit">
            Consultar
          </button>
        </div>
      </form>
      <QrCode className="bono-lookup-deco bono-lookup-deco--qr" size={138} strokeWidth={1.15} aria-hidden="true" />
    </div>
  );
}
