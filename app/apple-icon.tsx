import { ImageResponse } from "next/og";
import { Mark } from "@/lib/brand-icon";

export const runtime = "nodejs";
/** 180 is what iOS asks for; everything smaller it downsamples itself. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The Home Screen icon, built to Apple's App Icon Template rules.
 *
 * WHAT THAT TEMPLATE IS ACTUALLY FOR, and the reason this file exists:
 * an iOS app icon is supplied as a FULL-BLEED SQUARE with no transparency
 * and no corner radius of its own. The system masks it with a continuous
 * corner — the squircle, which is not a rounded rectangle and cannot be
 * approximated with border-radius. Round it yourself and iOS rounds your
 * rounding, leaving a pale square of ground peeking out at each corner.
 * So `inset` is 0 here and 7 in app/icon.tsx, which is a browser tab and
 * is masked by nobody.
 *
 * THE SAFE AREA. That mask cuts roughly 11% in at the corners, so the
 * mark is laid out at 46% of the canvas and centred — well inside
 * anything the squircle takes, at any of the sizes iOS downsamples to.
 *
 * Landline had no apple-touch-icon at all before this. A phone adding the
 * site to its Home Screen got a screenshot of the page, scaled to a
 * thumbnail, which is what iOS does when nothing is declared.
 */
export default function AppleIcon() {
  return new ImageResponse(<Mark size={size.width} inset={0} />, size);
}
