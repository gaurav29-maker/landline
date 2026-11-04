/**
 * The three pictures over "How it works".
 *
 * editlobby's SERVICES cards are a big illustrated panel, a title and a
 * link — abstract geometry on a brand-coloured ground, with floating
 * rounded panels, a dominant central form and small chips around it. That
 * register is what was asked for, and it is worth having: our three steps
 * carried a 40px line icon each, which is a bullet rather than a picture.
 *
 * WHAT IS NOT COPIED IS THEIR SUBJECT. Theirs draw a video editor: a play
 * button, a scrubber, a timeline. Ours draw what our three steps actually
 * are — a question arriving against a list of holdings, a week with one
 * slot taken, and a handset whose signal stops. Same visual language, our
 * own nouns.
 *
 * NOTHING HERE DEPICTS DATA. No figure, no percentage, no chart with a
 * real axis — the bars in the first panel are plain rounded rectangles of
 * arbitrary length, and they are there to read as "a list of things you
 * hold", not as anybody's book. A picture of a portfolio with numbers on
 * it would be the same invention the rest of this site refuses.
 *
 * THE IDS ARE SUFFIXED because three gradients on one page with one id
 * each is one gradient: whichever renders last wins and the other two
 * panels go flat. Found the obvious way, by drawing them all first.
 *
 * Colour comes from var(--accent) and var(--accent-ink) rather than hex,
 * so the set follows the theme like everything else; opacity does the
 * rest of the work so there is one blue on the page, not five.
 */

type ArtProps = { className?: string };

const BOX = "0 0 320 200";

/* 01 — a question arriving against what you hold. */
export function ArtQuestion({ className }: ArtProps) {
  return (
    <svg className={className} viewBox={BOX} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="fa-q-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="16" fill="url(#fa-q-bg)" />
      {/* The list you arrive with. Lengths are arbitrary by design. */}
      <g fill="var(--accent-ink)" opacity="0.28">
        <rect x="32" y="56" width="104" height="10" rx="5" />
        <rect x="32" y="78" width="78" height="10" rx="5" />
        <rect x="32" y="100" width="92" height="10" rx="5" />
        <rect x="32" y="122" width="58" height="10" rx="5" />
      </g>
      {/* The question, put to it. */}
      <circle cx="226" cy="96" r="44" fill="var(--accent)" opacity="0.14" />
      <circle cx="226" cy="96" r="44" stroke="var(--accent)" strokeOpacity="0.4" />
      <path
        d="M216 84a10 10 0 1 1 11.9 9.8c-1.6.3-2.1 1.5-2.1 3v3.3"
        stroke="var(--accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="225.8" cy="110" r="2.4" fill="var(--accent)" />
      <path d="M140 96h34" stroke="var(--accent)" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
    </svg>
  );
}

/* 02 — a week, with one time taken. */
export function ArtSlot({ className }: ArtProps) {
  return (
    <svg className={className} viewBox={BOX} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="fa-s-bg" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="16" fill="url(#fa-s-bg)" />
      <rect x="40" y="38" width="240" height="124" rx="14" stroke="var(--accent)" strokeOpacity="0.32" />
      <path d="M40 66h240" stroke="var(--accent)" strokeOpacity="0.32" />
      {/* Five days, four rows of times, and exactly one of them is gone. */}
      <g fill="var(--accent-ink)" opacity="0.22">
        {[0, 1, 2, 3, 4].map((c) =>
          [0, 1, 2].map((r) =>
            c === 2 && r === 1 ? null : (
              <rect key={`${c}-${r}`} x={58 + c * 42} y={84 + r * 26} width={30} height={14} rx={7} />
            )
          )
        )}
      </g>
      <rect x="142" y="110" width="30" height="14" rx="7" fill="var(--accent)" />
      <circle cx="157" cy="117" r="22" stroke="var(--accent)" strokeOpacity="0.45" />
    </svg>
  );
}

/* 03 — the call, and the line going quiet after it. */
export function ArtCall({ className }: ArtProps) {
  return (
    <svg className={className} viewBox={BOX} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="fa-c-bg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="16" fill="url(#fa-c-bg)" />
      <circle cx="112" cy="100" r="54" fill="var(--accent)" opacity="0.12" />
      <circle cx="112" cy="100" r="54" stroke="var(--accent)" strokeOpacity="0.34" />
      <circle cx="112" cy="100" r="38" stroke="var(--accent)" strokeOpacity="0.22" />
      <path
        d="M99 88c0 14 11 25 25 25l6-6-9-6-4 4a20 20 0 0 1-10-10l4-4-6-9z"
        fill="var(--accent)"
      />
      {/*
        The signal, and then nothing. The amplitude falls to a flat rule
        rather than fading out, because "nothing renews and nobody follows
        up" is the claim this step makes and a fade would soften it.
      */}
      <g stroke="var(--accent)" strokeWidth="3" strokeLinecap="round">
        <path d="M182 100v-26" strokeOpacity="0.75" />
        <path d="M198 100v-38" strokeOpacity="0.6" />
        <path d="M214 100v-18" strokeOpacity="0.45" />
        <path d="M230 100v-8" strokeOpacity="0.3" />
      </g>
      <path d="M182 128h98" stroke="var(--accent-ink)" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
