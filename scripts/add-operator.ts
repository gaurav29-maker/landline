import { loadEnv } from "./load-env";
loadEnv();

import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { opsUsers } from "../lib/db/schema";
import { hashPassword } from "../lib/ops-password";

/**
 * Add, re-password or disable an operator.
 *
 *   npx tsx scripts/add-operator.ts "Gaurav Khona" gaurav@landline.in
 *   npx tsx scripts/add-operator.ts "Gaurav Khona" gaurav@landline.in --reset
 *   npx tsx scripts/add-operator.ts --disable gaurav@landline.in
 *
 * There is no signup page and there must not be one. The list of people who
 * can refund a payment and approve an adviser should change only when somebody
 * with database access decides it changes — a form on the internet is the
 * wrong shape of door for that.
 *
 * The password is generated here rather than chosen. A password somebody picks
 * for an internal console is a password they already use somewhere else, and
 * this one guards the button that moves money. Printed once, to this terminal,
 * and never stored in readable form — the row holds a scrypt hash. Lose it and
 * run --reset; there is deliberately no recovery path that does not involve
 * database access.
 */

function usage(): never {
  console.error(
    [
      "Usage:",
      '  npx tsx scripts/add-operator.ts "Full Name" email@example.in [--reset]',
      "  npx tsx scripts/add-operator.ts --disable email@example.in",
    ].join("\n"),
  );
  process.exit(1);
}

/**
 * Readable aloud, and still 62 bits.
 *
 * No l/1/I or O/0, because this password gets read off a screen and typed
 * somewhere else at least once, and an ambiguous character turns that into
 * three attempts and a suspicion that the account is broken.
 */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 6), chars.slice(6, 12), chars.slice(12, 18), chars.slice(18, 24)]
    .map((group) => group.join(""))
    .join("-");
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--disable") {
    const email = args[1];
    if (!email) usage();
    const updated = await db
      .update(opsUsers)
      .set({ status: "disabled" })
      .where(sql`lower(${opsUsers.email}) = ${email.toLowerCase()}`)
      .returning({ email: opsUsers.email });

    if (updated.length === 0) {
      console.error(`No operator with that address: ${email}`);
      process.exit(1);
    }
    /*
       Disabled, never deleted. Their events stay, and an audit row pointing
       at a row that no longer exists is not an audit row. Their cookie stops
       working on their next action, because requireOperator re-reads status
       rather than trusting the seven-day cookie.
    */
    console.log(`Disabled ${updated[0].email}. Their past events are untouched.`);
    return;
  }

  const [name, email] = args;
  const reset = args.includes("--reset");
  if (!name || !email || !email.includes("@")) usage();

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const [existing] = await db
    .select()
    .from(opsUsers)
    .where(sql`lower(${opsUsers.email}) = ${email.toLowerCase()}`)
    .limit(1);

  if (existing && !reset) {
    console.error(
      `${email} already exists. Pass --reset to give them a new password, ` +
        `or --disable to switch the account off.`,
    );
    process.exit(1);
  }

  if (existing) {
    await db
      .update(opsUsers)
      .set({ name, passwordHash, status: "active" })
      .where(eq(opsUsers.id, existing.id));
  } else {
    await db.insert(opsUsers).values({ name, email, passwordHash });
  }

  console.log("");
  console.log(`  ${existing ? "Reset" : "Created"}  ${name} <${email}>`);
  console.log(`  Password  ${password}`);
  console.log("");
  console.log("  Shown once. It is stored only as a scrypt hash, so it cannot be");
  console.log("  read back out — run this again with --reset if it is lost.");
  console.log("");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
