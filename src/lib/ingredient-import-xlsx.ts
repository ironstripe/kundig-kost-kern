/**
 * Browser-only workbook helpers: generate the fixed KundiCalc template and
 * read an uploaded workbook safely. Loaded lazily (dynamic import) so the
 * Excel library never enters the SSR bundle.
 *
 * Security: cells are reduced to plain strings. Formulas are never evaluated
 * (rows containing formulas are rejected), hyperlinks/rich text are flattened,
 * macros/links are ignored by construction.
 */
import {
  BASE_UNIT_VALUES,
  GUIDE_SHEET,
  IMPORT_SHEET,
  MAX_ROWS,
  PACKAGE_UNIT_VALUES,
  REQUIRED_COLUMNS,
  TEMPLATE_COLUMNS,
  VALUES_SHEET,
  YES_NO_VALUES,
  type RawRow,
  type TemplateColumn,
} from "@/lib/ingredient-import-schema";

async function excel() {
  const mod = await import("exceljs");
  return (mod.default ?? mod) as typeof import("exceljs");
}

const FONT = { name: "Arial", size: 10 };

export async function buildTemplate(): Promise<Blob> {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "KundiCalc";

  // --- Sheet 3 first so validation formulas can reference it -----------------
  const values = wb.addWorksheet(VALUES_SHEET);
  values.columns = [
    { header: "Gebindeeinheit", key: "pu", width: 18 },
    { header: "Basiseinheit", key: "bu", width: 18 },
    { header: "Eigene_Produktion", key: "yn", width: 20 },
  ];
  const maxLen = Math.max(PACKAGE_UNIT_VALUES.length, BASE_UNIT_VALUES.length, YES_NO_VALUES.length);
  for (let i = 0; i < maxLen; i++) values.addRow([PACKAGE_UNIT_VALUES[i] ?? null, BASE_UNIT_VALUES[i] ?? null, YES_NO_VALUES[i] ?? null]);
  values.getRow(1).font = { ...FONT, bold: true };
  values.eachRow((r) => r.eachCell((c) => { c.font = c.font?.bold ? { ...FONT, bold: true } : FONT; }));

  // --- Sheet 1: import sheet --------------------------------------------------
  const ws = wb.addWorksheet(IMPORT_SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
  const widths: Record<TemplateColumn, number> = {
    Zutatenname: 32, Kategorie: 16, Lieferant: 20, Gebindemenge: 14, Gebindeeinheit: 16, Gebindebezeichnung: 22,
    Gebindepreis_CHF: 18, Basiseinheit: 14, Preisstand: 14, Eigene_Produktion: 18, Notiz: 36,
  };
  ws.columns = TEMPLATE_COLUMNS.map((c) => ({ key: c, width: widths[c] }));
  ws.addTable({
    name: "KundiCalcImport",
    ref: "A1",
    headerRow: true,
    style: { theme: "TableStyleLight9", showRowStripes: true },
    columns: TEMPLATE_COLUMNS.map((c) => ({ name: c, filterButton: true })),
    rows: [TEMPLATE_COLUMNS.map(() => null)],
  });
  const header = ws.getRow(1);
  header.height = 22;
  TEMPLATE_COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    const required = REQUIRED_COLUMNS.includes(c);
    cell.font = { ...FONT, bold: true, color: { argb: required ? "FF9C2A00" : "FF1F2937" } };
    cell.alignment = { vertical: "middle" };
    if (required) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE7D9" } };
  });
  ws.autoFilter = { from: "A1", to: `K1` };

  const last = MAX_ROWS + 1;
  const listOf = (col: "A" | "B" | "C", n: number) => [`'${VALUES_SHEET}'!$${col}$2:$${col}$${n + 1}`];
  const dv = (ws as unknown as { dataValidations: { add: (range: string, v: object) => void } }).dataValidations;
  dv.add(`D2:D${last}`, { type: "decimal", operator: "greaterThan", formulae: [0], showErrorMessage: true, errorTitle: "Gebindemenge", error: "Bitte eine positive Zahl eingeben." });
  dv.add(`E2:E${last}`, { type: "list", allowBlank: true, formulae: listOf("A", PACKAGE_UNIT_VALUES.length), showErrorMessage: true, error: "Erlaubt: kg, g, l, ml, Stück" });
  dv.add(`G2:G${last}`, { type: "decimal", operator: "greaterThanOrEqual", formulae: [0], showErrorMessage: true, errorTitle: "Gebindepreis_CHF", error: "Bitte eine Zahl ohne Währungszeichen eingeben." });
  dv.add(`H2:H${last}`, { type: "list", allowBlank: true, formulae: listOf("B", BASE_UNIT_VALUES.length), showErrorMessage: true, error: "Erlaubt: g, ml, Stück" });
  dv.add(`J2:J${last}`, { type: "list", allowBlank: true, formulae: listOf("C", YES_NO_VALUES.length), showErrorMessage: true, error: "Erlaubt: Ja oder Nein" });
  ws.getColumn("A").numFmt = "@";
  ws.getColumn("I").numFmt = "@";
  ws.getColumn("D").numFmt = "0.###";
  ws.getColumn("G").numFmt = "0.00";

  // --- Sheet 2: instructions --------------------------------------------------
  const guide = wb.addWorksheet(GUIDE_SHEET);
  guide.getColumn(1).width = 110;
  const lines: (string | { bold: true; text: string })[] = [
    { bold: true, text: "KundiCalc – Zutatenimport (Anleitung)" },
    "",
    "• Pro Zeile genau eine Zutat im Blatt «KundiCalc Import» erfassen.",
    "• Spaltennamen nicht ändern, keine Spalten löschen, keine verbundenen Zellen verwenden.",
    "• Pflichtfelder (farbig markiert): Zutatenname, Kategorie, Gebindemenge, Gebindeeinheit, Gebindepreis_CHF, Basiseinheit, Eigene_Produktion.",
    "• Optional: Lieferant, Gebindebezeichnung, Preisstand, Notiz.",
    "• Gebindemenge: positive Zahl (z. B. 1 oder 2.5). Gebindepreis_CHF: reine Zahl ohne «CHF» oder Währungszeichen (z. B. 30 oder 12.50).",
    "• Preisstand: Datum im ISO-Format JJJJ-MM-TT (z. B. 2026-08-01). Leer = Importdatum.",
    "• Gebindeeinheit: kg, g, l, ml, Stück. Basiseinheit: g, ml, Stück.",
    "  Zulässige Kombinationen: kg/g → g, l/ml → ml, Stück → Stück. Gewicht, Volumen und Stück dürfen nicht gemischt werden.",
    "• Eigene_Produktion: Ja oder Nein.",
    "• Formeln, Makros und Links werden nicht ausgewertet. Bitte nur Werte eintragen.",
    "",
    { bold: true, text: "Abgleich mit bestehenden Zutaten" },
    "• Zutaten werden über den Namen abgeglichen (Gross-/Kleinschreibung, Leerzeichen und einfache Satzzeichen werden ignoriert, Umlaute bleiben erhalten).",
    "• Exakte Treffer werden zur Aktualisierung vorgeschlagen, wahrscheinliche Treffer müssen manuell zugeordnet werden, neue Namen werden neu angelegt.",
    "• Bestätigte Preise werden nie ohne ausdrückliche Zustimmung pro Zeile überschrieben.",
    "",
    { bold: true, text: "Ablauf in KundiCalc" },
    "• Zutaten & EK → «Excel importieren» → Datei wählen → «Datei prüfen» → Vorschau korrigieren → «Import verbindlich ausführen».",
    "• Es werden keine Daten importiert, bevor die Vorschau ausdrücklich bestätigt wurde.",
    "",
    { bold: true, text: "Beispielzeile (nur zur Veranschaulichung – kein bestätigter Preis!)" },
  ];
  for (const l of lines) {
    const row = guide.addRow([typeof l === "string" ? l : l.text]);
    row.getCell(1).font = typeof l === "string" ? FONT : { ...FONT, bold: true, size: 11 };
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
  }
  const exHeader = guide.addRow([...TEMPLATE_COLUMNS]);
  exHeader.font = { ...FONT, bold: true };
  const ex = guide.addRow(["Forellenfilet", "Fisch", "Beispiel-Lieferant", 1, "kg", "1-kg-Beutel", 30, "g", "2026-08-01", "Ja", "Beispielwert – Annahme, kein bestätigter Preis"]);
  ex.font = { ...FONT, italic: true };
  ex.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7CC" } }; });
  guide.addRow(["Hinweis: Diese Beispielzeile steht bewusst im Blatt «Anleitung» und wird nicht importiert."]).getCell(1).font = { ...FONT, italic: true };
  for (let i = 2; i <= TEMPLATE_COLUMNS.length; i++) guide.getColumn(i).width = 16;

  wb.worksheets.sort((a, b) => a.id - b.id);
  const order = [IMPORT_SHEET, GUIDE_SHEET, VALUES_SHEET];
  // ExcelJS keeps insertion order; re-order by setting orderNo
  wb.worksheets.forEach((s) => { (s as unknown as { orderNo: number }).orderNo = order.indexOf(s.name); });
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export class WorkbookError extends Error {
  constructor(message: string) { super(message); this.name = "WorkbookError"; }
}

