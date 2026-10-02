"use client";

import { AlertCircle, LoaderCircle, Printer, X } from "lucide-react";
import { useEffect, useState } from "react";

type PrintMode = "una-cara" | "dos-caras";
type ModalState = { mode: PrintMode; status: "confirm" | "loading" | "error"; message?: string } | null;

export function PrintCouponsLinks({ raceId }: { raceId: string }) {
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => () => {
    document.body.style.overflow = "";
  }, []);

  function openModal(mode: PrintMode) {
    if (modal?.status === "loading") return;
    document.body.style.overflow = "hidden";
    setModal({ mode, status: "confirm" });
  }

  function closeModal() {
    if (modal?.status === "loading") return;
    document.body.style.overflow = "";
    setModal(null);
  }

  async function generatePdf() {
    if (!modal || modal.status !== "confirm") return;
    const { mode } = modal;
    setModal({ mode, status: "loading" });
    try {
      const response = await fetch(`/api/admin/bonos-pdf?carrera=${encodeURIComponent(raceId)}&modo=${mode}`, {
        credentials: "same-origin",
        headers: { Accept: "application/pdf" },
      });
      if (!response.ok) throw new Error((await response.text()) || "No se pudo generar el PDF.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `bonos-${raceId}-${mode}.pdf`;
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      document.body.style.overflow = "";
      setModal(null);
    } catch (error) {
      setModal({ mode, status: "error", message: error instanceof Error ? error.message : "No se pudo generar el PDF." });
    }
  }

  const action = (mode: PrintMode, label: string) => (
    <button type="button" onClick={() => openModal(mode)} disabled={modal?.status === "loading"}>
      <Printer size={15} aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <>
      {action("una-cara", "A una cara")}
      {action("dos-caras", "A dos caras")}
      {modal && (
        <div className="admin-print-modal-backdrop" role="presentation">
          <section className="admin-print-modal" role="dialog" aria-modal="true" aria-labelledby="admin-print-modal-title">
            {modal.status !== "loading" && (
              <button type="button" className="admin-print-modal-close" onClick={closeModal} aria-label="Cerrar">
                <X size={19} aria-hidden="true" />
              </button>
            )}
            {modal.status === "error" ? <AlertCircle size={30} aria-hidden="true" className="admin-print-modal-icon admin-print-modal-icon--error" /> : <LoaderCircle size={30} aria-hidden="true" className={`admin-print-modal-icon${modal.status === "loading" ? " is-spinning" : ""}`} />}
            <h2 id="admin-print-modal-title">{modal.status === "error" ? "No se pudo generar el PDF" : modal.status === "loading" ? "Generando el PDF" : "Preparar impresión"}</h2>
            {modal.status === "error" ? <p>{modal.message}</p> : <p>Es un proceso lento. Ten paciencia: puede tardar varios minutos en generarse.</p>}
            {modal.status === "loading" && <p className="admin-print-modal-progress" aria-live="polite">No cierres esta página mientras termina el proceso.</p>}
            <div className="admin-print-modal-actions">
              {modal.status === "confirm" && <button type="button" className="button subtle" onClick={closeModal}>Cancelar</button>}
              {modal.status === "confirm" && <button type="button" className="button" onClick={() => void generatePdf()}><Printer size={16} aria-hidden="true" />Generar PDF</button>}
              {modal.status === "error" && <button type="button" className="button" onClick={closeModal}>Cerrar</button>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
