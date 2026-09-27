import { loadEnv } from "./load-env";
loadEnv();

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

/**
 * Expert sessions, as explicit DDL.
 *
 *   npx tsx scripts/add-expert-sessions.ts
 *
 * Written out rather than pushed, like the other DDL scripts: drizzle-kit
 * push cannot diff this schema against PGlite. Idempotent.
 *
 * EXISTING EXPERT COOKIES STOP WORKING after this. The token used to name an
 * expert and now names a session row, so one issued before this decodes to a
 * session that does not exist and is refused. Experts sign in again once —
 * unavoidable without leaving the old unrevocable tokens valid, which is the
 * thing being fixed.
 */
async function main() {
  await db.execute(sql`
    create table if not exists expert_sessions (
      id uuid primary key default gen_random_uuid(),
      expert_id uuid not null references experts(id) on delete cascade,
      last_seen_at timestamptz not null default now(),
      ip text,
      user_agent text,
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create index if not exists expert_sessions_expert_idx on expert_sessions (expert_id)`,
  );
  console.log("expert_sessions ready");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
