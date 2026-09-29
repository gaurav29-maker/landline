import { loadEnv } from "./load-env";
loadEnv();

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

/**
 * What an applicant would like to charge.
 *
 *   npx tsx scripts/add-application-price.ts
 *
 * One nullable column, no backfill. Null is the honest value for every
 * application that came in before the form asked — they were never given the
 * chance to say, and writing the standard rate into their row would claim
 * they had asked for it.
 */
async function main() {
  await db.execute(
    sql`alter table expert_applications add column if not exists asked_price_paise integer`,
  );
  console.log("expert_applications.asked_price_paise ready");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
