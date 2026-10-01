"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type Props = {
  code: string;
  url?: string;
};

let blackCabildoLogoPromise: Promise<string> | undefined;

function getBlackCabildoLogo() {
  blackCabildoLogoPromise ??= (async () => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = "/branding/cabildo-el-hierro.svg";
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar el logotipo del Cabildo.");
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
      const opacity = Math.max(0, Math.min(1, (248 - luminance) / 40));
      pixels.data[index] = 0;
      pixels.data[index + 1] = 0;
      pixels.data[index + 2] = 0;
      pixels.data[index + 3] = Math.round(pixels.data[index + 3] * opacity);
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
  })();

  return blackCabildoLogoPromise;
}

export function QRCodeCard({ code, url }: Props) {
  const [qr, setQr] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;

    async function createQr() {
      const { default: QRCodeStyling } = await import("qr-code-styling");
      const qrUrl = url ?? `${window.location.origin}/bono/${encodeURIComponent(code)}`;
      const blackCabildoLogo = await getBlackCabildoLogo();
      const styledQr = new QRCodeStyling({
        width: 720,
        height: 720,
        type: "canvas",
        data: qrUrl,
        image: blackCabildoLogo,
        margin: 26,
        qrOptions: {
          errorCorrectionLevel: "H"
        },
        dotsOptions: {
          color: "#000000",
          type: "rounded"
        },
        cornersSquareOptions: {
          color: "#000000",
          type: "extra-rounded"
        },
        cornersDotOptions: {
          color: "#000000",
          type: "dot"
        },
        backgroundOptions: {
          color: "#ffffff"
        },
        imageOptions: {
          crossOrigin: "anonymous",
          hideBackgroundDots: true,
          imageSize: 0.3,
          margin: 8
        }
      });
      const blob = await styledQr.getRawData("png");
      if (!(blob instanceof Blob)) return;

      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setQr(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }

    createQr().catch(() => {
      if (!cancelled) setQr("");
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [code, url]);

  return (
    <article className="qr-ticket">
      <div className="qr-frame">
        {qr ? <img src={qr} alt="Código QR del bono" /> : <div className="qr-placeholder" />}
      </div>
      <a download={`${code}.png`} href={qr} className="button subtle" aria-disabled={!qr}>
        <Download size={17} aria-hidden="true" />
        Descargar
      </a>
    </article>
  );
}
