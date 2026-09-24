import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * A local Postgres for development, with nothing to install and no account.
 *
 * PGlite is Postgres compiled to WebAssembly; the socket server puts it behind
 * the real wire protocol, so the app connects with an ordinary connection
 * string and neither Drizzle nor postgres.js knows the difference.
 *
 * DEVELOPMENT ONLY. Data lives in .pglite/ on this machine, there is no
 * backup, no concurrency to speak of, and no durability guarantee. Production
 * still needs a real Postgres — Neon or Supabase.
 *
 * KNOWN DEFECT IN THIS SETUP, measured rather than suspected: the socket
 * server loses the statement issued immediately after an error response on
 * the same connection. Provoke a constraint violation, catch it, and run one
 * more statement, and that statement is silently dropped — no error, an
 * empty result, and sometimes a result belonging to a different query.
 *
 *   insert / provoke 23505 / update, 40 runs   5 updates lost
 *   the same without the provoked error        0 lost
 *   the same against PGlite in-process         0 lost (19/25 over the socket)
 *
 * The rate moves run to run — 1 in 40 to 8 in 40 — so a clean run proves
 * nothing; only repetition does.
 *
 * So it is this socket layer, not PGlite and not Postgres. Version 0.2.11,
 * which is the latest published; there is nothing to upgrade to.
 *
 * It matters because eight route handlers catch 23505 deliberately — the
 * double-booking guards, the bundle and membership holds, the Razorpay
 * webhook de-duplication and the apply form. In development, whatever those
 * do next may quietly not happen. It cannot affect production, which talks
 * to a real Postgres over a real wire protocol; that is exactly why no
 * workaround for it lives in lib/db. scripts/verify-flow.ts handles it
 * where it provokes one, and explains the measurements in full.
 *
 *   npm run db:local     (leave running)
 *   npm run db:push      (in another terminal)
 *   npm run db:seed
 */

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5432);
/*
 * Kept OUT of the project directory on purpose. This repo lives inside
 * OneDrive, whose syncing has already corrupted .next twice; a database
 * directory being synced mid-write is a worse version of the same problem.
 */
const DIR = process.env.LOCAL_DB_DIR ?? path.join(os.tmpdir(), "landline-pglite");

async function main() {
  fs.mkdirSync(DIR, { recursive: true });

  const db = await PGlite.create({ dataDir: DIR });
  /*
 * maxConnections defaults to ONE. With that, drizzle-kit holds the single
 * slot and every later client — the seed, the dev server, a second tab — is
 * rejected outright, which surfaces as an unexplained ECONNRESET.
 */
const server = new PGLiteSocketServer({
  db,
  port: PORT,
  host: "127.0.0.1",
  maxConnections: 20,
});

  await server.start();

  console.log(`\n  Local Postgres ready on port ${PORT}`);
  console.log(`  Data in ${DIR}\n`);
  console.log("  Put this in .env.local:\n");
  console.log(`    DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres"\n`);
  console.log("  Then, in another terminal: npm run db:push && npm run db:seed\n");
  console.log("  Ctrl-C to stop. Development only — production needs a real Postgres.\n");

  const close = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
