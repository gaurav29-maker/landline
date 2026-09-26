"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { CODE_DIGITS, CODE_MINUTES } from "@/lib/member-auth";
import { SIGN_IN_THROTTLE_SECONDS } from "@/lib/constants";

/**
 * Sign in with a phone number and a code.
 *
 * TWO STEPS IN ONE TAB, which is the whole reason this replaced the emailed
 * link. A link asks somebody to leave the browser, find the mail app, wait
 * for it to sync, come back — and land in whichever browser the mail app
 * prefers, signed in somewhere they were not. A code is read off a lock
 * screen and typed where they already are. For an audience who take an OTP
 * from every broker and bank they deal with, it is also simply the expected
 * shape of signing in.
 *
 * The step lives in state rather than in the URL. A phone number is personal
 * data and does not belong in a query string, a history entry or a server
 * access log — so it is held here and posted in a body.
 */

type Step = "phone" | "code";

declare global {
  interface Window {
    turnstile?: { reset: (id?: string) => void };
  }
}

/** The tricolour, drawn rather than fetched. A flag is not worth a request. */
function IndiaFlag() {
  return (
    <svg viewBox="0 0 21 14" width="21" height="14" aria-hidden="true" className="signin-flag">
      <rect width="21" height="14" rx="1.5" fill="#fff" />
      <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h18A1.5 1.5 0 0 1 21 1.5V4.7H0Z" fill="#FF9933" />
      <path d="M0 9.3h21v3.2a1.5 1.5 0 0 1-1.5 1.5h-18A1.5 1.5 0 0 1 0 12.5Z" fill="#138808" />
      <circle cx="10.5" cy="7" r="1.6" fill="none" stroke="#000080" strokeWidth="0.7" />
    </svg>
  );
}

const TURNSTILE_FIELD = "input[name='cf-turnstile-response']";

export default function PhoneSignIn({ siteKey }: { siteKey?: string }) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitLeft, setWaitLeft] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  /* The resend countdown, which mirrors the server's own throttle exactly. */
  useEffect(() => {
    if (waitLeft <= 0) return;
    const t = setTimeout(() => setWaitLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [waitLeft]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const digits = phone.replace(/\D/g, "").slice(0, 10);
  /* Said aloud as five and five here, so it is grouped that way as it is typed. */
  const shown = digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

  const resetTurnstile = useCallback(() => {
    try {
      window.turnstile?.reset();
    } catch {
      /* A widget that will not reset is not a reason to block a retry. */
    }
  }, []);

  const sendCode = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (busy) return;
      setError(null);

      if (digits.length !== 10) {
        setError("That does not look like an Indian mobile number.");
        return;
      }

      /* Turnstile drops its token into a hidden input inside this form. */
      const field = formRef.current?.querySelector(TURNSTILE_FIELD) as HTMLInputElement | null;

      setBusy(true);
      try {
        const res = await fetch("/api/member/code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: `+91${digits}`, turnstile: field?.value ?? null }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };

        if (!data.ok) {
          setError(
            data.error === "human"
              ? "Tick the box to confirm you are human, then try again."
              : "Something went wrong. Try again in a moment.",
          );
          resetTurnstile();
          return;
        }

        setStep("code");
        setCode("");
        setWaitLeft(SIGN_IN_THROTTLE_SECONDS);
      } catch {
        setError("Could not reach Landline. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, digits, resetTurnstile],
  );

  const submitCode = useCallback(
    async (value: string) => {
      if (busy) return;
      setError(null);
      setBusy(true);
      try {
        const res = await fetch("/api/member/code/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: `+91${digits}`, code: value }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };

        if (data.ok) {
          /*
            A full navigation, not a router push. The session cookie was just
            set, and every server component above this needs to render again
            knowing about it.
          */
          window.location.assign("/member");
          return;
        }

        setCode("");
        codeRef.current?.focus();
        setError(
          data.error === "attempts"
            ? "Too many tries. Ask for a new code."
            : "That code is not right. Check the digits and try again.",
        );
      } catch {
        setError("Could not reach Landline. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, digits],
  );

  function onCodeChange(value: string) {
    const only = value.replace(/\D/g, "").slice(0, CODE_DIGITS);
    setCode(only);
    /*
      Submits itself at six digits. Nobody types a code and then hunts for a
      button, and the tap-to-fill-from-notification case has no keystroke
      left to spend on one.
    */
    if (only.length === CODE_DIGITS) void submitCode(only);
  }

  if (step === "code") {
    return (
      <div className="signin-body">
        <h1 className="signin-h">Enter your code</h1>
        <p className="signin-sub">
          Sent to +91 {shown}. It expires in {CODE_MINUTES} minutes.
        </p>

        <form
          className="signin-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submitCode(code);
          }}
        >
          <label className="signin-label" htmlFor="code">
            Six-digit code
          </label>
          <input
            id="code"
            ref={codeRef}
            className="signin-code"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_DIGITS}
            placeholder="000000"
            aria-describedby={error ? "signin-error" : undefined}
            disabled={busy}
          />

          {error ? (
            <p className="signin-error" id="signin-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="b b-fill signin-go" type="submit" disabled={busy || code.length === 0}>
            {busy ? "Checking…" : "Verify and sign in"}
          </button>
        </form>

        <p className="signin-alt">
          {waitLeft > 0 ? (
            <span className="signin-wait">Ask for a new code in {waitLeft}s</span>
          ) : (
            <button type="button" className="signin-link" onClick={() => void sendCode()}>
              Send a new code
            </button>
          )}
          <span className="signin-dot">·</span>
          <button
            type="button"
            className="signin-link"
            onClick={() => {
              setStep("phone");
              setError(null);
              setCode("");
            }}
          >
            Use a different number
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="signin-body">
      {siteKey ? (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      ) : null}

      <h1 className="signin-h">Sign in to Landline</h1>
      <p className="signin-sub">We&rsquo;ll text you a code to sign in.</p>

      <form className="signin-form" ref={formRef} onSubmit={sendCode}>
        <label className="signin-label" htmlFor="phone">
          Mobile number
        </label>
        {/*
          A fixed prefix, not a country picker.

          Landline prices in rupees, settles through an Indian gateway and
          texts through an Indian DLT registration, so a picker would have one
          usable option — the same empty control as a radiogroup with one
          choice. When a second country is genuinely sold to, this becomes a
          real picker and lib/phone grows to match.
        */}
        <div className="signin-phone">
          <span className="signin-cc">
            <IndiaFlag />
            +91
          </span>
          <input
            id="phone"
            className="signin-num"
            value={shown}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            aria-describedby={error ? "signin-error" : undefined}
            autoFocus
            disabled={busy}
          />
        </div>

        {error ? (
          <p className="signin-error" id="signin-error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="signin-legal">
          By tapping Send code you agree to Landline&rsquo;s <a href="/legal/terms">Terms</a> and to
          receiving a one-time SMS at this number, and you acknowledge the{" "}
          <a href="/legal/privacy">Privacy Policy</a>. Message rates may apply.
        </p>

        {siteKey ? <div className="cf-turnstile" data-sitekey={siteKey} /> : null}

        <button className="b b-fill signin-go" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send code"}
        </button>
      </form>

      {/*
        The emailed link, still here and deliberately quiet.

        Phone only became the way in today; every member who booked before
        that has an address on file and may have no number at all. Removing
        this would lock them out of sessions they have already paid for.
      */}
      <p className="signin-alt">
        <a className="signin-link" href="/member/login?email=1">
          Sign in with email instead
        </a>
      </p>
    </div>
  );
}
