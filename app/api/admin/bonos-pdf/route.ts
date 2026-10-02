import qrcode from "qrcode-generator";
import sharp from "sharp";
import { deflateSync } from "node:zlib";
import { access } from "node:fs/promises";
import { chromium } from "playwright-core";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatEuros } from "@/lib/bonos";
import { getBusinessRecord, getRace, listCouponRules, listRaceCoupons } from "@/lib/store";
import { createPrintToken } from "@/lib/print-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findBrowser() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
    process.platform === "win32" ? "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" : undefined,
    process.platform === "win32" ? "C:/Program Files/Microsoft/Edge/Application/msedge.exe" : undefined,
    process.platform === "win32" ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : undefined,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (await access(candidate).then(() => true).catch(() => false)) return candidate;
  }
  return null;
}

async function renderPrintPdf(url: string) {
  const browser = await findBrowser();
  if (!browser) throw new Error("No se ha encontrado Chrome o Chromium para generar la impresión.");
  const browserInstance = await chromium.launch({
    executablePath: browser,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browserInstance.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const qrReady = await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((image) => image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        })));
      const deadline = Date.now() + 120_000;
      let qrImagesReady = false;
      while (Date.now() < deadline) {
        const qrFrames = Array.from(document.querySelectorAll(".coupon-voucher-print-face .qr-frame"));
        qrImagesReady = qrFrames.length > 0 && qrFrames.every((frame) => Boolean(frame.querySelector("img[src]")));
        if (qrImagesReady) break;
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      return qrImagesReady;
    });
    if (!qrReady) throw new Error("Los códigos QR no terminaron de renderizarse.");
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  } finally {
    await browserInstance.close();
  }
}

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

