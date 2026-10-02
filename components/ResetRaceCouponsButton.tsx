"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Archive, X } from "lucide-react";
import { deleteRaceCoupons } from "@/app/admin/actions";

export function ResetRaceCouponsButton({ raceId, raceName, couponCount, redemptionCount }: {
  raceId: string;
  raceName: string;
  couponCount: number;
  redemptionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.classList.add("has-business-modal");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("has-business-modal");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <>
    <button className="button subtle race-reset-trigger" type="button" onClick={() => { setUnderstood(false); setOpen(true); }}>
      <Archive size={16} aria-hidden="true" />Archivar bonos
    </button>
    {open && <div className="business-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="business-modal race-reset-modal" role="dialog" aria-modal="true" aria-labelledby="race-reset-title">
        <header className="business-modal-heading">
          <div className="panel-title"><AlertTriangle size={21} aria-hidden="true" /><h2 id="race-reset-title">Archivar bonos de {raceName}</h2></div>
          <button className="business-modal-close" type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <p className="race-reset-warning">Se archivarán los <strong>{couponCount.toLocaleString("es-ES")} bonos y sus códigos QR</strong>. Los códigos actuales dejarán de funcionar, pero el superusuario conservará su registro y el de sus <strong>{redemptionCount.toLocaleString("es-ES")} movimientos de gasto</strong>. Después tendrás que volver a emitir el lote completo desde la configuración de la carrera.</p>
        <form action={deleteRaceCoupons} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="raceId" value={raceId} />
          <label className="race-reset-acknowledgement"><input type="checkbox" name="understood" value="true" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /><span>Entiendo que los bonos se archivarán y que los códigos actuales dejarán de ser válidos.</span></label>
          <div className="business-modal-actions">
            <button className="button subtle" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="button business-delete-confirm-button" type="submit" disabled={!understood}><Archive size={16} aria-hidden="true" />Archivar bonos</button>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
