import Link from "next/link";
import { signOutMember } from "@/app/member/actions";
import Wordmark from "@/components/Wordmark";

/**
 * The member console's chrome.
 *
 * Three pages had their own copy and they had already drifted: two linked the
 * wordmark to /member and one to the public site, one showed the nav links
 * and two showed the member's name instead, so which way out you had depended
 * on which page you happened to be on. The expert console solved this with
 * ExpertBar for exactly the same reason — one copy is a component, three are
 * a maintenance problem with a sign-out missing from all of them.
 *
 * `current` drops the link to the page you are already on, matching ExpertBar.
 */
export default function MemberBar({
  name,
  current,
}: {
  name?: string;
  current?: "console" | "receipts" | "profile";
}) {
  return (
    <div className="os-bar">
      <Wordmark className="logo os-mark" href="/member" sub="os" />
      <span className="os-nav">
        {/* The name is context, not navigation, so it leads and stays plain. */}
        {name ? <span className="bp-muted">{name}</span> : null}
        {current !== "console" ? <Link href="/member">Your console</Link> : null}
        {current !== "receipts" ? <Link href="/member/receipts">Receipts</Link> : null}
        {current !== "profile" ? <Link href="/member/profile">Your details</Link> : null}
        <form action={signOutMember}>
          <button className="ops-signout" type="submit">
            Sign out
          </button>
        </form>
      </span>
    </div>
  );
}
