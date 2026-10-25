"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * What you told us, already in the boxes.
 *
 * TWO PROBLEMS, ONE FIX.
 *
 * The console offers "Update it" next to an intake that has been sent.
 * That opened this form empty, and the API upserts on booking id — so a
 * member who clicked it, glanced at a blank page and pressed send
 * replaced a complete intake with nothing, and their expert arrived at
 * the call with an empty screen. Nobody would have known until it
 * happened.
 *
 * And a returning member retyped their whole book. We tell them in two
 * places that this is "the only work asked of you" and takes about five
 * minutes, then hand them a blank form on the second session while The
 * Log on their own console proves we still hold what they said the first
 * time.
 *
 * The same prefill answers both. `initial` is this booking's own intake
 * when one exists, otherwise the most recent one from any of their other
 * bookings, and the form says which so nobody is surprised by numbers
 * they did not type today.
 */
export type IntakeInitial = {
  holdings: { label: string; pct: number }[];
  holdingsSummary: string;
  goals: string;
  experienceYears: number | null;
  riskComfort: string;
  tradesFno: boolean;
  questions: string;
  /** "this" — an edit of this booking's intake. "previous" — carried forward. */
  source: "this" | "previous";
  /** When the values being shown were last sent, for the line above the form. */
  when: string | null;
};

export default function IntakeForm({
  id,
  initial,
}: {
  id: string;
  initial: IntakeInitial | null;
}) {
  const token = useSearchParams().get("t") ?? "";

  /*
     Three empty rows when there is nothing to carry, and otherwise what
     they last sent — padded back up to three so there is always a spare
     line to type in rather than a form that looks finished.
  */
  const [rows, setRows] = useState<{ label: string; pct: string }[]>(() => {
    const carried = (initial?.holdings ?? []).map((h) => ({
      label: h.label,
      pct: String(h.pct),
    }));
    while (carried.length < 3) carried.push({ label: "", pct: "" });
    return carried;
  });
  const [holdingsSummary, setHoldings] = useState(initial?.holdingsSummary ?? "");
  const [goals, setGoals] = useState(initial?.goals ?? "");
  const [experienceYears, setExperience] = useState(
    initial?.experienceYears == null ? "" : String(initial.experienceYears),
  );
  const [riskComfort, setRisk] = useState(initial?.riskComfort ?? "");
  const [tradesFno, setTradesFno] = useState(initial?.tradesFno ?? false);
  const [questions, setQuestions] = useState(initial?.questions ?? "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const totalPct = rows.reduce((n, r) => n + (Number(r.pct) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/intake`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          holdings: rows
            .map((r) => ({ label: r.label.trim(), pct: Number(r.pct) }))
            .filter((r) => r.label !== "" && Number.isFinite(r.pct)),
          holdingsSummary,
          goals,
          experienceYears: experienceYears === "" ? undefined : Number(experienceYears),
          riskComfort: riskComfort === "" ? undefined : riskComfort,
          tradesFno,
          questions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save that");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="panel">
        <h1>Thank you — that is everything.</h1>
        <p>Your expert has this in front of them on the call.</p>
        <p className="muted">
          You can change any of it up until the session starts — come back to this page and send it
          again.
        </p>
        <a className="b b-line" href={`/booking/${id}`}>
          Back to your booking
        </a>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h1>Before your call</h1>
      <p className="lede">
        Five minutes here saves fifteen on the call. The more concrete you are, the more useful the
        session.
      </p>

      {/*
        Above the security notice, not below it: somebody who sees their
        own numbers already filled in will ask why before they read
        anything else, and an unexplained prefill on a form about money is
        alarming rather than helpful.
      */}
      {initial ? (
        <p className="intake-carried">
          {initial.source === "this"
            ? "This is what you already sent for this call."
            : "This is what you told us last time."}{" "}
          {initial.when ? `Sent ${initial.when}. ` : ""}
          Change anything that has moved — what you send now replaces it.
        </p>
      ) : null}

      <div className="notice">
        Never share a demat or broker login — not here, not with your expert, not with anyone. There
        is no field on this form that asks for one.
      </div>

      {/*
        Rows first, prose second. The rows are what make one session
        comparable to the last; the prose is what a percentage cannot say.
      */}
      <div className="f">
        <span>What are you holding?</span>
        <p className="hint">
          Rough percentages are fine — they only need to be close enough to talk about.
        </p>
        <div className="intake-rows">
          {rows.map((r, i) => (
            <div className="intake-row" key={i}>
              <input
                aria-label={`Holding ${i + 1}`}
                placeholder="e.g. two IT largecaps"
                value={r.label}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
              />
              <div className="intake-pct">
                <input
                  aria-label={`Percentage for holding ${i + 1}`}
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={r.pct}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))
                  }
                />
                <span>%</span>
              </div>
              <button
                type="button"
                className="drop"
                aria-label={`Remove holding ${i + 1}`}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                disabled={rows.length <= 1}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="intake-tools">
          <button
            type="button"
            className="b b-line b-sm"
            onClick={() => setRows([...rows, { label: "", pct: "" }])}
            disabled={rows.length >= 20}
          >
            Add a line
          </button>
          <span className={`intake-total${totalPct > 100 ? " over" : ""}`}>
            {totalPct}% accounted for
          </span>
        </div>
      </div>

      <label className="f">
        <span>Anything the percentages do not say</span>
        <textarea
          rows={4}
          required
          value={holdingsSummary}
          onChange={(e) => setHoldings(e.target.value)}
          placeholder="How you got here, what you keep changing your mind about, anything you would tell a friend about this portfolio."
        />
      </label>

      <label className="f">
        <span>What do you want out of the call?</span>
        <textarea
          rows={3}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="For example: am I too concentrated? Should I be worried about my F&O position sizing?"
        />
      </label>

      <div className="row2">
        <label className="f">
          <span>
            Years investing <em>optional</em>
          </span>
          <input
            type="number"
            min={0}
            max={80}
            value={experienceYears}
            onChange={(e) => setExperience(e.target.value)}
          />
        </label>

        <label className="f">
          <span>
            Comfort with risk <em>optional</em>
          </span>
          <select value={riskComfort} onChange={(e) => setRisk(e.target.value)}>
            <option value="">Prefer not to say</option>
            <option value="low">Low — I want to sleep at night</option>
            <option value="medium">Medium</option>
            <option value="high">High — drawdowns do not bother me</option>
          </select>
        </label>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={tradesFno}
          onChange={(e) => setTradesFno(e.target.checked)}
        />
        <span>I trade futures and options</span>
      </label>

      <label className="f">
        <span>
          Anything specific you want to ask? <em>optional</em>
        </span>
        <textarea rows={3} value={questions} onChange={(e) => setQuestions(e.target.value)} />
      </label>

      {error ? <p className="err">{error}</p> : null}

      <button className="b b-fill full" disabled={busy || holdingsSummary.trim() === ""}>
        {busy ? "Saving…" : "Send to my expert"}
      </button>

      <p className="fineprint">
        This goes only to the expert you booked, and is deleted 90 days after the call.
      </p>
    </form>
  );
}
