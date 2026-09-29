"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExpertCard } from "./ExpertGrid";
/* BUNDLE_PRICE_PAISE stays: the bundle path still prices correctly if it is
   ever sold again. CREDITS and DAYS went with the option that named them. */
import { BUNDLE_PRICE_PAISE } from "@/lib/constants";
import { SLOT_MINUTES } from "@/lib/slots";

type Slot = { startsAt: string; endsAt: string };
type Step = "picking" | "details" | "paying" | "done";
type Product = "single" | "bundle";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const IST = "Asia/Kolkata";

function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function BookingDialog({
  expert,
  onClose,
}: {
  expert: ExpertCard;
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [step, setStep] = useState<Step>("picking");
  /*
     setProduct has no caller while the bundle is off sale — the picker that
     called it is the commented-out block below. Left as state rather than a
     `const product = "single"` so restoring the second option is putting the
     markup back, with nothing here to rewrite.
  */
  const [product, setProduct] = useState<Product>("single");
  void setProduct;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/experts/${expert.slug}/slots`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load availability"))))
      .then((data: { slots: Slot[] }) => {
        if (cancelled) return;
        setSlots(data.slots);
        const first = data.slots[0];
        if (first) setActiveDay(dayLabel(first.startsAt));
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [expert.slug]);

  const dialogRef = useRef<HTMLDivElement>(null);

  const focusable = useCallback(() => {
    const node = dialogRef.current;
    if (!node) return [] as HTMLElement[];
    return [
      ...node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.offsetParent !== null);
  }, []);

  /*
   * A modal that does not hold focus is a modal only for people using a
   * mouse. Opened, this dialog left focus on the button behind it and Tab
   * walked straight out into the twenty-one focusable elements on the page
   * underneath — which are covered by the backdrop and cannot be seen.
   *
   * So: focus moves into the dialog on open, Tab cycles within it, and focus
   * returns to whatever opened it on close.
   */
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!dialogRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // Returning focus is the half people forget; without it a keyboard user
      // lands back at the top of the document.
      previouslyFocused?.focus?.();
    };
  }, [onClose, focusable]);

  /*
   * Each step replaces the dialog's contents, so the element that had focus
   * is unmounted and focus falls back to <body> — outside the trap, which
   * then has nothing to cycle. Pull it back to the dialog on every step.
   */
  useEffect(() => {
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
  }, [step]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const key = dayLabel(s.startsAt);
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [slots]);

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setSubmitError(null);

    try {
      const endpoint = product === "bundle" ? "/api/bundles/hold" : "/api/bookings/hold";
      const holdRes = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expertSlug: expert.slug,
          startsAt: chosen.startsAt,
          name,
          email,
          phone,
          disclaimerAccepted: true,
        }),
      });
      const hold = await holdRes.json();
      if (!holdRes.ok) throw new Error(hold.error ?? "Could not hold that slot");

      const orderRes = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: hold.bookingId }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error ?? "Could not start payment");

      const ready = await loadRazorpay();
      if (!ready || !window.Razorpay) throw new Error("Payment could not load. Check your connection.");

      setStep("paying");

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: "INR",
        name: "Landline",
        description: order.description,
        prefill: order.prefill,
        theme: { color: "#387ED1" },
        // The webhook confirms the booking. This only moves the browser on.
        handler: () => {
          window.location.href = `/booking/${hold.bookingId}`;
        },
        modal: {
          ondismiss: () => {
            setStep("details");
            setBusy(false);
            setSubmitError("Payment was cancelled. Your slot is held for a few more minutes.");
          },
        },
      });
      rzp.open();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setStep("details");
    }
  }

  const days = [...byDay.keys()];
  const canConfirm = name.trim() !== "" && /.+@.+\..+/.test(email) && accepted && !busy;

  return (
    <div className="bp-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bp-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Book a call with ${expert.displayName}`}
      >
        <div className="bp-dialog-head">
          <div>
            <p className="bp-dialog-title">{expert.displayName}</p>
            <p className="bp-dialog-sub">
              {rupees(expert.pricePaise)} · times shown in IST
            </p>
          </div>
          <button className="bp-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {step === "picking" ? (
          <div className="bp-body">
            {loadError ? <p className="bp-error">{loadError}</p> : null}
            {slots === null && !loadError ? <p className="bp-muted">Loading availability…</p> : null}
            {slots !== null && slots.length === 0 ? (
              <p className="bp-muted">
                No open slots in the next three weeks. Try another expert.
              </p>
            ) : null}

            {days.length > 0 ? (
              <>
                <div className="bp-day-tabs">
                  {days.map((d) => (
                    <button
                      key={d}
                      className={`bp-day${d === activeDay ? " is-active" : ""}`}
                      onClick={() => setActiveDay(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="bp-slot-grid">
                  {(byDay.get(activeDay ?? "") ?? []).map((s) => (
                    <button
                      key={s.startsAt}
                      className={`bp-slot${chosen?.startsAt === s.startsAt ? " is-active" : ""}`}
                      onClick={() => setChosen(s)}
                    >
                      {timeLabel(s.startsAt)}
                    </button>
                  ))}
                </div>
                <button
                  className="btn-primary bp-full"
                  disabled={!chosen}
                  onClick={() => setStep("details")}
                >
                  {chosen ? `Continue · ${dayLabel(chosen.startsAt)}, ${timeLabel(chosen.startsAt)}` : "Pick a time"}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {step === "details" || step === "paying" ? (
          <div className="bp-body">
            {/*
              There is one product, so there is nothing to choose between.

              This was a two-option radiogroup: one call, or three for 9,999.
              The bundle is no longer sold — see the note on #ways — and a
              radiogroup with a single option is a decision nobody is making.

              `product` stays in state and still posts as "single". The
              bundle branch of this component and /api/bundles/hold behind it
              are untouched, so putting the second option back is restoring
              this block, not rebuilding the path.
            */}
            <p className="bp-product-one">
              <span className="bp-product-name">One call</span>
              <span className="bp-product-price">{rupees(expert.pricePaise)}</span>
              <span className="bp-product-note">{SLOT_MINUTES} minutes, video</span>
            </p>

            <p className="bp-chosen">
              {chosen ? `${dayLabel(chosen.startsAt)} at ${timeLabel(chosen.startsAt)} IST` : ""}
              <button className="bp-change" onClick={() => setStep("picking")}>
                change
              </button>
            </p>

            <label className="bp-field">
              <span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="bp-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            {/*
              Required, and no longer just a way to reach somebody.

              This number is how they sign in afterwards. Asked for here it
              is one more field on a form they are already filling in; asked
              for later it is asked of somebody who is already locked out of
              a session they paid for.

              Prefix fixed at +91 for the same reason the sign-in page fixes
              it: one country is sold to, so a picker would have one usable
              option.
            */}
            <label className="bp-field">
              <span>Mobile number</span>
              <div className="bp-phone">
                <span className="bp-phone-cc">+91</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/D/g, "").slice(0, 10))}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  required
                />
              </div>
              <em className="bp-phone-why">You will use this number to sign in.</em>
            </label>

            <label className="bp-check">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                I understand this session is a review and discussion, not personalised investment
                advice or a recommendation to buy or sell any security.
              </span>
            </label>

            {submitError ? <p className="bp-error">{submitError}</p> : null}

            <button className="btn-primary bp-full" disabled={!canConfirm} onClick={confirm}>
              {busy
                ? "Working…"
                : `Pay ${rupees(product === "bundle" ? BUNDLE_PRICE_PAISE : expert.pricePaise)}`}
            </button>
            <p className="bp-fineprint">
              You will never be asked for a demat or broker login — not here, and not on the call.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
