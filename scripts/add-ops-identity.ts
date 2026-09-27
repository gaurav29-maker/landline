import { loadEnv } from "./load-env";
loadEnv();

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

/**
 * Operator accounts and the audit trail, as explicit DDL.
 *
 *   npx tsx scripts/add-ops-identity.ts
 *
 * `drizzle-kit push` cannot diff this schema against the local PGlite database
 * — it decides to recreate a primary key and Postgres refuses — so the
 * statements are written out and run directly. Idempotent throughout: safe to
 * run against a database that already has some or all of it.
 *
 * THE TRIGGER IS THE POINT OF THE LAST BLOCK.
 *
 * ops_events is append-only, and REVOKE alone does not achieve that. The app
 * connects as the table's owner, and an owner can grant itself back whatever
 * was revoked; on a local superuser, grants are bypassed entirely. A trigger
 * that raises on UPDATE and DELETE applies to everyone including the owner,
 * which is what "append-only" has to mean for a record that exists to be
 * trusted after something has gone wrong.
 */
async function main() {
  await db.execute(sql`
    do $$ begin
      create type ops_user_status as enum ('active', 'disabled');
    exception when duplicate_object then null; end $$
  `);

  await db.execute(sql`
    create table if not exists ops_users (
      id uuid primary key default gen_random_uuid(),
      email text not null,
      name text not null,
      password_hash text not null,
      status ops_user_status not null default 'active',
      last_seen_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create unique index if not exists ops_users_email_idx on ops_users (lower(email))`,
  );

  await db.execute(sql`
    create table if not exists ops_events (
      id uuid primary key default gen_random_uuid(),
      actor_id uuid not null references ops_users(id),
      actor_email text not null,
      action text not null,
      entity text not null,
      entity_id text not null,
      before jsonb,
      after jsonb,
      note text,
      ip text,
      user_agent text,
      at timestamptz not null default now()
    )
  `);
  await db.execute(sql`create index if not exists ops_events_at_idx on ops_events (at)`);
  await db.execute(
    sql`create index if not exists ops_events_entity_idx on ops_events (entity, entity_id)`,
  );
  await db.execute(sql`create index if not exists ops_events_actor_idx on ops_events (actor_id)`);

  await db.execute(sql`
    create or replace function ops_events_append_only() returns trigger as $$
    begin
      raise exception 'ops_events is append-only (attempted %)', tg_op;
    end;
    $$ language plpgsql
  `);
  await db.execute(sql`drop trigger if exists ops_events_no_rewrite on ops_events`);
  await db.execute(sql`
    create trigger ops_events_no_rewrite
      before update or delete on ops_events
      for each row execute function ops_events_append_only()
  `);

  /*
     TRUNCATE needs its own trigger.

     The one above is FOR EACH ROW, and TRUNCATE is a statement-level
     operation that never fires a row trigger — so an append-only table
     could still be emptied in a single statement. Found by reading the
     grants on a real database rather than by assuming the first trigger
     covered it.
  */
  await db.execute(sql`
    create or replace function ops_events_no_truncate() returns trigger as $$
    begin
      raise exception 'ops_events is append-only (attempted TRUNCATE)';
    end;
    $$ language plpgsql
  `);
  await db.execute(sql`drop trigger if exists ops_events_no_truncate on ops_events`);
  await db.execute(sql`
    create trigger ops_events_no_truncate
      before truncate on ops_events
      for each statement execute function ops_events_no_truncate()
  `);

  console.log("ops_users and ops_events ready; ops_events is append-only");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
