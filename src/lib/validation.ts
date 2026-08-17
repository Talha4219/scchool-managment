// Shared, dependency-free form-validation conventions for this codebase.
// react-hook-form/zod are installed but unused anywhere — not worth adopting
// for a targeted validation pass, so this stays plain functions instead.
//
// Convention for any form using these helpers:
//   - Required field labels: <Label>Field <span className="text-destructive">*</span></Label>
//   - Submit/Next buttons: disabled={!isRequiredFieldsFilled} instead of a
//     toast-on-click check — the button simply can't be pressed until valid.
//   - Cross-field errors (e.g. a bad date range): render inline text under the
//     offending field (text-xs text-destructive), not a toast, and disable
//     the button the same way.

export function isValidDateRange(start: string, end: string): boolean {
  if (!start || !end) return true; // incomplete input isn't a range error yet
  return end >= start;
}

export function isValidTimeRange(start: string, end: string): boolean {
  if (!start || !end) return true;
  return end > start;
}
