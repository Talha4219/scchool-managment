// JazzCash / EasyPaisa Hosted Checkout Page (HCP) integration helpers.
//
// Both are Pakistan mobile-wallet/card gateways commonly used by private
// schools. Neither has a public self-serve sandbox the way Stripe does —
// getting live test credentials requires a merchant application through the
// bank. This module implements the documented field/hash contract for both
// so the integration is real and correct; it activates automatically once a
// school's merchant credentials are set as environment variables. Until
// then, `isJazzCashConfigured()`/`isEasyPaisaConfigured()` return false and
// the UI shows a clear "not configured" state instead of a broken button.
//
// JazzCash reference: Hosted Checkout Page v1.1 integration guide.
// EasyPaisa reference: Open/Instant-Pay HTTP POST integration guide.
// Confirm exact field names against the bank's current PDF before going live
// — both vendors have historically made minor field revisions between
// merchant onboarding tiers.

import { createHmac } from "crypto";

// ── JazzCash ──────────────────────────────────────────────────────────────

export function isJazzCashConfigured(): boolean {
  return !!(process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_PASSWORD && process.env.JAZZCASH_INTEGRITY_SALT);
}

function jazzCashDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Builds the signed field set for JazzCash's Hosted Checkout Page.
 * The caller POSTs these fields (as a hidden auto-submitting HTML form) to
 * `actionUrl`; JazzCash then redirects back to `pp_ReturnURL` with the result. */
export function buildJazzCashRequest(params: {
  txnRefNo: string; amountPKR: number; billReference: string; description: string; returnUrl: string;
}): { actionUrl: string; fields: Record<string, string> } {
  const merchantId = process.env.JAZZCASH_MERCHANT_ID!;
  const password = process.env.JAZZCASH_PASSWORD!;
  const salt = process.env.JAZZCASH_INTEGRITY_SALT!;
  const actionUrl = process.env.JAZZCASH_HCP_URL || "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/";

  const now = new Date();
  const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const fields: Record<string, string> = {
    pp_Version: "1.1",
    pp_TxnType: "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: merchantId,
    pp_SubMerchantID: "",
    pp_Password: password,
    pp_BankID: "",
    pp_ProductID: "",
    pp_TxnRefNo: params.txnRefNo,
    pp_Amount: String(Math.round(params.amountPKR * 100)), // paisas, integer
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: jazzCashDateTime(now),
    pp_BillReference: params.billReference,
    pp_Description: params.description,
    pp_TxnExpiryDateTime: jazzCashDateTime(expiry),
    pp_ReturnURL: params.returnUrl,
  };

  fields.pp_SecureHash = signJazzCashFields(fields, salt);
  return { actionUrl, fields };
}

/** JazzCash's documented signing algorithm: sort pp_ fields by key, join
 * their non-empty values with '&', prefix with the integrity salt, HMAC-SHA256
 * keyed by the same salt, uppercase hex. Used both to sign outgoing requests
 * and to verify the callback's own pp_SecureHash. */
export function signJazzCashFields(fields: Record<string, string>, salt: string): string {
  const sortedKeys = Object.keys(fields).filter(k => k !== "pp_SecureHash" && k.startsWith("pp_")).sort();
  const values = sortedKeys.map(k => fields[k] ?? "").filter(v => v !== "");
  const message = `${salt}&${values.join("&")}`;
  return createHmac("sha256", salt).update(message).digest("hex").toUpperCase();
}

export function verifyJazzCashCallback(fields: Record<string, string>): boolean {
  if (!isJazzCashConfigured()) return false;
  const salt = process.env.JAZZCASH_INTEGRITY_SALT!;
  const received = fields.pp_SecureHash;
  if (!received) return false;
  const expected = signJazzCashFields(fields, salt);
  return received.toUpperCase() === expected;
}

// ── EasyPaisa ─────────────────────────────────────────────────────────────

export function isEasyPaisaConfigured(): boolean {
  return !!(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY);
}

function easyPaisaExpiry(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Builds the signed field set for EasyPaisa's hosted payment page. */
export function buildEasyPaisaRequest(params: {
  orderRefNum: string; amountPKR: number; postBackUrl: string; email?: string; mobile?: string;
}): { actionUrl: string; fields: Record<string, string> } {
  const storeId = process.env.EASYPAISA_STORE_ID!;
  const hashKey = process.env.EASYPAISA_HASH_KEY!;
  const actionUrl = process.env.EASYPAISA_HCP_URL || "https://sandbox.easypaisa.com.pk/easypay/Index.jsf";

  const expiry = easyPaisaExpiry(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const amount = params.amountPKR.toFixed(2);

  const toHash = `amount=${amount}&orderRefNum=${params.orderRefNum}&storeId=${storeId}&postBackURL=${params.postBackUrl}&expiryDate=${expiry}`;
  const merchantHashedReq = createHmac("sha256", hashKey).update(toHash).digest("base64");

  return {
    actionUrl,
    fields: {
      storeId,
      amount,
      postBackURL: params.postBackUrl,
      orderRefNum: params.orderRefNum,
      expiryDate: expiry,
      autoRedirect: "1",
      emailAddr: params.email || "",
      mobileNum: params.mobile || "",
      merchantHashedReq,
    },
  };
}

export function verifyEasyPaisaCallback(fields: Record<string, string>): boolean {
  if (!isEasyPaisaConfigured()) return false;
  const hashKey = process.env.EASYPAISA_HASH_KEY!;
  const storeId = process.env.EASYPAISA_STORE_ID!;
  const received = fields.merchantHashedReq || fields.hashedReq;
  if (!received) return false;
  const toHash = `amount=${fields.amount}&orderRefNum=${fields.orderRefNum}&storeId=${storeId}&postBackURL=${fields.postBackURL}&expiryDate=${fields.expiryDate}`;
  const expected = createHmac("sha256", hashKey).update(toHash).digest("base64");
  return received === expected;
}
