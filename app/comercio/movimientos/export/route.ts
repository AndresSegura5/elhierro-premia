import { deflateRawSync } from "node:zlib";
import { requireMerchant } from "@/lib/auth";
import { formatDateTime, formatEuros } from "@/lib/bonos";
import { getBusinessRecord, listBusinessRedemptions } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportRow = {
  date: string;
  code: string;
  amount: number;
  balance: number;
};

function xmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]!);
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const digit = (value - 1) % 26;
    name = String.fromCharCode(65 + digit) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(data: Buffer) {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function makeZip(files: Array<{ name: string; contents: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const source = Buffer.from(file.contents, "utf8");
    const compressed = deflateRawSync(source);
    const crc = crc32(source);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function makeXlsx(shopName: string, rows: ExportRow[]) {
  const data: Array<Array<string | number>> = [
    ["Tienda", shopName],
    ["Fecha", "Código del bono", "Importe de compra (€)", "Saldo restante (€)"],
    ...rows.map((row) => [row.date, row.code, row.amount / 100, row.balance / 100]),
  ];
  const sheetRows = data.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      const style = rowIndex === 1 ? ' s="1"' : rowIndex > 1 && colIndex > 1 ? ' s="2"' : "";
      if (typeof value === "number") return `<c r="${ref}"${style}><v>${value.toFixed(2)}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:D${data.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="4" width="24" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A2:D${data.length}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Movimientos" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;€&quot; #,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Montserrat"/></font><font><b/><sz val="11"/><name val="Montserrat"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return makeZip([
    { name: "[Content_Types].xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", contents: workbook },
    { name: "xl/_rels/workbook.xml.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", contents: worksheet },
    { name: "xl/styles.xml", contents: styles },
  ]);
}

function pdfText(value: string) {
  return value.replace(/€/g, "\u0080").replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdf(shopName: string, rows: ExportRow[]) {
  const rowsPerPage = 30;
  const pages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const commands: string[] = [];
  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    const pageRows = rows.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    const lines = [
      `BT /F2 20 Tf 48 548 Td (${pdfText("MOVIMIENTOS DEL COMERCIO")}) Tj ET`,
      `BT /F1 12 Tf 48 526 Td (${pdfText(shopName)}) Tj ET`,
      `BT /F1 10 Tf 620 526 Td (${pdfText(`Página ${pageIndex + 1} de ${pages}`)}) Tj ET`,
      "0.9 w 48 510 m 794 510 l S",
      `BT /F2 10 Tf 48 490 Td (${pdfText("FECHA")}) Tj ET`,
      `BT /F2 10 Tf 260 490 Td (${pdfText("CÓDIGO DEL BONO")}) Tj ET`,
      `BT /F2 10 Tf 535 490 Td (${pdfText("COMPRA")}) Tj ET`,
      `BT /F2 10 Tf 660 490 Td (${pdfText("SALDO")}) Tj ET`,
      "0.5 w 48 480 m 794 480 l S",
    ];
    pageRows.forEach((row, index) => {
      const y = 460 - index * 14;
      lines.push(`BT /F1 9 Tf 48 ${y} Td (${pdfText(row.date)}) Tj ET`);
      lines.push(`BT /F1 9 Tf 260 ${y} Td (${pdfText(row.code)}) Tj ET`);
      lines.push(`BT /F1 9 Tf 535 ${y} Td (${pdfText(formatEuros(row.amount))}) Tj ET`);
      lines.push(`BT /F1 9 Tf 660 ${y} Td (${pdfText(formatEuros(row.balance))}) Tj ET`);
    });
    if (!pageRows.length) lines.push(`BT /F1 11 Tf 48 460 Td (${pdfText("Todavía no hay movimientos registrados.")}) Tj ET`);
    commands.push(lines.join("\n"));
  }

  const objects: Buffer[] = [];
  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1");
  const pageRefs = Array.from({ length: pages }, (_, index) => `${5 + index * 2} 0 R`).join(" ");
  objects[2] = Buffer.from(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages} >>`, "latin1");
  objects[3] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1");
  objects[4] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1");
  commands.forEach((content, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    const stream = Buffer.from(content, "latin1");
    objects[pageId] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`, "latin1");
    objects[contentId] = Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream", "latin1")]);
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
  const session = await requireMerchant();
  const business = await getBusinessRecord(session.businessId!);
  if (!business) return new Response("Comercio no encontrado.", { status: 404 });

  const rows = (await listBusinessRedemptions(business.id)).map((entry) => ({
    date: formatDateTime(entry.createdAt),
    code: entry.code,
    amount: entry.amountCents,
    balance: entry.balanceAfterCents,
  }));
  const format = new URL(request.url).searchParams.get("format");
  const safeName = business.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  if (format === "xlsx") {
    const file = makeXlsx(business.name, rows);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="movimientos-${safeName}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (format === "pdf") {
    const file = makePdf(business.name, rows);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="movimientos-${safeName}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response("Formato no válido.", { status: 400 });
}
