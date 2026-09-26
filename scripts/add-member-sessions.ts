import { loadEnv } from "./load-env";
loadEnv();

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

/**
 * Member sessions, and the payer facts pulled out of the Razorpay blob.
 *
 *   npx tsx scripts/add-member-sessions.ts
 *
 * Written out rather than pushed, for the same reason as the other two DDL
 * scripts: drizzle-kit push cannot diff this schema against PGlite. Idempotent
 * throughout.
 *
 * EXISTING COOKIES STOP WORKING after this, by design. The session token used
 * to name a customer and now names a session row, so a cookie issued before
 * this migration decodes to a session id that does not exist and is refused.
 * Everybody signs in once more. There is no way to avoid that without leaving
 * the old unrevocable tokens valid, which is the thing being fixed.
 */
async function main() {
  await db.execute(sql`
    create table if not exists member_sessions (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid not null references customers(id),
      verified_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      ip text,
      user_agent text,
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create index if not exists member_sessions_customer_idx on member_sessions (customer_id)`,
  );

  for (const column of [
    "payer_method text",
    "payer_instrument text",
    "payer_contact text",
    "payer_email text",
  ]) {
    await db.execute(sql.raw(`alter table payments add column if not exists ${column}`));
  }

  /*
     A session and a sign-in code belong to a customer and mean nothing
     without them, so they go when the customer does. Bookings and
     memberships deliberately do NOT cascade: deleting somebody who has paid
     for sessions should be refused by the database, not quietly erase the
     financial record.
  */
  /*
     Orphans first, or the constraint cannot be added.

     Earlier runs deleted customers while the foreign key still had no ON
     DELETE rule, which Postgres refuses — but the suite's own cleanup
     removed rows in a different order and left sessions and codes pointing
     at customers who are gone. They are meaningless on their own, so they go
     before the rule that would have prevented them is installed.
  */
  await db.execute(
    sql`delete from member_sessions s where not exists (select 1 from customers c where c.id = s.customer_id)`,
  );
  await db.execute(
    sql`delete from sign_in_codes s where not exists (select 1 from customers c where c.id = s.customer_id)`,
  );

  await db.execute(sql`
    alter table member_sessions
      drop constraint if exists member_sessions_customer_id_fkey,
      add constraint member_sessions_customer_id_fkey
        foreign key (customer_id) references customers(id) on delete cascade
  `);
  await db.execute(sql`
    alter table sign_in_codes
      drop constraint if exists sign_in_codes_customer_id_fkey,
      add constraint sign_in_codes_customer_id_fkey
        foreign key (customer_id) references customers(id) on delete cascade
  `);

  console.log("member_sessions ready; payments carries who paid");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
