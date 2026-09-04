const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize user-entered phone numbers to E.164. Strips formatting, treats a
 * leading "00" as "+", and assumes US/Canada (+1) for bare 10-digit numbers or
 * 11-digit numbers starting with 1. Returns null if the result isn't valid E.164.
 */
export function normalizePhone(input: string): string | null {
  let s = input.trim().replace(/[\s().\-]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!s.startsWith("+")) {
    if (/^\d{10}$/.test(s)) s = `+1${s}`;
    else if (/^1\d{10}$/.test(s)) s = `+${s}`;
    else if (/^\d{8,15}$/.test(s)) s = `+${s}`;
  }
  return E164.test(s) ? s : null;
}
