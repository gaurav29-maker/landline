/**
 * Ops console auth: one account per human, one signed cookie.
 *
 * WAS: a single shared password in OPS_PASSWORD, on the reasoning that there
 * was exactly one operator and a user table would be cost without benefit.
 * The cost showed up somewhere else. A shared secret proves only that SOMEBODY
 * knew it, which made every refund, every approval and every payout marked
 * paid attributable to nobody — including on the days there genuinely was one
 * operator, because "it must have been me" is not a record.
 *
 * So the cookie now carries an operator id. Everything downstream can name the
 * person, and lib/ops-audit writes that name beside what they changed.
 *
 * Web Crypto throughout, because middleware runs on the edge and
 * verifies the same cookie the server actions do. The password half is a
 * separate module (lib/ops-password) for the same reason: the edge checks the
 * signature, the action checks the password and the database.
 */

export const OPS_COOKIE = "bp_ops";
export const OPS_SESSION_DAYS = 7;

const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s) throw new Error("TOKEN_SECRET is not set");
  return s;
}

async function hmacKey(): Promise<CryptoKey> {
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

/** Length-independent comparison, so a wrong guess leaks no timing signal. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------- sessions -- */

/**
 * The cookie says which operator, and is signed over that id.
 *
 * `ops:` scopes it the way the member token is scoped, so an ops session and
 * a member session are not interchangeable despite sharing a secret. Without
 * the prefix, a customer id and an operator id are both just uuids.
 */
export async function mintSession(
  operatorId: string,
): Promise<{ value: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + OPS_SESSION_DAYS * 24 * 60 * 60 * 1000);
  const payload = `ops:${operatorId}:${expiresAt.getTime()}`;
  const sig = toHex(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload)));
  return { value: `${operatorId}.${expiresAt.getTime()}.${sig}`, expiresAt };
}

/**
 * The operator id this cookie is for, or null.
 *
 * Signature and expiry only. Whether that operator is still allowed in is a
 * database question, answered by requireOperator() in the server action — the
 * edge has no database and should not pretend to.
 */
export async function sessionOperatorId(
  token: string | undefined | null,
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [operatorId, expRaw, sig] = parts;
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  let expected: string;
  try {
    const payload = `ops:${operatorId}:${expiresAt}`;
    expected = toHex(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload)));
  } catch {
    return null;
  }
  return constantTimeEqual(expected, sig) ? operatorId : null;
}

/** For middleware, which only needs to know whether to let the request past. */
export async function sessionValid(token: string | undefined | null): Promise<boolean> {
  return (await sessionOperatorId(token)) !== null;
}

/* ------------------------------------------------------------ passwords -- */

/*
 * Password hashing lives in lib/ops-password, which is node-only.
 *
 * It was here, using a dynamic `await import("node:crypto")` on the
 * assumption that deferring the import would keep it out of the edge
 * bundle. It does not: webpack resolves the specifier while bundling,
 * whenever it would have run, so middleware — which imports this file to
 * check the cookie — failed to build with "Reading from node:crypto is not
 * handled by plugins".
 *
 * The module boundary is the fix, not the import position. This file signs
 * with Web Crypto and runs anywhere; that one hashes with scrypt and is
 * only ever reached from a server action.
 */
