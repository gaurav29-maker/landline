/**
 * The human check in front of sign-in.
 *
 * Why here and not on the booking form: a booking costs the person money, so
 * it defends itself. Asking for a code costs nothing and sends a real SMS to
 * a real number, which makes it the one endpoint on this site worth abusing —
 * either to bill us a rupee a message, or to use us as a way of texting
 * somebody repeatedly. The throttle in front of it caps one number; this caps
 * the script that walks through ten thousand of them.
 *
 * OFF UNTIL CONFIGURED, AND ON THE MOMENT IT IS
 *
 * With no secret set, verification passes and the widget does not render, so
 * development and the suite run without a Cloudflare account. With a secret
 * set, a missing or bad token is refused. There is no third state and no flag
 * to forget: the presence of the key IS the switch.
 *
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY renders the widget, TURNSTILE_SECRET_KEY
 * checks it. Set both or neither — a site key with no secret is a widget that
 * proves nothing, which is worse than no widget because it looks like one.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Whether the widget should be drawn at all. Safe to call on the client. */
export function turnstileSiteKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;
}

/**
 * True when this request may proceed.
 *
 * A network failure reaching Cloudflare returns false rather than true. That
 * is deliberate and it is the less convenient choice: if the check cannot be
 * made, the request has not passed it. Sign-in briefly unavailable beats a
 * bot check that opens whenever someone can make it time out.
 */
export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  if (!token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      /* Cloudflare answers in milliseconds; a slow one is a failed one. */
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verification failed", err);
    return false;
  }
}
