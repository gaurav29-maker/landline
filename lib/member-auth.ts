/**
 * Member sign-in: a signed link by email, no password.
 *
 * Customers should not have credentials to lose. A link proves control of the
 * address the pass was bought with, which is exactly the claim that matters.
 * Web Crypto so middleware (edge) and route handlers (node) share one path.
 */

export const MEMBER_COOKIE = "bp_member";
/** How long a emailed sign-in link stays usable. */
export const LINK_MINUTES = 30;
/** How long the session lasts once signed in. */
export const SESSION_DAYS = 30;

const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s) throw new Error("TOKEN_SECRET is not set");
  return s;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * `scope` keeps a 30-minute sign-in link from being replayed as a 30-day
 * session cookie, and vice versa — same secret, different domains.
 */
async function sign(customerId: string, expiresAt: number, scope: "link" | "session") {
  const payload = `${scope}:${customerId}:${expiresAt}`;
  const sig = toHex(await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload)));
  return `${customerId}.${expiresAt}.${sig}`;
}

async function verify(
  token: string | undefined | null,
  scope: "link" | "session",
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [customerId, expRaw, sig] = parts;
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  let expected: string;
  try {
    const payload = `${scope}:${customerId}:${expiresAt}`;
    expected = toHex(await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload)));
  } catch {
    return null;
  }
  return constantTimeEqual(expected, sig) ? customerId : null;
}

export function mintLink(customerId: string) {
  return sign(customerId, Date.now() + LINK_MINUTES * 60_000, "link");
}
export function verifyLink(token: string | undefined | null) {
  return verify(token, "link");
}

/**
 * The cookie names a SESSION, not a customer.
 *
 * It used to carry the customer id directly, which made the token complete
 * on its own — nothing had to be stored, and nothing could be taken away. A
 * stolen cookie was good for thirty days and there was no row to revoke,
 * nothing to show the member, and no way for either of us to notice.
 *
 * One level of indirection fixes all three: member_sessions holds whose it
 * is, where it signed in from, and whether it is still allowed. Everything
 * that reads it lives in lib/member-session, because this module is imported
 * by middleware and must not reach a database.
 */
export async function mintSession(sessionId: string) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return { value: await sign(sessionId, expiresAt, "session"), expiresAt: new Date(expiresAt) };
}

/**
 * The session id this cookie is for, by signature and expiry alone.
 *
 * Edge-safe and deliberately incomplete. Whether that session still exists,
 * and whether it has been revoked, is a database question — readSession() in
 * lib/member-session answers it, and every server route asks. Middleware
 * gets this one: enough to turn a stranger away, cheap enough to run on
 * every request.
 */
export function readSessionToken(token: string | undefined | null) {
  return verify(token, "session");
}

/**
 * An email change is signed over the NEW address as well as the customer, so
 * a token minted for one address cannot be replayed to claim another. Email is
 * the login identity here — a change has to prove the new address is reachable
 * before it takes effect, or someone could lock themselves out of a pass they
 * paid two lakh for.
 */
export async function mintEmailChange(customerId: string, newEmail: string): Promise<string> {
  const expiresAt = Date.now() + LINK_MINUTES * 60_000;
  const email = newEmail.trim().toLowerCase();
  const payload = `email:${customerId}:${email}:${expiresAt}`;
  const sig = toHex(await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload)));
  const packed = Buffer.from(email, "utf8").toString("base64url");
  return `${customerId}.${expiresAt}.${packed}.${sig}`;
}

export async function verifyEmailChange(
  token: string | undefined | null,
): Promise<{ customerId: string; email: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [customerId, expRaw, packed, sig] = parts;
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  let email: string;
  try {
    email = Buffer.from(packed, "base64url").toString("utf8");
  } catch {
    return null;
  }

  let expected: string;
  try {
    const payload = `email:${customerId}:${email}:${expiresAt}`;
    expected = toHex(await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload)));
  } catch {
    return null;
  }
  return constantTimeEqual(expected, sig) ? { customerId, email } : null;
}

export async function memberConsoleUrl(customerId: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/api/member/session?t=${await mintLink(customerId)}`;
}

/* ---------------------------------------------------------------- codes -- */

/** Six digits, because that is what people expect to be asked for. */
export const CODE_DIGITS = 6;
/** How long a code stays usable. Short: it is retyped from a lock screen. */
export const CODE_MINUTES = 10;
/**
 * Wrong guesses before the code is dead.
 *
 * Six digits is a million possibilities, so expiry alone is not protection —
 * a script can cover a good fraction of a million in ten minutes. Five tries
 * makes the odds 5 in a million per code issued, and issuing codes is itself
 * throttled. This is the number that does the work.
 */
export const CODE_MAX_ATTEMPTS = 5;

/**
 * A code, from the CSPRNG and with an even distribution.
 *
 * Rejection sampling rather than `% 1_000_000`: the modulo of a 32-bit value
 * favours the low end of the range, and a code generator with a bias is a
 * code generator somebody can guess better than chance. The loop runs once
 * in almost every case.
 */
export function generateCode(): string {
  const ceiling = 10 ** CODE_DIGITS;
  /* Largest multiple of the range that fits in 32 bits; above it, resample. */
  const limit = Math.floor(0x1_0000_0000 / ceiling) * ceiling;

  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);

  return String(n % ceiling).padStart(CODE_DIGITS, "0");
}

/**
 * What goes in the database in place of the code.
 *
 * Bound to the customer id as well as the digits, so a hash lifted from one
 * member's row cannot be replayed against another's — the same reason the
 * link and session tokens carry a scope.
 */
export async function hashCode(customerId: string, code: string): Promise<string> {
  const payload = `code:${customerId}:${code}`;
  return toHex(await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload)));
}

/** Constant-time, so a timing difference cannot leak a digit at a time. */
export async function codeMatches(
  customerId: string,
  code: string,
  storedHash: string,
): Promise<boolean> {
  return constantTimeEqual(await hashCode(customerId, code), storedHash);
}

/**
 * A pending phone change, signed over the NEW number.
 *
 * The same shape as mintEmailChange and for a sharper reason. Phone is the
 * sign-in credential now, so an unverified change is not an inconvenience —
 * it is account takeover that the real owner cannot undo, because the way
 * back in is the number that was just taken away. A typo does the same damage
 * as an attacker.
 *
 * So the new number has to answer before it becomes the way in. This token
 * carries which number was asked for; the code sent to it proves somebody
 * holds it; and the session proves it is the member asking.
 */
export async function mintPhoneChange(customerId: string, newPhone: string): Promise<string> {
  const expiresAt = Date.now() + LINK_MINUTES * 60_000;
  const payload = `phone:${customerId}:${newPhone}:${expiresAt}`;
  const sig = toHex(await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload)));
  const packed = Buffer.from(newPhone, "utf8").toString("base64url");
  return `${customerId}.${expiresAt}.${packed}.${sig}`;
}

export async function verifyPhoneChange(
  token: string | undefined | null,
): Promise<{ customerId: string; phone: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [customerId, expRaw, packed, sig] = parts;
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  let phone: string;
  try {
    phone = Buffer.from(packed, "base64url").toString("utf8");
  } catch {
    return null;
  }

  let expected: string;
  try {
    const payload = `phone:${customerId}:${phone}:${expiresAt}`;
    expected = toHex(await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload)));
  } catch {
    return null;
  }
  return constantTimeEqual(expected, sig) ? { customerId, phone } : null;
}
