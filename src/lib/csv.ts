// CSV utilities — Build 2.5.
// Simple CSV parser/serializer. No external dependencies.

/** Parse CSV text into rows of string arrays. Handles quoted values. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { current.push(cell); cell = ""; }
      else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        current.push(cell); cell = "";
        if (current.some((c) => c.trim())) rows.push(current);
        current = [];
        if (ch === "\r") i++;
      } else { cell += ch; }
    }
  }
  current.push(cell);
  if (current.some((c) => c.trim())) rows.push(current);
  return rows;
}

/** Normalize a CSV header to lowercase snake_case. */
export function normalizeCsvHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

/** Sanitize a cell value for CSV export to prevent formula injection. */
export function sanitizeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  // Prefix formula-risky cells
  if (/^[=+\-@]/.test(str)) return `'${str}`;
  return str;
}

/** Serialize rows into CSV text. */
export function serializeCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((row) =>
    columns.map((c) => {
      const val = sanitizeCsvCell(row[c.key]);
      return val.includes(",") || val.includes('"') || val.includes("\n")
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(","),
  ).join("\n");
  return `${header}\n${body}`;
}

/** Trigger CSV download in the browser. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns: { key: string; label: string }[]): void {
  const csv = serializeCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Validate that required columns exist in headers. */
export function validateRequiredColumns(headers: string[], required: string[]): string[] {
  return required.filter((r) => !headers.includes(r));
}

/** Coerce a string to a number, returning null for empty/invalid. */
export function coerceNumber(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null;
  const n = Number(value);
  return isFinite(n) ? n : null;
}

/** Coerce a string to a boolean. */
export function coerceBoolean(value: string | undefined): boolean {
  if (!value) return true;
  const lower = value.trim().toLowerCase();
  return lower !== "false" && lower !== "0" && lower !== "no";
}
