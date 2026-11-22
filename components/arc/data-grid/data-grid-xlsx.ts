import {
  colLetter,
  defaultAggregate,
  isIsoDay,
  type DataGridColumn,
  type DataGridExportNode,
  type DataGridRow,
} from "./data-grid-model";

export interface DataGridXlsxOptions {
  sheetName?: string;
  freezeColumns?: number;
  totals?: boolean;
  widths?: Record<string, number>;
}

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoToExcelSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((utc - epoch) / 86400000);
}

// CRC32 table for ZIP STORE
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + size;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = offset + centralSize + endRecord.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(endRecord, pos);
  return out;
}

function isGroupNode(
  node: DataGridExportNode,
): node is { label: string; children: DataGridExportNode[] } {
  return "children" in node && Array.isArray(node.children);
}

function styleIndexForCol(col: DataGridColumn, bold: boolean): number {
  // Style map:
  // 0: default text, 1: bold text
  // 2: number, 3: bold number
  // 4: currency, 5: bold currency
  // 6: percent, 7: bold percent
  // 8: date, 9: bold date
  const b = bold ? 1 : 0;
  if (col.type === "number") return 2 + b;
  if (col.type === "currency") return 4 + b;
  if (col.type === "percent") return 6 + b;
  if (col.type === "date") return 8 + b;
  return b;
}

function subtotalFnCode(agg: ReturnType<typeof defaultAggregate>): number | null {
  switch (agg) {
    case "sum":
      return 9;
    case "average":
      return 1;
    case "min":
      return 5;
    case "max":
      return 4;
    case "count":
      return 3;
    default:
      return null;
  }
}

export function toXlsx(
  columns: DataGridColumn[],
  nodes: DataGridExportNode[],
  options: DataGridXlsxOptions = {},
): Uint8Array {
  const sheetName = (options.sheetName ?? "Sheet1")
    .replace(/[\\/*?:[\]]/g, " ")
    .slice(0, 31) || "Sheet1";
  const freezeCols = Math.max(0, options.freezeColumns ?? 0);
  const showTotals = options.totals ?? true;

  const rowXmls: string[] = [];
  let rowNum = 1;

  // Header row
  const headerCells = columns
    .map((c, ci) => {
      const ref = `${colLetter(ci)}${rowNum}`;
      return `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEsc(c.label)}</t></is></c>`;
    })
    .join("");
  rowXmls.push(`<row r="${rowNum}">${headerCells}</row>`);
  rowNum++;

  const firstDataRow = rowNum;

  const emitRow = (row: DataGridRow, outlineLevel: number) => {
    const r = rowNum++;
    const cells = columns
      .map((col, ci) => {
        const ref = `${colLetter(ci)}${r}`;
        const v = row[col.key];
        if (v === null || v === undefined || v === "") return "";
        const s = styleIndexForCol(col, false);
        if (col.type === "date" && typeof v === "string" && isIsoDay(v)) {
          return `<c r="${ref}" s="${s}"><v>${isoToExcelSerial(v)}</v></c>`;
        }
        if (typeof v === "number" && Number.isFinite(v)) {
          const val = col.type === "percent" ? v / 100 : v;
          return `<c r="${ref}" s="${s}"><v>${val}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr" s="${s}"><is><t>${xmlEsc(String(v))}</t></is></c>`;
      })
      .filter(Boolean)
      .join("");
    const levelAttr = outlineLevel > 0 ? ` outlineLevel="${outlineLevel}"` : "";
    rowXmls.push(`<row r="${r}"${levelAttr}>${cells}</row>`);
  };

  const emitNodes = (list: DataGridExportNode[], level: number) => {
    for (const node of list) {
      if (isGroupNode(node)) {
        const groupRow = rowNum++;
        const childStart = rowNum;
        emitNodes(node.children, level + 1);
        const childEnd = rowNum - 1;

        const cells: string[] = [];
        columns.forEach((col, ci) => {
          const ref = `${colLetter(ci)}${groupRow}`;
          if (ci === 0) {
            cells.push(
              `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEsc(node.label)}</t></is></c>`,
            );
          } else if (childEnd >= childStart) {
            const agg = defaultAggregate(col);
            const fn = subtotalFnCode(agg);
            if (fn !== null) {
              const s = styleIndexForCol(col, true);
              const colRef = colLetter(ci);
              cells.push(
                `<c r="${ref}" s="${s}"><f>SUBTOTAL(${fn},${colRef}${childStart}:${colRef}${childEnd})</f></c>`,
              );
            }
          }
        });
        const levelAttr = level > 0 ? ` outlineLevel="${level}"` : "";
        rowXmls.push(`<row r="${groupRow}"${levelAttr}>${cells.join("")}</row>`);
      } else {
        emitRow(node, level);
      }
    }
  };

  emitNodes(nodes, 0);
  const lastDataRow = rowNum - 1;

  if (showTotals && lastDataRow >= firstDataRow) {
    const r = rowNum++;
    const cells: string[] = [];
    columns.forEach((col, ci) => {
      const ref = `${colLetter(ci)}${r}`;
      const agg = defaultAggregate(col);
      const fn = subtotalFnCode(agg);
      if (ci === 0 && fn === null) {
        cells.push(`<c r="${ref}" t="inlineStr" s="1"><is><t>Total</t></is></c>`);
      } else if (fn !== null) {
        const s = styleIndexForCol(col, true);
        const colRef = colLetter(ci);
        cells.push(
          `<c r="${ref}" s="${s}"><f>SUBTOTAL(${fn},${colRef}${firstDataRow}:${colRef}${lastDataRow})</f></c>`,
        );
      }
    });
    rowXmls.push(`<row r="${r}">${cells.join("")}</row>`);
  }

  const colsXml = columns
    .map((c, ci) => {
      const px = options.widths?.[c.key] ?? c.width ?? 140;
      const w = Math.max(8, Math.round((px / 7) * 10) / 10);
      return `<col min="${ci + 1}" max="${ci + 1}" width="${w}" customWidth="1"/>`;
    })
    .join("");

  const topLeftCell = `${colLetter(freezeCols)}2`;
  const paneAttrs =
    freezeCols > 0
      ? `xSplit="${freezeCols}" ySplit="1" topLeftCell="${topLeftCell}" activePane="bottomRight" state="frozen"`
      : `ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ${paneAttrs}/></sheetView></sheetViews>
  <cols>${colsXml}</cols>
  <sheetData>${rowXmls.join("")}</sheetData>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="4">
    <numFmt numFmtId="164" formatCode="#,##0"/>
    <numFmt numFmtId="165" formatCode="$#,##0"/>
    <numFmt numFmtId="166" formatCode="0.0%"/>
    <numFmt numFmtId="167" formatCode="mmm d, yyyy"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="166" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="167" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEsc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const enc = new TextEncoder();
  return buildZip([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rootRels) },
    { name: "xl/workbook.xml", data: enc.encode(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(workbookRels) },
    { name: "xl/styles.xml", data: enc.encode(stylesXml) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml) },
  ]);
}