export type ParsedWorkbook = {
  rows: RawRow[];
  warnings: string[];
  totalDataRows: number;
};

function pad(n: number) { return String(n).padStart(2, "0"); }

/** Reduce an ExcelJS cell value to a plain string. Throws on formulas. */
function cellText(v: unknown, col: TemplateColumn, rowNo: number): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 1000);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("formula" in o || "sharedFormula" in o) throw new WorkbookError(`Zeile ${rowNo}, Spalte ${col}: Formeln werden nicht unterstützt. Bitte nur Werte eintragen.`);
    if ("richText" in o && Array.isArray(o["richText"])) return (o["richText"] as { text: string }[]).map((t) => t.text).join("").slice(0, 1000);
    if ("text" in o) return cellText(o["text"], col, rowNo);
    if ("result" in o) return cellText(o["result"], col, rowNo);
    if ("error" in o) throw new WorkbookError(`Zeile ${rowNo}, Spalte ${col}: Zellfehler «${String(o["error"])}».`);
  }
  return String(v).slice(0, 1000);
}

/**
 * Strip parts we never use (comments, drawings, VML, tables) and make
 * relationship targets relative. Files saved by other tools (LibreOffice,
 * openpyxl) otherwise trip the reader, and removing these parts also means
 * embedded drawings/comments are never interpreted.
 */
