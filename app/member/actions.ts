"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MEMBER_COOKIE } from "@/lib/member-auth";
import { readSession, revokeSession } from "@/lib/member-session";

/**
 * Sign out, and mean it.
 *
 * There was no way to do this at all. The member console had Receipts and
 * Your details and nothing else — the only exit was three clicks into a
 * security panel on another page, framed as a remedy for a device you do not
 * recognise rather than the ordinary thing somebody does on a shared laptop
 * when they are finished.
 *
 * THE REVOKE IS THE POINT, NOT THE COOKIE.
 *
 * The expert console signs out by deleting its cookie, which is all it can
 * do: that token is stateless and stays valid until it expires, so "sign out"
 * there means "this browser forgets". For a member it would now be a lie.
 * Sessions are rows, so the row can be ended — and if it is not, a copy of
 * the token taken before signing out keeps working for thirty days.
 *
 * Order matters. Revoke first, then drop the cookie: if the revoke fails the
 * member is still signed in and can try again, which is recoverable. The
 * other order leaves them looking signed out while a live session they can no
 * longer reach stays open.
 */
export async function signOutMember() {
  const session = await readSession();
  if (session) await revokeSession(session.customerId, session.sessionId);

  (await cookies()).delete(MEMBER_COOKIE);
  redirect("/member/login?out=1");
}
