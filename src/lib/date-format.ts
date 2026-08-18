// Pakistan reads dates day-first (DD/MM/YYYY). Every date field in this app
// is backed by a native <input type="date">, which always stores/edits ISO
// (YYYY-MM-DD) — that's correct and untouched. This helper is only for
// read-only display of those same ISO strings, so what the admin *reads*
// matches local convention even though the underlying value stays ISO.
export function formatDatePK(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) return "—";
    const day = String(dateStr.getDate()).padStart(2, "0");
    const month = String(dateStr.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${dateStr.getFullYear()}`;
  }
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

// Compact day/month (no year) — for narrow calendar-grid column headers
// (attendance history tables, timetables) where a full dd/mm/yyyy label
// wouldn't fit. Still day-first to stay consistent with formatDatePK.
export function formatDayMonthPK(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const isoMatch = typeof dateStr === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr) : null;
  if (isoMatch) {
    const [, , month, day] = isoMatch;
    return `${day}/${month}`;
  }
  const parsed = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(parsed.getTime())) return typeof dateStr === "string" ? dateStr : "—";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

// Same day/month/year as formatDatePK, plus a local (not UTC) HH:MM — for
// timestamp fields (createdAt, sentAt, etc.) that also carry a time-of-day.
export function formatDateTimePK(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const parsed = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(parsed.getTime())) return typeof dateStr === "string" ? dateStr : "—";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${parsed.getFullYear()} ${hours}:${minutes}`;
}