async function sanitizeWorkbookZip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const dropTypes = /\/(comments|vmlDrawing|drawing|table|pivotTable|ctrlProp|oleObject|vbaProject|customProperty)$/;
  for (const name of Object.keys(zip.files)) {
    if (/vbaProject\.bin$/i.test(name)) throw new WorkbookError("Arbeitsmappen mit Makros werden nicht unterstützt. Bitte als .xlsx ohne Makros speichern.");
    if (!name.endsWith(".rels")) continue;
    const file = zip.file(name);
    if (!file) continue;
    let xml = await file.async("string");
    const dir = name.replace(/_rels\/[^/]+$/, "").split("/").filter(Boolean);
    xml = xml.replace(/<Relationship\b[^>]*\/>/g, (rel) => {
      const type = /Type="([^"]+)"/.exec(rel)?.[1] ?? "";
      if (dropTypes.test(type)) return "";
      return rel.replace(/Target="\/([^"]+)"/, (_m, t: string) => {
        const to = t.split("/");
        let i = 0;
        while (i < dir.length && i < to.length - 1 && dir[i] === to[i]) i++;
        return `Target="${"../".repeat(dir.length - i)}${to.slice(i).join("/")}"`;
      });
    });
    zip.file(name, xml);
  }
  for (const name of Object.keys(zip.files)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
    const file = zip.file(name);
    if (!file) continue;
    let xml = await file.async("string");
    xml = xml
      .replace(/<legacyDrawing\b[^>]*\/>/g, "")
      .replace(/<legacyDrawingHF\b[^>]*\/>/g, "")
      .replace(/<drawing\b[^>]*\/>/g, "")
      .replace(/<tableParts\b[^>]*\/>/g, "")
      .replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/g, "")
      .replace(/<controls\b[^>]*>[\s\S]*?<\/controls>/g, "")
      .replace(/<oleObjects\b[^>]*>[\s\S]*?<\/oleObjects>/g, "");
    zip.file(name, xml);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

