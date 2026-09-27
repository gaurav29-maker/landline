import { loadEnv } from "./load-env";
loadEnv();

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

/**
 * What an expert sells, as explicit DDL, plus the backfill.
 *
 *   npx tsx scripts/add-expert-products.ts
 *
 * Written out rather than pushed, like the other DDL scripts. Idempotent.
 *
 * THE BACKFILL IS THE POINT.
 *
 * Every expert had exactly one price and everybody had the same 45-minute
 * slot, so every expert gets exactly one product built from those two values.
 * Nothing about the site changes — the same session at the same price — which
 * is deliberate: this migration moves where the number lives without moving
 * the number. A second product is a row somebody adds afterwards.
 */
async function main() {
  await db.execute(sql`
    do $$ begin
      create type expert_product_status as enum ('active', 'hidden');
    exception when duplicate_object then null; end $$
  `);

  await db.execute(sql`
    create table if not exists expert_products (
      id uuid primary key default gen_random_uuid(),
      expert_id uuid not null references experts(id) on delete cascade,
      slug text not null,
      name text not null,
      blurb text,
      minutes smallint not null,
      price_paise integer not null,
      status expert_product_status not null default 'active',
      sort_order smallint not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.execute(
    sql`create unique index if not exists expert_products_slug_idx on expert_products (expert_id, lower(slug))`,
  );
  await db.execute(
    sql`create index if not exists expert_products_expert_idx on expert_products (expert_id)`,
  );

  await db.execute(sql`alter table bookings add column if not exists product_id uuid`);
  await db.execute(sql`
    do $$ begin
      alter table bookings add constraint bookings_product_id_expert_products_id_fk
        foreign key (product_id) references expert_products(id);
    exception when duplicate_object then null; end $$
  `);

  /*
     One product per expert, from the price they already have. `on conflict
     do nothing` against the (expert, slug) index makes a second run a no-op
     rather than a duplicate.
  */
  const inserted = await db.execute(sql`
    insert into expert_products (expert_id, slug, name, blurb, minutes, price_paise)
    select id, 'audit', 'Portfolio audit',
           'A read of what you hold, and a conversation about it.',
           45, price_paise
    from experts
    on conflict do nothing
    returning id
  `);

  const rows = inserted as unknown as { id: string }[];
  console.log(`expert_products ready; backfilled ${rows.length} product(s)`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
