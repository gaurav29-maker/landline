import { loadEnv } from "./load-env";
loadEnv();

import { execSync } from "node:child_process";
import postgres from "postgres";
import { migrationConnection } from "../lib/db/connection";

/**
 * One command that produces a working local database, from nothing.
 *
 * WHY THIS EXISTS. `npm run db:push && npm run db:seed` is what the
 * local-db banner told you to run, and it does not give you a database
 * the suite can pass against. Measured on an empty database, push creates
 * every table and every column — the session tables and the payer columns
 * included, so the README is right about those — and leaves exactly two
 * things out:
 *
 *   - THE APPEND-ONLY TRIGGERS on ops_events. Drizzle's schema cannot
 *     express a trigger, so push builds the audit table without the two
 *     functions that stop anybody rewriting or truncating it. The table
 *     exists and the one property it exists to have does not. Three
 *     checks fail; what they are protecting is unprotected.
 *   - THE PRODUCT ROWS. expert_products is created by push and left
 *     empty, so a product lookup returns undefined and the suite dies on
 *     "invalid input syntax for type uuid" about sixty checks before
 *     anything readable. The table is not missing. The rows are.
 *
 * Found the hard way: PGlite wedged, the process was force-killed, its
 * data directory did not survive it, and rebuilding from the two
 * documented commands produced a database that failed five checks for
 * reasons that looked like code regressions and were not. That hour is
 * what this script exists to not spend again.
 *
 * ONE THING IT CANNOT FIX, and the reason it names the step that broke.
 * PGlite's backend aborted three times while this script was being written,
 * always after several resets in one db:local lifetime, never on the first.
 * No single step accounts for it: six drop-and-create cycles, six
 * drop-and-push cycles, two full resets back to back, and a reset run while
 * the dev server held a live connection all came through clean. So what is
 * recorded here is the shape of it rather than a cause, because the cause is
 * not known. The symptom is `read ECONNRESET` from whichever step is next
 * and from every connection after it, `select 1` included — the database is
 * gone, not slow. The recovery is outside this script, and is the one state
 * it cannot rebuild from: stop db:local, delete the data directory it
 * prints, start it again, then run this. Reset a handful of times in a row
 * and expect to do that.
 *
 * WHY IT DROPS FIRST, which is worth knowing before you run it.
 * `drizzle-kit push` works on an empty database and crashes on this one
 * once it is built — "Cannot read properties of undefined (reading
 * 'value')" while diffing a schema that holds the trigger functions
 * Drizzle does not model. The only state push reliably handles is nothing
 * at all. A reset that worked solely on a database you had already deleted
 * by hand would not be a reset, so it does the deleting: `drop schema
 * public cascade` and start again.
 *
 * THAT MAKES THIS DESTRUCTIVE, hence the host check below. It is the only
 * thing between this command and somebody's real data, so it reads the
 * connection string every later step will actually use rather than the one
 * name people assume is in play.
 *
 * WHY ONLY FIVE STEPS. add-signin-codes, add-member-sessions,
 * add-expert-sessions and add-application-price are all no-ops here —
 * measured, not assumed: push already creates everything they add. They
 * exist for a database that is already live and cannot be dropped, which
 * is the opposite of this one, and the README documents them there.
 * Running them anyway would imply a fresh push needs them.
 *
 * ORDER MATTERS IN ONE PLACE: add-expert-products backfills a row per
 * expert by selecting FROM experts, so it comes after the seed that
 * creates them.
 *
 * WHAT IT DOES NOT DO. add-operator takes an email and makes somebody an
 * operator; that is a decision, not a baseline, so it is named at the end
 * rather than run.
 */

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

/*
   The HOST, parsed, not a substring of the whole connection string. A
   hosted URL can easily carry "localhost" inside a generated password,
   and a guard on a destructive command that somebody's password can
   defeat is not a guard.
*/
function hostOf(url: string): string | null {
  try {
    /* Postgres brackets IPv6 hosts and URL keeps the brackets. */
    return new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
}

/** Each step is a label and the command that performs it. */
const STEPS: [string, string][] = [
  ["every table and column", "npm run db:push"],
  ["the append-only audit trail push cannot build", "npx tsx scripts/add-ops-identity.ts"],
  ["experts and their availability", "npm run db:seed"],
  /* After the seed: it writes one product per expert that exists. */
  ["one product per expert", "npx tsx scripts/add-expert-products.ts"],
];

async function main() {
  /*
     Resolved the way drizzle.config.ts, the seed and every migration script
     resolve it — through migrationConnection(), which accepts four names and
     prefers DATABASE_URL. Reading DATABASE_URL directly would have checked a
     string that is not necessarily the one being dropped.
  */
  let url: string;
  let from: string;
  try {
    ({ url, from } = migrationConnection());
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const host = hostOf(url);

  if (!host || !LOCAL.has(host)) {
    console.error(
      [
        "db:reset drops the whole schema, so it only runs against a local",
        "database — and this is not one.",
        "",
        `  ${from} resolves to host ${host ?? "something unparseable"}`,
        "",
        "Start the local database with `npm run db:local` and point",
        "DATABASE_URL at 127.0.0.1:5432 first.",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(`Rebuilding ${from} at ${host}. Everything in it is about to go.`);
  console.log("");

  /* cascade reports every dependent object as a NOTICE; twenty tables of it. */
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    process.stdout.write(`  ${"dropping what is there".padEnd(44)} `);
    await sql.unsafe("drop schema if exists public cascade");
    await sql.unsafe("create schema public");
    /* db:migrate keeps its journal here; a stale one outlives the tables. */
    await sql.unsafe("drop schema if exists drizzle cascade");
    console.log("ok");
  } catch (err) {
    console.log("FAILED");
    console.error(`\n${err instanceof Error ? err.message : String(err)}`);
    await sql.end();
    process.exit(1);
  }
  await sql.end();

  const broken: string[] = [];

  for (const [label, command] of STEPS) {
    process.stdout.write(`  ${label.padEnd(44)} `);
    try {
      execSync(command, { stdio: ["ignore", "pipe", "pipe"] });
      console.log("ok");
    } catch {
      broken.push(command);
      console.log("FAILED");
    }
  }

  console.log("");

  if (broken.length) {
    console.log(`${broken.length} step(s) failed, so the database is not ready. Run`);
    console.log("each of these on its own to see why:");
    for (const c of broken) console.log(`  ${c}`);
    process.exit(1);
  }

  console.log("Ready. `npm run verify` should pass against it.");
  console.log("");
  console.log("Not done here, because it is a decision rather than a baseline:");
  console.log("  npx tsx scripts/add-operator.ts you@example.in   # ops console access");
}

main();
