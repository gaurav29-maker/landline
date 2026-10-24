import { ImageResponse } from "next/og";
import { Mark } from "@/lib/brand-icon";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * The browser tab icon.
 *
 * IT USED TO RENDER THE LETTER "b". On a site called Landline, in a file
 * nobody opens, on the one asset that appears in every tab, every
 * bookmark and every history entry. No page displays a favicon in a way
 * that makes it obvious, which is exactly how it survived.
 *
 * Same mark as the Home Screen icon now, out of the same module, so the
 * two cannot drift apart. The only difference is the corner: a tab icon
 * is masked by nobody, so this one rounds itself — see app/apple-icon.tsx
 * for why that one must not.
 */
export default function Icon() {
  return new ImageResponse(<Mark size={size.width} inset={7} />, size);
}
