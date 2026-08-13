/** Shared CSV export — every "Export" button in the app should go through this
 * instead of hand-rolling the join/Blob/anchor dance per page. Opens as a
 * proper Excel-compatible CSV (UTF-8 BOM so accented names don't mangle,
 * values quoted/escaped so commas and quotes inside data don't break columns). */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    const s = String(cell ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows]
    .map(row => row.map(escapeCell).join(","))
    .join("\r\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
