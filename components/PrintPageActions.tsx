"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";

export function PrintPageActions() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auto") === "0") return;
    let timer: number | undefined;
    let cancelled = false;

    const waitForAssets = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }));
      if (!cancelled) timer = window.setTimeout(() => window.print(), 180);
    };

    void waitForAssets();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="coupon-print-toolbar">
      <p>La vista de impresión utiliza el mismo bono que ves en la web.</p>
      <button type="button" className="button" onClick={() => window.print()}>
        <Printer size={17} aria-hidden="true" /> Imprimir
      </button>
    </div>
  );
}
