// Pakistan reads dates day-first (DD/MM/YYYY). Every date field in this app
// is backed by a native <input type="date">, which always stores/edits ISO
// (YYYY-MM-DD) — that's correct and untouched. This helper is only for
// read-only display of those same ISO strings, so what the admin *reads*
// matches local convention even though the underlying value stays ISO.
export function formatDatePK(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${parsed.getFullYear()}`;
}
