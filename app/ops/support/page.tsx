import { desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, customers, experts, supportMessages } from "@/lib/db/schema";
import { istDateTime } from "@/lib/format";
import { rethrowIfNavigation } from "@/lib/nav";
import { markSupportHandled } from "../actions";

export const dynamic = "force-dynamic";

/**
 * What members have written in.
 *
 * WHY THIS PAGE HAS TO EXIST ALONGSIDE THE FORM. /member/help stores the
 * message and then tries to email a copy to the ops address. RESEND_API_KEY
 * is not set, so today that copy always fails — which means without this page
 * every message a member sent would land in a table nobody opens. A contact
 * form whose output nobody reads is worse than having no contact form, since
 * it promises a person is listening.
 *
 * The `emailed` column is shown for that reason: it is the difference between
 * "this is also in somebody's inbox" and "this page is the only place it
 * exists". Once the Resend key lands most rows will say yes and this page
 * becomes a backstop rather than the primary route.
 *
 * Open ones first and no pagination: if this list is ever long enough to need
 * paging, the problem is not the list.
 */
export default async function OpsSupport() {
  let open: Awaited<ReturnType<typeof load>>["open"] = [];
  let done: Awaited<ReturnType<typeof load>>["done"] = [];
  let dbReady = true;

  try {
    ({ open, done } = await load());
  } catch (err) {
    rethrowIfNavigation(err);
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <div className="bp-panel">
        <h1>Not available right now</h1>
        <p className="bp-muted">We could not reach the database.</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="ops-h1">Support</h1>
      <p className="bp-muted ops-lede">
        Written from the console by members. Stored first and emailed second, so a message is
        here whether or not the copy to the inbox went out.
      </p>

      <h2 className="member-h2" style={{ marginTop: 28 }}>
        Open ({open.length})
      </h2>
      {open.length === 0 ? (
        <p className="bp-muted">Nothing waiting.</p>
      ) : (
        <ul className="ops-support">
          {open.map((m) => (
            <li key={m.id} className="bp-panel ops-support-item">
              <div className="ops-support-head">
                <div>
                  <b>{m.customerName}</b>{" "}
                  <span className="bp-muted">&lt;{m.customerEmail}&gt;</span>
                  <br />
                  <span className="ops-sub">
                    {istDateTime(m.createdAt)} IST · {m.topic}
                    {m.sessionAt ? ` · session ${istDateTime(m.sessionAt)} IST` : ""}
                    {m.expertName ? ` with ${m.expertName}` : ""}
                  </span>
                </div>
                <span className={m.emailed ? "pill ok" : "pill warn"}>
                  {m.emailed ? "copy sent" : "here only"}
                </span>
              </div>
              <p className="ops-support-body">{m.body}</p>
              <form action={markSupportHandled}>
                <input type="hidden" name="id" value={m.id} />
                <button className="ops-btn" type="submit">
                  Mark answered
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="member-h2" style={{ marginTop: 36 }}>
        Answered
      </h2>
      {done.length === 0 ? (
        <p className="bp-muted">None yet.</p>
      ) : (
        <ul className="ops-support">
          {done.map((m) => (
            <li key={m.id} className="bp-panel ops-support-item is-done">
              <div className="ops-support-head">
                <div>
                  <b>{m.customerName}</b>
                  <br />
                  <span className="ops-sub">
                    {istDateTime(m.createdAt)} IST · {m.topic} · answered{" "}
                    {m.handledAt ? istDateTime(m.handledAt) : ""} IST
                  </span>
                </div>
              </div>
              <p className="ops-support-body">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function load() {
  const base = {
    id: supportMessages.id,
    topic: supportMessages.topic,
    body: supportMessages.body,
    emailed: supportMessages.emailed,
    createdAt: supportMessages.createdAt,
    handledAt: supportMessages.handledAt,
    customerName: customers.name,
    customerEmail: customers.email,
    sessionAt: bookings.startsAt,
    expertName: experts.displayName,
  };

  const open = await db
    .select(base)
    .from(supportMessages)
    .innerJoin(customers, eq(customers.id, supportMessages.customerId))
    .leftJoin(bookings, eq(bookings.id, supportMessages.bookingId))
    .leftJoin(experts, eq(experts.id, bookings.expertId))
    .where(isNull(supportMessages.handledAt))
    .orderBy(desc(supportMessages.createdAt));

  const done = await db
    .select(base)
    .from(supportMessages)
    .innerJoin(customers, eq(customers.id, supportMessages.customerId))
    .leftJoin(bookings, eq(bookings.id, supportMessages.bookingId))
    .leftJoin(experts, eq(experts.id, bookings.expertId))
    .where(isNotNull(supportMessages.handledAt))
    .orderBy(desc(supportMessages.handledAt))
    .limit(30);

  return { open, done };
}
