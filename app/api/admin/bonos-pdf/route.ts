import qrcode from "qrcode-generator";
import sharp from "sharp";
import { deflateSync } from "node:zlib";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatEuros } from "@/lib/bonos";
import { getBusinessRecord, getRace, listCouponRules, listRaceCoupons } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 25;
const COLUMN_GAP = 11;
const ROW_GAP = 10;
const COLUMNS = 2;
const ROWS = 7;
const PER_PAGE = COLUMNS * ROWS;

function pdfText(value: string) {
  return value.replace(/€/g, "EUR").replace(/[^\x20-\xff]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function pdfColor(hex: string) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((index) => (Number.parseInt(normalized.slice(index, index + 2), 16) / 255).toFixed(3)).join(" ");
}

type CouponToPrint = {
  code: string;
  url: string;
  amountCents: number;
  expiresAt: string;
  businessName: string;
  address: string;
  municipality: string;
  openingHours: string;
};

function drawCoupon(commands: string[], coupon: CouponToPrint, raceId: string, raceColor: string, x: number, y: number, width: number, height: number) {
  const ink = "0.027 0.086 0.149";
  const accent = pdfColor(raceColor || "#ff7417");
  const qr = qrcode(0, "H");
  qr.addData(coupon.url);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const qrSize = 50;
  const quietZone = 3;
  const cell = qrSize / (moduleCount + quietZone * 2);
  const qrX = x + width - qrSize - 12;
  const qrY = y + (height - qrSize) / 2 + 1;
  commands.push("q " + width.toFixed(2) + " 0 0 " + height.toFixed(2) + " " + x.toFixed(2) + " " + y.toFixed(2) + " cm /RaceArt Do Q");
  if (raceId === "bestial") {
    const valueX = x + width * 0.59;
    const valueY = y + height * 0.39;
    commands.push("1 0.67 0.09 rg", valueX.toFixed(2) + " " + valueY.toFixed(2) + " " + (width * 0.24).toFixed(2) + " " + (height * 0.22).toFixed(2) + " re f", "0.027 0.086 0.149 rg");
    commands.push("BT /F2 12 Tf " + (valueX + 4).toFixed(2) + " " + (valueY + 13).toFixed(2) + " Td (" + pdfText(formatEuros(coupon.amountCents)) + ") Tj ET");
    commands.push("BT /F2 4 Tf " + (valueX + 6).toFixed(2) + " " + (valueY + 5).toFixed(2) + " Td (BONO CANJEABLE) Tj ET");
  }
  commands.push(
    "1 1 1 rg",
    (x + 6).toFixed(2) + " " + (y + 6).toFixed(2) + " " + (width - 12).toFixed(2) + " 40 re f",
    (qrX - 4).toFixed(2) + " " + (y + 4).toFixed(2) + " " + (qrSize + 8).toFixed(2) + " " + (height - 8).toFixed(2) + " re f",
    accent + " rg",
    (x + 6).toFixed(2) + " " + (y + 6).toFixed(2) + " 3 40 re f",
    ink + " rg",
  );
  const textY = (offset: number) => (y + offset).toFixed(2);
  const textX = (offset: number) => (x + offset).toFixed(2);
  const max = Math.max(24, Math.floor((qrX - x - 112) / 2.8));
  const trim = (value: string, length: number) => value.length > length ? value.slice(0, length - 1) + "…" : value;
  const addressAlreadyHasMunicipality = coupon.address.toLocaleLowerCase().endsWith(coupon.municipality.toLocaleLowerCase());
  const address = trim(coupon.address + (addressAlreadyHasMunicipality ? "" : ", " + coupon.municipality), max);
  const hours = trim(coupon.openingHours, max + 6);
  const merchant = trim(coupon.businessName, Math.floor((qrX - x - 112) / 4));
  commands.push(
    "BT /F2 14 Tf " + textX(17) + " " + textY(32) + " Td (" + pdfText(formatEuros(coupon.amountCents)) + ") Tj ET",
    "BT /F1 5 Tf " + textX(17) + " " + textY(22) + " Td (" + pdfText("BONO CANJEABLE") + ") Tj ET",
    "BT /F2 8 Tf " + textX(106) + " " + textY(33) + " Td (" + pdfText(merchant) + ") Tj ET",
    "BT /F1 6 Tf " + textX(106) + " " + textY(22) + " Td (" + pdfText(address) + ") Tj ET",
    "BT /F1 6 Tf " + textX(106) + " " + textY(13) + " Td (" + pdfText("Horario: " + hours) + ") Tj ET",
    "BT /F2 6 Tf " + textX(106) + " " + textY(5) + " Td (" + pdfText("Válido hasta " + formatDate(coupon.expiresAt)) + ") Tj ET",
  );
  const modules: string[] = [];
  for (let row = 0; row < moduleCount; row++) {
    for (let column = 0; column < moduleCount; column++) {
      if (!qr.isDark(row, column)) continue;
      const moduleX = qrX + (column + quietZone) * cell;
      const moduleY = qrY + qrSize - (row + quietZone + 1) * cell;
      modules.push(moduleX.toFixed(2) + " " + moduleY.toFixed(2) + " " + cell.toFixed(2) + " " + cell.toFixed(2) + " re");
    }
  }
  commands.push("0 0 0 rg", modules.join(" ") + " f");
  commands.push("BT /F2 5 Tf " + (qrX - 2).toFixed(2) + " " + (y + 8).toFixed(2) + " Td (" + pdfText(coupon.code) + ") Tj ET");
}

function drawBack(commands: string[], rules: string[], raceId: string, x: number, y: number, width: number, height: number) {
  commands.push("q " + width.toFixed(2) + " 0 0 " + height.toFixed(2) + " " + x.toFixed(2) + " " + y.toFixed(2) + " cm /RaceBack Do Q");
  if (raceId === "bestial") return;
  const panelX = x + 6;
  const panelY = y + height * 0.27;
  const panelWidth = width * 0.56;
  const panelHeight = height * 0.68;
  commands.push("1 1 1 rg", panelX.toFixed(2) + " " + panelY.toFixed(2) + " " + panelWidth.toFixed(2) + " " + panelHeight.toFixed(2) + " re f", "0.027 0.086 0.149 rg");
  commands.push("BT /F2 7 Tf " + (panelX + 8).toFixed(2) + " " + (panelY + panelHeight - 11).toFixed(2) + " Td (Información y condiciones de uso) Tj ET");
  const maxChars = Math.floor((panelWidth - 29) / 2.7);
  const wrapped = rules.flatMap((rule, ruleIndex) => {
    const words = rule.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if (line && (line + " " + word).length > maxChars) {
        lines.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    return lines.map((line, lineIndex) => ({ line, prefix: lineIndex === 0 ? (ruleIndex + 1) + ". " : "  " }));
  });
  const rowGap = Math.min(7.2, (panelHeight - 25) / Math.max(1, wrapped.length));
  wrapped.slice(0, 12).forEach(({ line, prefix }, index) => {
    const baseline = panelY + panelHeight - 22 - index * rowGap;
    commands.push("BT /F1 5 Tf " + (panelX + 8).toFixed(2) + " " + baseline.toFixed(2) + " Td (" + pdfText(prefix + line) + ") Tj ET");
  });
}

async function makePdf(title: string, coupons: CouponToPrint[], rules: string[], raceId: string, raceColor: string, duplex: boolean) {
  const fs = await import("node:fs/promises");
  const artPath = process.cwd() + "/public/branding/vouchers/" + raceId + "-front.jpg";
  const sourcePath = await fs.access(artPath).then(() => artPath).catch(() => process.cwd() + "/public/branding/vouchers/bimbache-front.jpg");
  const { data: artPixels, info: artInfo } = await sharp(sourcePath).resize({ width: 1500 }).jpeg({ quality: 84 }).toBuffer({ resolveWithObject: true });
  const backPath = process.cwd() + "/public/branding/vouchers/" + raceId + "-back.jpg";
  const backSourcePath = await fs.access(backPath).then(() => backPath).catch(() => process.cwd() + "/public/branding/vouchers/bimbache-back.jpg");
  const { data: backPixels, info: backInfo } = await sharp(backSourcePath).resize({ width: 1500 }).jpeg({ quality: 84 }).toBuffer({ resolveWithObject: true });
  const logoSvg = await fs.readFile(process.cwd() + "/public/branding/cabildo-el-hierro.svg");
  const { data: logoPixels, info: logoInfo } = await sharp(logoSvg).resize({ width: 42, height: 55, fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).greyscale().threshold(220).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const compressedLogo = deflateSync(logoPixels);
  const cardWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - COLUMN_GAP) / COLUMNS;
  const cardHeight = (PAGE_HEIGHT - PAGE_MARGIN * 2 - ROW_GAP * (ROWS - 1)) / ROWS;
  const pages = Math.ceil(coupons.length / PER_PAGE);
  const pageCommands: string[] = [];
  const backPageCommands: string[] = [];
  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    const commands = [
      "0.02 0.23 0.55 rg",
      "BT /F2 10 Tf " + PAGE_MARGIN + " " + (PAGE_HEIGHT - 17) + " Td (" + pdfText(title) + ") Tj ET",
      "BT /F1 7 Tf " + (PAGE_WIDTH - PAGE_MARGIN - 48) + " " + (PAGE_HEIGHT - 17) + " Td (" + (pageIndex + 1) + " / " + pages + ") Tj ET",
    ];
    coupons.slice(pageIndex * PER_PAGE, (pageIndex + 1) * PER_PAGE).forEach((coupon, index) => {
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = PAGE_MARGIN + column * (cardWidth + COLUMN_GAP);
      const y = PAGE_HEIGHT - PAGE_MARGIN - (row + 1) * cardHeight - row * ROW_GAP;
      drawCoupon(commands, coupon, raceId, raceColor, x, y, cardWidth, cardHeight);
    });
    pageCommands.push(commands.join("\n"));
    if (duplex) {
      const reverseCommands: string[] = [];
      coupons.slice(pageIndex * PER_PAGE, (pageIndex + 1) * PER_PAGE).forEach((_, index) => {
        const column = index % COLUMNS;
        const row = Math.floor(index / COLUMNS);
        const x = PAGE_MARGIN + column * (cardWidth + COLUMN_GAP);
        const y = PAGE_HEIGHT - PAGE_MARGIN - (row + 1) * cardHeight - row * ROW_GAP;
        drawBack(reverseCommands, rules, raceId, x, y, cardWidth, cardHeight);
      });
      backPageCommands.push(reverseCommands.join("\n"));
    }
  }
  const allPageCommands = duplex ? pageCommands.flatMap((front, index) => [front, backPageCommands[index]]) : pageCommands;
  const objects: Buffer[] = [];
  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /Duplex /" + (duplex ? "DuplexFlipLongEdge" : "Simplex") + " >> >>", "latin1");
  const pageRefs = Array.from({ length: allPageCommands.length }, (_, index) => (8 + index * 2) + " 0 R").join(" ");
  objects[2] = Buffer.from("<< /Type /Pages /Kids [" + pageRefs + "] /Count " + allPageCommands.length + " >>", "latin1");
  objects[3] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1");
  objects[4] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1");
  objects[5] = Buffer.concat([Buffer.from("<< /Type /XObject /Subtype /Image /Width " + artInfo.width + " /Height " + artInfo.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + artPixels.length + " >>\nstream\n", "latin1"), artPixels, Buffer.from("\nendstream", "latin1")]);
  objects[6] = Buffer.concat([Buffer.from("<< /Type /XObject /Subtype /Image /Width " + logoInfo.width + " /Height " + logoInfo.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length " + compressedLogo.length + " >>\nstream\n", "latin1"), compressedLogo, Buffer.from("\nendstream", "latin1")]);
  objects[7] = Buffer.concat([Buffer.from("<< /Type /XObject /Subtype /Image /Width " + backInfo.width + " /Height " + backInfo.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + backPixels.length + " >>\nstream\n", "latin1"), backPixels, Buffer.from("\nendstream", "latin1")]);
  allPageCommands.forEach((content, index) => {
    const pageId = 8 + index * 2;
    const stream = Buffer.from(content, "latin1");
    objects[pageId] = Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PAGE_WIDTH + " " + PAGE_HEIGHT + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /RaceArt 5 0 R /Logo 6 0 R /RaceBack 7 0 R >> >> /Contents " + (pageId + 1) + " 0 R >>", "latin1");
    objects[pageId + 1] = Buffer.concat([Buffer.from("<< /Length " + stream.length + " >>\nstream\n", "latin1"), stream, Buffer.from("\nendstream", "latin1")]);
  });
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [0];
  let offset = parts[0].length;
  for (let id = 1; id < objects.length; id++) {
    const object = Buffer.concat([Buffer.from(id + " 0 obj\n", "latin1"), objects[id], Buffer.from("\nendobj\n", "latin1")]);
    offsets[id] = offset;
    parts.push(object);
    offset += object.length;
  }
  const xrefOffset = offset;
  let xref = "xref\n0 " + objects.length + "\n0000000000 65535 f \n";
  for (let id = 1; id < objects.length; id++) xref += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
  parts.push(Buffer.from(xref + "trailer\n<< /Size " + objects.length + " /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF", "latin1"));
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
  const rawCoupons = await listRaceCoupons(raceId);
  if (!rawCoupons.length) return new Response("La carrera todavía no tiene bonos emitidos.", { status: 404 });
  const businesses = new Map<string, ReturnType<typeof getBusinessRecord>>();
  const coupons = await Promise.all(rawCoupons.map(async (coupon) => {
    if (!businesses.has(coupon.businessId)) businesses.set(coupon.businessId, getBusinessRecord(coupon.businessId));
    const business = await businesses.get(coupon.businessId);
    if (!business) return undefined;
    return {
      code: coupon.code,
      url: baseUrl + "/bono/" + encodeURIComponent(coupon.code),
      amountCents: coupon.amountCents,
      expiresAt: coupon.expiresAt,
      businessName: business.name,
      address: business.address,
      municipality: business.municipality,
      openingHours: business.openingHours,
    };
  }));
  const printable = coupons.filter((coupon): coupon is NonNullable<typeof coupon> => Boolean(coupon));
  if (!printable.length) return new Response("No se encontraron comercios asignados a los bonos.", { status: 404 });
  const rules = await listCouponRules();
  const file = await makePdf("Bonos · " + race.name, printable, rules, race.id, race.color, mode === "dos-caras");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"bonos-" + race.id + "-" + mode + ".pdf\"",
      "Cache-Control": "private, no-store",
    },
  });
}
