import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { expertApplications } from "@/lib/db/schema";
import { istDateTime, rupees } from "@/lib/format";
import { EXPERT_SHARE_BPS, SINGLE_CALL_PAISE } from "@/lib/constants";
import { rateForSession } from "@/lib/payouts";
import NoDatabase from "@/components/ops/NoDatabase";
import { approveApplication, rejectApplication } from "../actions";

export const dynamic = "force-dynamic";

const SPECIALTY_LABEL: Record<string, string> = {
  portfolio_audit: "Portfolio audits",
  fno_systematic: "F&O, systematically",
};

async function load() {
  try {
    const open = await db
      .select()
      .from(expertApplications)
      .where(eq(expertApplications.status, "new"))
      .orderBy(desc(expertApplications.createdAt));

    const decided = await db
      .select()
      .from(expertApplications)
      .orderBy(desc(expertApplications.reviewedAt))
      .limit(40);

    return { open, decided: decided.filter((a) => a.status !== "new").slice(0, 20) };
  } catch {
    return null;
  }
}

export default async function OpsApplications() {
  const data = await load();
  if (data === null) return <NoDatabase />;

  const { open, decided } = data;

  return (
    <>
      <h1 className="ops-h1">Applications</h1>
      <p className="ops-muted ops-lede">
        Approving creates the expert as <b>draft</b> at the rate shown on their card, emails them a
        sign-in link, and gives them one session to sell. They set their own hours and can change
        the rate themselves from there, and you publish them from Experts once they have. Nothing
        appears on the site until you do.
      </p>

      {open.length === 0 ? (
        <p className="ops-muted">Nothing waiting.</p>
      ) : (
        <div className="ops-expert-list">
          {open.map((a) => (
            <div key={a.id} className="ops-panel ops-application">
              <div className="ops-expert-head">
                <div>
                  <h2 className="ops-h2">{a.name}</h2>
                  {/*
                    Their words and the structured fields kept apart. The
                    headline is published as written; the specialties and years
                    drive the profile record. They often overlap, and a reviewer
                    needs to see each for what it is.
                  */}
                  <p className="ops-app-quote">&ldquo;{a.headline}&rdquo;</p>
                  <p className="ops-muted">
                    {a.yearsExperience} yrs ·{" "}
                    {a.specialties.map((s) => SPECIALTY_LABEL[s] ?? s).join(", ")} · {a.email}
                    {a.phone ? ` · ${a.phone}` : ""}
                  </p>
                </div>
                <span className="ops-sub">{istDateTime(a.createdAt)} IST</span>
              </div>

              {/*
                The registration claim is put where it cannot be skimmed past.
                It is the one field on this form that has to be checked against
                the SEBI register by a person before anyone is approved.
              */}
              <p className="ops-app-sebi">
                {a.sebiRegType === "none" || !a.sebiRegNumber ? (
                  <span className="pill warn">claims no SEBI registration</span>
                ) : (
                  <>
                    <span className="pill">
                      claims {a.sebiRegType.toUpperCase()} · {a.sebiRegNumber}
                    </span>{" "}
                    <span className="ops-muted">verify on the SEBI register, and check the background below, before approving</span>
                  </>
                )}
              </p>

              {/*
                The background sits with the registration claim rather than
                with the prose, because they are the two facts approval turns
                on. One is checked against the SEBI register; this one is
                checked against whatever the applicant can show you.
              */}
              {a.background ? (
                <p className="ops-app-meta ops-app-bg">
                  <b>Background</b> {a.background}
                </p>
              ) : (
                <p className="ops-app-meta">
                  <span className="pill warn">no background given</span>
                </p>
              )}

              <p className="ops-app-bio">{a.bio}</p>
              {a.links ? (
                <p className="ops-muted ops-app-meta">
                  <b>Links</b> {a.links}
                </p>
              ) : null}
              {a.note ? (
                <p className="ops-muted ops-app-meta">
                  <b>Note</b> {a.note}
                </p>
              ) : null}

              {/*
                The rate, last thing before the buttons.

                Approving writes this number onto the expert AND onto the first
                product they will sell, so it is a decision, not a detail — it
                belongs under the reviewer's thumb rather than up with the
                contact line. The standard rate is spelled out when they left
                the field blank, because blank and 5,499 approve to the same
                price and nobody should have to remember that.

                Their cut is shown next to it for the same reason: the number
                the applicant cares about is what reaches them, and working it
                out in your head at approval time is how somebody gets put on
                a rate nobody intended.
              */}
              <p className="ops-app-meta ops-app-rate">
                <b>Rate</b>{" "}
                {a.askedPricePaise === null ? (
                  <>
                    {rupees(SINGLE_CALL_PAISE)}{" "}
                    <span className="ops-muted">
                      standard — they did not ask for one
                    </span>
                  </>
                ) : (
                  <>
                    {rupees(a.askedPricePaise)}{" "}
                    {a.askedPricePaise === SINGLE_CALL_PAISE ? (
                      <span className="ops-muted">asked for, which is the standard rate</span>
                    ) : (
                      <span className="pill warn">
                        asked for · standard is {rupees(SINGLE_CALL_PAISE)}
                      </span>
                    )}
                  </>
                )}{" "}
                <span className="ops-muted">
                  · they keep {rupees(rateForSession(a.askedPricePaise ?? SINGLE_CALL_PAISE))} of it (
                  {EXPERT_SHARE_BPS / 100}%)
                </span>
              </p>

              <div className="ops-app-actions">
                <form action={approveApplication}>
                  <input type="hidden" name="applicationId" value={a.id} />
                  <button className="ops-btn primary" type="submit">
                    Approve
                  </button>
                </form>
                <form action={rejectApplication} className="ops-inline">
                  <input type="hidden" name="applicationId" value={a.id} />
                  <input
                    name="reviewNote"
                    className="ops-input"
                    placeholder="Reason, for our own records"
                  />
                  <button className="ops-btn" type="submit">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <>
          <h2 className="ops-h2 ops-decided-h">Decided</h2>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                  <th>Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      <span className="ops-sub">{a.email}</span>
                    </td>
                    <td>
                      <span className={`pill s-${a.status}`}>{a.status}</span>
                    </td>
                    <td>{a.reviewNote ?? <span className="ops-muted">—</span>}</td>
                    <td>{a.reviewedAt ? `${istDateTime(a.reviewedAt)} IST` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
