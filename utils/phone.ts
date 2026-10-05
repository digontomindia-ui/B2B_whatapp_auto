/**
 * Phone number normalization and formatting utilities for WhatsApp CRM.
 * Meta WhatsApp Cloud API expects recipient phone numbers with country code
 * and digits only, without leading '+' or special characters (e.g. 919046113306).
 */

export function normalizePhoneNumber(raw: string): string {
  if (!raw) return "";

  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";

  // If 10 digits (standard Indian mobile without country code), prepend '91'
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // If 11 digits starting with '0' (e.g. 09046113306), strip leading 0 and prepend 91
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }

  // Otherwise return full digits (e.g. 919046113306, 14155552671, etc.)
  return digits;
}

export function formatDisplayPhone(normalized: string): string {
  if (!normalized) return "";

  // If 12 digits starting with 91 (India)
  if (normalized.length === 12 && normalized.startsWith("91")) {
    const cc = normalized.slice(0, 2);
    const p1 = normalized.slice(2, 7);
    const p2 = normalized.slice(7);
    return `+${cc} ${p1} ${p2}`;
  }

  // If 11 digits starting with 1 (US/Canada)
  if (normalized.length === 11 && normalized.startsWith("1")) {
    const cc = normalized.slice(0, 1);
    const p1 = normalized.slice(1, 4);
    const p2 = normalized.slice(4, 7);
    const p3 = normalized.slice(7);
    return `+${cc} (${p1}) ${p2}-${p3}`;
  }

  return `+${normalized}`;
}

export function extractCountryCode(normalized: string): string {
  if (!normalized) return "";
  if (normalized.startsWith("91")) return "IN";
  if (normalized.startsWith("1")) return "US";
  if (normalized.startsWith("44")) return "GB";
  if (normalized.startsWith("971")) return "AE";
  return "OTHER";
}
