/**
 * The sign-in codes table and the phone uniqueness, as explicit DDL.
 *
 * `drizzle-kit push` refuses this diff against the local PGlite database —
 * it decides to recreate a primary key and Postgres answers "column id is in
 * a primary key". That is a quirk of pushing to PGlite, not of the schema, so
 * the same two statements are written out here and run directly.
 *
 *   npx tsx scripts/add-signin-codes.ts
 *
 * Idempotent: IF NOT EXISTS on both, so running it twice is a no-op and it is
 * safe to run against a database that has already had it.
 */
import { loadEnv } from "./load-env";
loadEnv();

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

async function main() {
  await db.execute(sql`
    create table if not exists sign_in_codes (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid not null references customers(id),
      code_hash text not null,
      expires_at timestamptz not null,
      attempts smallint not null default 0,
      consumed_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create index if not exists sign_in_codes_customer_idx on sign_in_codes (customer_id)`,
  );
  /* Unique, not notNull: Postgres counts NULLs as distinct, so members with
     no number on file keep their row and their emailed link. */
  await db.execute(
    sql`create unique index if not exists customers_phone_idx on customers (phone)`,
  );
  console.log("sign_in_codes ready, customers.phone unique");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
