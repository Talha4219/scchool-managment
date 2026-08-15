// Meta WhatsApp Cloud API configuration. Server-only — this module (and
// everything that imports it) must never be reachable from a client
// component. No NEXT_PUBLIC_* vars are used, so nothing here can end up in
// the browser bundle even by accident.

export interface WhatsAppConfig {
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  apiVersion: string;
}

export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    process.env.WHATSAPP_API_VERSION
  );
}

/** Throws if called while unconfigured — callers must check
 *  isWhatsAppConfigured() first and return a clean {error} instead of
 *  letting this throw reach the user, same contract as isEmailConfigured(). */
export function getWhatsAppConfig(): WhatsAppConfig {
  if (!isWhatsAppConfigured()) {
    throw new Error("WhatsApp Cloud API is not configured (missing WHATSAPP_* environment variables).");
  }
  return {
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
    apiVersion: process.env.WHATSAPP_API_VERSION!,
  };
}
