"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ticket } from "lucide-react";
export function BonoLookup() {
  const [code, setCode] = useState("");
  const router = useRouter();
  return (
    <section className="lookup-band">
      <div className="lookup-title">
        <Ticket size={25} />
        <div>
          <h2>¿Ya tienes tu bono?</h2>
          <p>Tu comercio, ubicación y condiciones, en un mismo lugar.</p>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim())
            router.push(
              `/bono/${encodeURIComponent(code.trim().toUpperCase())}`,
            );
        }}
      >
        <label htmlFor="lookup-code">Código del bono</label>
        <div>
          <input
            id="lookup-code"
            required
            className="mono"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="EH-BES-A1B23NQ"
          />
          <button className="button" type="submit">
            Consultar <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}
