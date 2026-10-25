import { NextResponse, type NextRequest } from "next/server";
import { OPS_COOKIE, sessionValid } from "@/lib/ops-auth";
import { MEMBER_COOKIE, readSessionToken } from "@/lib/member-auth";
import { EXPERT_COOKIE, readExpertSessionToken } from "@/lib/expert-auth";

/**
 * Everything under /ops holds real customer data — names, emails and portfolio
 * summaries — so the guard sits in front of the routes rather than inside each
 * page, where one forgetful import would open the lot.
 */
export const config = { matcher: ["/ops/:path*", "/member/:path*", "/expert/:path*"] };

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  /*
     The member console: /member itself may carry a one-time sign-in link, and
     the login page must stay reachable, so both are handled by the page.

     /member/deleted is the third, and it is the one with teeth. It is where
     an account lands the instant after it is erased — at which point the
     session rows are gone and the cookie resolves to nothing, so this guard
     would bounce it to the sign-in form. Being thrown at "Sign in to
     Landline" is the worst possible confirmation that a deletion worked:
     it reads as though the deletion failed and logged you out.

     Caught by measurement, not by reading. The flow redirected correctly to
     /member/deleted and the sign-in page rendered there.
  */
  if (path === "/member" || path === "/member/login" || path === "/member/deleted") {
    return NextResponse.next();
  }

  if (path.startsWith("/member")) {
    if (await readSessionToken(req.cookies.get(MEMBER_COOKIE)?.value)) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = "/member/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // The expert console. Experts see other people's portfolios, so the guard
  // is the same shape as the member one but on its own cookie and scope.
  if (path === "/expert/login") return NextResponse.next();
  if (path.startsWith("/expert")) {
    if (await readExpertSessionToken(req.cookies.get(EXPERT_COOKIE)?.value)) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = "/expert/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (path === "/ops/login") return NextResponse.next();

  if (await sessionValid(req.cookies.get(OPS_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/ops/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}