function svgText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapSvgText(value: string, maxChars: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

async function renderBestialFront(base: Buffer, coupon: CouponToPrint, logoSvg: Buffer) {
  const qr = qrcode(0, "H");
  qr.addData(coupon.url);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const frameX = 1887;
  const frameY = 428;
  const frameSize = 225;
  const quietZone = 3;
  const cell = frameSize / (moduleCount + quietZone * 2);
  const modules: string[] = [];
  for (let row = 0; row < moduleCount; row++) {
    for (let column = 0; column < moduleCount; column++) {
      if (!qr.isDark(row, column)) continue;
      const moduleX = frameX + (column + quietZone) * cell;
      const moduleY = frameY + (row + quietZone) * cell;
      modules.push(`<rect x="${moduleX.toFixed(2)}" y="${moduleY.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`);
    }
  }
  const addressAlreadyHasMunicipality = coupon.address.toLocaleLowerCase().endsWith(coupon.municipality.toLocaleLowerCase());
  const address = coupon.address + (addressAlreadyHasMunicipality ? "" : ", " + coupon.municipality);
  const merchantLines = wrapSvgText(coupon.businessName, 22);
  const addressLines = wrapSvgText(address, 29);
  const hoursLines = wrapSvgText(coupon.openingHours, 29);
  const logoData = logoSvg.toString("base64");
  const textLines = (lines: string[], x: number, y: number, size: number, lineHeight: number) => lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" class="detail" font-size="${size}">${svgText(line)}</text>`).join("");
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2172" height="724" viewBox="0 0 2172 724">
    <style>.merchant{font:700 40px Arial,sans-serif;fill:#fff}.label{font:700 28px Arial,sans-serif;fill:#fff}.detail{font:700 28px Arial,sans-serif;fill:#fff}</style>
    <line x1="1438" y1="466" x2="1815" y2="466" stroke="#9aa0a4" stroke-width="2"/>
    ${merchantLines.map((line, index) => `<text x="1448" y="${458 + index * 38}" class="merchant">${svgText(line)}</text>`).join("")}
    <text x="1448" y="490" class="label">Inicio</text>
    ${textLines(wrapSvgText(formatDate(coupon.startDate), 28), 1448, 518, 27, 30)}
    <text x="1448" y="552" class="label">Caduca</text>
    ${textLines(wrapSvgText(formatDate(coupon.expiresAt), 28), 1448, 580, 27, 30)}
    ${textLines(addressLines, 1448, 620, 26, 28)}
    ${textLines(hoursLines, 1448, 684, 26, 28)}
    <rect x="1865" y="428" width="270" height="270" fill="#fff"/>
    <g fill="#000" shape-rendering="crispEdges">${modules.join("")}</g>
    <image href="data:image/svg+xml;base64,${logoData}" x="1970" y="511" width="58" height="58" preserveAspectRatio="xMidYMid meet"/>
    <rect x="1865" y="698" width="270" height="26" fill="#fff"/>
    <text x="2000" y="717" text-anchor="middle" style="font:700 20px Arial,sans-serif;fill:#071626">${svgText(coupon.code)}</text>
  </svg>`, "utf8");
  return sharp(base).composite([{ input: overlay }]).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
}

type CouponToPrint = {
  code: string;
  url: string;
  amountCents: number;
  startDate: string;
  expiresAt: string;
  businessName: string;
  address: string;
  municipality: string;
  openingHours: string;
};

function drawCoupon(commands: string[], coupon: CouponToPrint, raceId: string, raceColor: string, x: number, y: number, width: number, height: number, artName = "RaceArt", renderDynamic = true) {
  const ink = "0.027 0.086 0.149";
  const accent = pdfColor(raceColor || "#ff7417");
  const qr = qrcode(0, "H");
  qr.addData(coupon.url);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const bestial = raceId === "bestial";
  const qrSize = bestial ? Math.max(30, width * 0.124) : 50;
  const quietZone = 3;
  const cell = qrSize / (moduleCount + quietZone * 2);
  const qrX = bestial ? x + width * (1865 / 2172) : x + width - qrSize - 12;
  const qrY = bestial
    ? y + height - height * (428 / 724) - qrSize
    : y + (height - qrSize) / 2 + 1;
  commands.push("q " + width.toFixed(2) + " 0 0 " + height.toFixed(2) + " " + x.toFixed(2) + " " + y.toFixed(2) + " cm /" + artName + " Do Q");
  if (!renderDynamic) return;
  if (bestial) {
    const businessX = x + width * (1438 / 2172);
    const text = (font: number, color: string, px: number, py: number, value: string) => {
      const baseline = y + height - height * (py / 724);
      commands.push(color + " rg", "BT /F2 " + font + " Tf " + (x + width * (px / 2172)).toFixed(2) + " " + baseline.toFixed(2) + " Td (" + pdfText(value) + ") Tj ET");
    };
    const wrap = (value: string, maxChars: number) => {
      const words = value.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        if (line && (line + " " + word).length > maxChars) {
          lines.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
      if (line) lines.push(line);
      return lines;
    };
    const textLines = (font: number, color: string, px: number, py: number, value: string, maxChars: number, lineStep = 15) => {
      wrap(value, maxChars).slice(0, 2).forEach((line, index) => text(font, color, px, py + index * lineStep, line));
    };
    commands.push(
      "1 1 1 rg",
      (qrX - 2).toFixed(2) + " " + (qrY - 2).toFixed(2) + " " + (qrSize + 4).toFixed(2) + " " + (qrSize + 4).toFixed(2) + " re f",
      "1 1 1 rg",
      (qrX - 2).toFixed(2) + " " + (qrY - 9).toFixed(2) + " " + (qrSize + 4).toFixed(2) + " 8 re f",
      "0.65 0.65 0.65 RG",
      "0.45 w",
      businessX.toFixed(2) + " " + (y + height - height * (466 / 724)).toFixed(2) + " m " + (x + width * (1815 / 2172)).toFixed(2) + " " + (y + height - height * (466 / 724)).toFixed(2) + " l S",
    );
    textLines(4.2, "1 1 1", 1448, 458, coupon.businessName, 21, 12);
    text(2.8, "1 1 1", 1448, 490, "Inicio");
    textLines(2.8, "1 1 1", 1448, 505, formatDate(coupon.startDate), 28, 11);
    text(2.8, "1 1 1", 1448, 535, "Caduca");
    textLines(2.8, "1 1 1", 1448, 550, formatDate(coupon.expiresAt), 28, 11);
    const addressAlreadyHasMunicipality = coupon.address.toLocaleLowerCase().endsWith(coupon.municipality.toLocaleLowerCase());
    const address = coupon.address + (addressAlreadyHasMunicipality ? "" : ", " + coupon.municipality);
    textLines(2.8, "1 1 1", 1448, 583, address, 30, 11);
    textLines(2.8, "1 1 1", 1448, 617, coupon.openingHours, 30, 11);
  } else {
    commands.push(
      "1 1 1 rg",
      (x + 6).toFixed(2) + " " + (y + 6).toFixed(2) + " " + (width - 12).toFixed(2) + " 40 re f",
      (qrX - 4).toFixed(2) + " " + (y + 4).toFixed(2) + " " + (qrSize + 8).toFixed(2) + " " + (height - 8).toFixed(2) + " re f",
      accent + " rg",
      (x + 6).toFixed(2) + " " + (y + 6).toFixed(2) + " 3 40 re f",
      ink + " rg",
    );
  }
  const textY = (offset: number) => (y + offset).toFixed(2);
  const textX = (offset: number) => (x + offset).toFixed(2);
  const max = Math.max(24, Math.floor((qrX - x - 112) / 2.8));
  const trim = (value: string, length: number) => value.length > length ? value.slice(0, length - 1) + "…" : value;
  const addressAlreadyHasMunicipality = coupon.address.toLocaleLowerCase().endsWith(coupon.municipality.toLocaleLowerCase());
  const address = trim(coupon.address + (addressAlreadyHasMunicipality ? "" : ", " + coupon.municipality), max);
  const hours = trim(coupon.openingHours, max + 6);
  const merchant = trim(coupon.businessName, Math.floor((qrX - x - 112) / 4));
  if (!bestial) commands.push(
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
  if (bestial) {
    const logoSize = qrSize * 0.25;
    commands.push("q " + logoSize.toFixed(2) + " 0 0 " + logoSize.toFixed(2) + " " + (qrX + (qrSize - logoSize) / 2).toFixed(2) + " " + (qrY + (qrSize - logoSize) / 2).toFixed(2) + " cm /Logo Do Q");
  }
  const codeY = bestial ? qrY - 5 : y + 8;
  commands.push("BT /F2 " + (bestial ? "3.2" : "5") + " Tf " + (qrX - 2).toFixed(2) + " " + codeY.toFixed(2) + " Td (" + pdfText(coupon.code) + ") Tj ET");
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
  const artPath = process.cwd() + "/public/branding/vouchers/" + (raceId === "bestial" ? "bestial-front-final.png" : raceId + "-front.jpg");
  const sourcePath = await fs.access(artPath).then(() => artPath).catch(() => process.cwd() + "/public/branding/vouchers/bimbache-front.jpg");
  const sourceBuffer = await fs.readFile(sourcePath);
  const { data: artPixels, info: artInfo } = await sharp(sourcePath).resize({ width: 1500 }).jpeg({ quality: 84 }).toBuffer({ resolveWithObject: true });
  const backPath = process.cwd() + "/public/branding/vouchers/" + raceId + "-back.jpg";
  const backSourcePath = await fs.access(backPath).then(() => backPath).catch(() => process.cwd() + "/public/branding/vouchers/bimbache-back.jpg");
  const { data: backPixels, info: backInfo } = await sharp(backSourcePath).resize({ width: 1500 }).jpeg({ quality: 84 }).toBuffer({ resolveWithObject: true });
  const logoSvg = await fs.readFile(process.cwd() + "/public/branding/cabildo-el-hierro.svg");
  const renderedArt = new Map<string, { data: Buffer; info: { width: number; height: number } }>();
  const artNames = new Map<string, string>();
  if (raceId === "bestial") {
    for (const [index, coupon] of coupons.entries()) {
      const name = "RaceArt" + index;
      renderedArt.set(name, await renderBestialFront(sourceBuffer, coupon, logoSvg));
      artNames.set(coupon.code, name);
    }
  }
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
      drawCoupon(commands, coupon, raceId, raceColor, x, y, cardWidth, cardHeight, raceId === "bestial" ? artNames.get(coupon.code) : "RaceArt", raceId !== "bestial");
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
  let nextObjectId = 5;
  const artResources: string[] = [];
  const pageRefsStart = nextObjectId + (raceId === "bestial" ? renderedArt.size : 1) + 2;
  const pageRefs = Array.from({ length: allPageCommands.length }, (_, index) => (pageRefsStart + index * 2) + " 0 R").join(" ");
  objects[2] = Buffer.from("<< /Type /Pages /Kids [" + pageRefs + "] /Count " + allPageCommands.length + " >>", "latin1");
  objects[3] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1");
  objects[4] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1");
  if (raceId === "bestial") {
    renderedArt.forEach((image, name) => {
      const imageId = nextObjectId++;
      artResources.push("/" + name + " " + imageId + " 0 R");
      objects[imageId] = Buffer.concat([Buffer.from("<< /Type /XObject /Subtype /Image /Width " + image.info.width + " /Height " + image.info.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + image.data.length + " >>\nstream\n", "latin1"), image.data, Buffer.from("\nendstream", "latin1")]);
    });
  } else {
    artResources.push("/RaceArt " + nextObjectId + " 0 R");
    objects[nextObjectId++] = Buffer.concat([Buffer.from("<< /Type /XObject /Subtype /Image /Width " + artInfo.width + " /Height " + artInfo.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + artPixels.length + " >>\nstream\n", "latin1"), artPixels, Buffer.from("\nendstream", "latin1")]);
  }
  const logoId = nextObjectId++;
  objects[logoId] = Buffer.concat([Buffer.from("<< /Type /XObject /Subtype /Image /Width " + logoInfo.width + " /Height " + logoInfo.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length " + compressedLogo.length + " >>\nstream\n", "latin1"), compressedLogo, Buffer.from("\nendstream", "latin1")]);
  const backId = nextObjectId++;
  objects[backId] = Buffer.concat([Buffer.from("<< /Type /XObject /Subtype /Image /Width " + backInfo.width + " /Height " + backInfo.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + backPixels.length + " >>\nstream\n", "latin1"), backPixels, Buffer.from("\nendstream", "latin1")]);
  allPageCommands.forEach((content, index) => {
    const pageId = pageRefsStart + index * 2;
    const stream = Buffer.from(content, "latin1");
    objects[pageId] = Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PAGE_WIDTH + " " + PAGE_HEIGHT + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << " + artResources.join(" ") + " /Logo " + logoId + " 0 R /RaceBack " + backId + " 0 R >> >> /Contents " + (pageId + 1) + " 0 R >>", "latin1");
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
  const rawCoupons = await listRaceCoupons(raceId);
  if (!rawCoupons.length) return new Response("La carrera todavía no tiene bonos emitidos.", { status: 404 });
  const printUrl = new URL("/admin/carreras/impresion", new URL(request.url).origin);
  printUrl.searchParams.set("carrera", raceId);
  printUrl.searchParams.set("modo", mode);
  printUrl.searchParams.set("token", createPrintToken(raceId, mode));
  printUrl.searchParams.set("auto", "0");
  let file: Buffer;
  try {
    file = await renderPrintPdf(printUrl.toString());
  } catch (error) {
    console.error("No se pudo generar el PDF desde la vista de impresión", error);
    return new Response("No se pudo generar el PDF de impresión.", { status: 500 });
  }
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"bonos-" + race.id + "-" + mode + ".pdf\"",
      "Cache-Control": "private, no-store",
    },
  });
}