export async function readWorkbook(file: File): Promise<ParsedWorkbook> {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  let buf: ArrayBuffer;
  try { buf = await file.arrayBuffer(); } catch { throw new WorkbookError("Die Datei konnte nicht gelesen werden."); }
  const sig = new Uint8Array(buf.slice(0, 4));
  const isZip = sig[0] === 0x50 && sig[1] === 0x4b;
  const isOle = sig[0] === 0xd0 && sig[1] === 0xcf;
  if (isOle) throw new WorkbookError("Die Datei ist passwortgeschützt oder im alten .xls-Format. Bitte als ungeschützte .xlsx speichern.");
  if (!isZip) throw new WorkbookError("Die Datei ist keine gültige XLSX-Arbeitsmappe.");
  try {
    await wb.xlsx.load(await sanitizeWorkbookZip(buf));
  } catch {
    throw new WorkbookError("Die Arbeitsmappe konnte nicht gelesen werden (beschädigt oder passwortgeschützt).");
  }
  const ws = wb.getWorksheet(IMPORT_SHEET);
  if (!ws) throw new WorkbookError(`Das Blatt «${IMPORT_SHEET}» wurde nicht gefunden. Bitte die KundiCalc-Vorlage verwenden und den Blattnamen nicht ändern.`);
  if (ws.model.merges && ws.model.merges.length > 0) throw new WorkbookError("Das Importblatt enthält verbundene Zellen. Bitte Verbindungen aufheben.");

  const warnings: string[] = [];
  const headerRow = ws.getRow(1);
  const colIndex = new Map<TemplateColumn, number>();
  const seen = new Set<string>();
  const unknown: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = cellText(cell.value, "Zutatenname", 1).trim();
    if (!raw) return;
    if (seen.has(raw)) throw new WorkbookError(`Die Spalte «${raw}» kommt mehrfach vor.`);
    seen.add(raw);
    if ((TEMPLATE_COLUMNS as readonly string[]).includes(raw)) colIndex.set(raw as TemplateColumn, colNumber);
    else unknown.push(raw);
  });
  const missing = REQUIRED_COLUMNS.filter((c) => !colIndex.has(c));
  if (missing.length) throw new WorkbookError(`Pflichtspalten fehlen: ${missing.join(", ")}. Spaltennamen müssen exakt der Vorlage entsprechen.`);
  const missingOptional = TEMPLATE_COLUMNS.filter((c) => !colIndex.has(c));
  if (missingOptional.length) warnings.push(`Optionale Spalten fehlen und bleiben leer: ${missingOptional.join(", ")}.`);
  if (unknown.length) warnings.push(`Unbekannte Spalten werden ignoriert: ${unknown.join(", ")}.`);

  const rows: RawRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: Partial<Record<TemplateColumn, string>> = {};
    let any = false;
    for (const [col, idx] of colIndex) {
      const t = cellText(row.getCell(idx).value, col, rowNumber);
      if (t.trim()) any = true;
      cells[col] = t;
    }
    if (any) rows.push({ row: rowNumber, cells });
  });
  if (rows.length > MAX_ROWS) throw new WorkbookError(`Die Datei enthält ${rows.length} Zutatenzeilen. Maximal erlaubt sind ${MAX_ROWS}.`);
  if (rows.length === 0) throw new WorkbookError("Das Importblatt enthält keine ausgefüllten Zeilen.");
  return { rows, warnings, totalDataRows: rows.length };
}
