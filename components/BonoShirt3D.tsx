"use client";
import { createElement, useEffect, useState } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "camera-controls"?: boolean;
          "auto-rotate"?: boolean;
          "auto-rotate-delay"?: number;
          "rotation-per-second"?: string;
          "disable-zoom"?: boolean;
          "interaction-prompt"?: string;
          exposure?: string;
          "shadow-intensity"?: string;
          "camera-orbit"?: string;
          "field-of-view"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export function BonoShirt3D({ className }: { className?: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import("@google/model-viewer").then(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className={className} aria-hidden="true" />;
  }

  return createElement("model-viewer", {
    className,
    src: "/models/bono-shirt-final.glb",
    alt: "Camiseta de carrera con dorsal y bono de 30 euros, en 3D",
    "camera-controls": false,
    "auto-rotate": false,
    "disable-zoom": true,
    "interaction-prompt": "none",
    exposure: "1.1",
    "shadow-intensity": "0.8",
    "camera-orbit": "0deg 75deg 105%",
    "field-of-view": "28deg",
  } as React.HTMLAttributes<HTMLElement>);
}
