import qrcode from "qrcode-generator";
import sharp from "sharp";
import { deflateSync } from "node:zlib";
import { requireAdmin } from "@/lib/auth";
import { getRace, listRaceCoupons } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 32;
const COLUMN_GAP = 18;
const ROW_GAP = 16;
const COLUMNS = 2;
const ROWS = 3;
const PER_PAGE = COLUMNS * ROWS;

function pdfText(value: string) {
  return value.replace(/[^\x20-\xff]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function roundedSquare(x: number, y: number, size: number, radius: number) {
  const k = radius * 0.55228475;
  const point = (value: number) => value.toFixed(2);
  return [
    `${point(x + radius)} ${point(y)} m`,
    `${point(x + size - radius)} ${point(y)} l`,
    `${point(x + size - radius + k)} ${point(y)} ${point(x + size)} ${point(y + radius - k)} ${point(x + size)} ${point(y + radius)} c`,
    `${point(x + size)} ${point(y + size - radius)} l`,
    `${point(x + size)} ${point(y + size - radius + k)} ${point(x + size - radius + k)} ${point(y + size)} ${point(x + size - radius)} ${point(y + size)} c`,
    `${point(x + radius)} ${point(y + size)} l`,
    `${point(x + radius - k)} ${point(y + size)} ${point(x)} ${point(y + size - radius + k)} ${point(x)} ${point(y + size - radius)} c`,
    `${point(x)} ${point(y + radius)} l`,
    `${point(x)} ${point(y + radius - k)} ${point(x + radius - k)} ${point(y)} ${point(x + radius)} ${point(y)} c h`,
  ].join(" ");
}

async function makePdf(title: string, coupons: Array<{ code: string; url: string }>, duplex: boolean) {
  const logoSvg = await import("node:fs/promises").then(({ readFile }) =>
    readFile(`${process.cwd()}/public/branding/cabildo-el-hierro.svg`)
  );
  const { data: logoPixels, info: logoInfo } = await sharp(logoSvg)
    .resize({ width: 42, height: 55, fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .greyscale()
    .threshold(220)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const compressedLogo = deflateSync(logoPixels);
  const cardWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - COLUMN_GAP) / COLUMNS;
  const cardHeight = (PAGE_HEIGHT - PAGE_MARGIN * 2 - ROW_GAP * (ROWS - 1)) / ROWS;
  const pages = Math.ceil(coupons.length / PER_PAGE);
  const pageCommands: string[] = [];

  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    const commands = [
      "0.02 0.23 0.55 rg",
      `BT /F2 12 Tf ${PAGE_MARGIN} ${PAGE_HEIGHT - 23} Td (${pdfText(title)}) Tj ET`,
      `BT /F1 8 Tf ${PAGE_WIDTH - PAGE_MARGIN - 62} ${PAGE_HEIGHT - 22} Td (${pageIndex + 1} / ${pages}) Tj ET`,
    ];
    const pageCoupons = coupons.slice(pageIndex * PER_PAGE, (pageIndex + 1) * PER_PAGE);

    pageCoupons.forEach(({ code, url }, index) => {
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = PAGE_MARGIN + column * (cardWidth + COLUMN_GAP);
      const y = PAGE_HEIGHT - PAGE_MARGIN - (row + 1) * cardHeight - row * ROW_GAP;
      const qr = qrcode(0, "H");
      qr.addData(url);
      qr.make();
      const moduleCount = qr.getModuleCount();
      const qrSize = 151;
      const quietZone = 4;
      const cell = qrSize / (moduleCount + quietZone * 2);
      const qrX = x + (cardWidth - qrSize) / 2;
      const qrY = y + cardHeight - qrSize - 22;

      commands.push(
        "0.88 0.91 0.95 RG 0.75 w",
        `${x} ${y} ${cardWidth} ${cardHeight} re S`,
        "1 0.42 0.08 rg",
        `${x} ${y + cardHeight - 2} ${cardWidth} 2 re f`,
        "1 1 1 rg",
        `${qrX} ${qrY} ${qrSize} ${qrSize} re f`,
        "0 0 0 rg",
      );

      const modules: string[] = [];
      for (let qrRow = 0; qrRow < moduleCount; qrRow++) {
        for (let qrColumn = 0; qrColumn < moduleCount; qrColumn++) {
          if (!qr.isDark(qrRow, qrColumn)) continue;
          const moduleX = qrX + (qrColumn + quietZone) * cell;
          const moduleY = qrY + qrSize - (qrRow + quietZone + 1) * cell;
          const inFinder = (qrRow < 8 && qrColumn < 8)
            || (qrRow < 8 && qrColumn >= moduleCount - 8)
            || (qrRow >= moduleCount - 8 && qrColumn < 8);
          modules.push(inFinder
            ? `${moduleX.toFixed(2)} ${moduleY.toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re`
            : roundedSquare(moduleX, moduleY, cell, cell * 0.32));
        }
      }
      commands.push(`${modules.join(" ")} f`);
      const logoX = qrX + (qrSize - logoInfo.width) / 2;
      const logoY = qrY + (qrSize - logoInfo.height) / 2;
      commands.push(`q ${logoInfo.width} 0 0 ${logoInfo.height} ${logoX.toFixed(2)} ${logoY.toFixed(2)} cm /Logo Do Q`);
      commands.push(
        `BT /F2 10 Tf ${x + 12} ${y + 17} Td (${pdfText(code)}) Tj ET`,
        `BT /F1 7 Tf ${x + 12} ${y + 6} Td (${pdfText("Consulta este bono en comercios adheridos")}) Tj ET`,
      );
    });
    pageCommands.push(commands.join("\n"));
  }

  const objects: Buffer[] = [];
  objects[1] = Buffer.from(`<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /Duplex /${duplex ? "DuplexFlipLongEdge" : "Simplex"} >> >>`, "latin1");
  const pageRefs = Array.from({ length: pages }, (_, index) => `${6 + index * 2} 0 R`).join(" ");
  objects[2] = Buffer.from(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages} >>`, "latin1");
  objects[3] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1");
  objects[4] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1");
  objects[5] = Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logoInfo.width} /Height ${logoInfo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressedLogo.length} >>\nstream\n`, "latin1"),
    compressedLogo,
    Buffer.from("\nendstream", "latin1"),
  ]);
  pageCommands.forEach((content, index) => {
    const pageId = 6 + index * 2;
    const stream = Buffer.from(content, "latin1");
    objects[pageId] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${pageId + 1} 0 R >>`, "latin1");
    objects[pageId + 1] = Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream", "latin1")]);
  });

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [0];
  let offset = parts[0].length;
  for (let id = 1; id < objects.length; id++) {
    const object = Buffer.concat([Buffer.from(`${id} 0 obj\n`, "latin1"), objects[id], Buffer.from("\nendobj\n", "latin1")]);
    offsets[id] = offset;
    parts.push(object);
    offset += object.length;
  }
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`, "latin1"));
  return Buffer.concat(parts);
}

export async function GET(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const raceId = params.get("carrera") ?? "";
  const mode = params.get("modo");
  if (mode !== "una-cara" && mode !== "dos-caras") return new Response("Elige impresión a una o dos caras.", { status: 400 });

  const race = await getRace(raceId);
  if (!race) return new Response("Carrera no encontrada.", { status: 404 });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const coupons = (await listRaceCoupons(raceId)).map((coupon) => ({ code: coupon.code, url: `${baseUrl}/bono/${encodeURIComponent(coupon.code)}` }));
  if (!coupons.length) return new Response("La carrera todavía no tiene bonos emitidos.", { status: 404 });

  const file = await makePdf(`Bonos · ${race.name}`, coupons, mode === "dos-caras");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bonos-${race.id}-${mode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
