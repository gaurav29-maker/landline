import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Operator passwords. NODE ONLY — never import this from middleware.
 *
 * This is a separate file from lib/ops-auth for one hard reason. That module
 * is pulled into middleware, which Next builds for the edge runtime, and the
 * edge has no node:crypto. Keeping these two functions there broke the build
 * with "Reading from node:crypto is not handled by plugins".
 *
 * A dynamic `await import("node:crypto")` inside the function does NOT fix
 * that, which is the mistake worth recording here: webpack resolves the
 * specifier while bundling regardless of when it would execute, so the edge
 * build still fails. Module boundaries are what separate the two runtimes,
 * not the position of the import statement.
 *
 * So: lib/ops-auth signs and verifies the cookie with Web Crypto and runs
 * anywhere. This file hashes passwords with scrypt and runs only in a server
 * action. The edge checks the signature, the action checks the password.
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/**
 * scrypt, with a per-row salt, stored as `scrypt$N$r$p$salt$hash`.
 *
 * Deliberately not the bare SHA-256 the old shared password used. A fast hash
 * is the wrong tool for a password: being slow is the entire job. The
 * parameters are stored alongside the hash so they can be raised later
 * without invalidating every row that already exists.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, SCRYPT.keylen, SCRYPT, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Whether this password produced that stored hash.
 *
 * Reads N, r and p back out of the stored string rather than assuming today's
 * values, so raising the cost later leaves old rows verifiable until their
 * owners next sign in.
 */
export async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (![N, r, p].every(Number.isFinite)) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, expected.length, { N, r, p }, (err, out) =>
        err ? reject(err) : resolve(out),
      );
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
