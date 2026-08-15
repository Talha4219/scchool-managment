// Phone-number normalization for the WhatsApp Cloud API, which requires
// E.164 (no leading zero, no spaces/dashes, country code prefixed with +).
// Pure function, no I/O — every send path and the opt-in gate (Phase 3)
// route through this rather than trusting whatever format is on file.

export function normalizeToE164(raw: string | null | undefined, defaultCountryCode = "92"): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");

  let normalized: string;
  if (digits.startsWith("+")) {
    normalized = digits;
  } else if (digits.startsWith("00")) {
    normalized = `+${digits.slice(2)}`;
  } else if (digits.startsWith("0")) {
    // Local format, e.g. 03001234567 -> +923001234567
    normalized = `+${defaultCountryCode}${digits.slice(1)}`;
  } else if (digits.startsWith(defaultCountryCode)) {
    normalized = `+${digits}`;
  } else {
    normalized = `+${defaultCountryCode}${digits}`;
  }

  // E.164 max length is 15 digits after the +; reject anything implausible
  // (too short to be a real subscriber number, or malformed).
  const digitsOnly = normalized.slice(1);
  if (!/^\d{8,15}$/.test(digitsOnly)) return null;

  return normalized;
}
