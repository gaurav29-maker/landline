import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { expertProducts, experts } from "@/lib/db/schema";
import { SLOT_MINUTES } from "@/lib/slots";

/**
 * What an expert sells, and the one place that writes the cached price.
 *
 * THE DRIFT THIS EXISTS TO PREVENT
 *
 * expert_products is authoritative for price and duration. But the listing
 * page sorts and filters on price across every expert, and doing that against
 * a child table means a subquery per row — so experts.price_paise stays as a
 * denormalised "from" price.
 *
 * Two columns holding the same fact is how they end up disagreeing. So there
 * is exactly one function that writes the cached one, it always derives it
 * from the products, and every path that changes a product calls it. Nothing
 * else may set experts.price_paise — if you find yourself wanting to, you
 * want changeProductPrice() instead.
 */

export type ExpertProduct = typeof expertProducts.$inferSelect;

/** The slug every expert's first product gets, from the days of one price. */
export const DEFAULT_PRODUCT_SLUG = "audit";

/**
 * Recompute the cached "from" price on the expert row.
 *
 * The cheapest ACTIVE product, because that is what "from ₹X" means on a
 * listing. An expert with nothing active keeps whatever they had rather than
 * dropping to zero — a hidden catalogue is a temporary state, and a free
 * session is not a thing anybody meant to offer.
 */
export async function syncExpertFromProducts(expertId: string): Promise<void> {
  const [cheapest] = await db
    .select({ pricePaise: expertProducts.pricePaise })
    .from(expertProducts)
    .where(and(eq(expertProducts.expertId, expertId), eq(expertProducts.status, "active")))
    .orderBy(asc(expertProducts.pricePaise))
    .limit(1);

  if (!cheapest) return;

  await db
    .update(experts)
    .set({ pricePaise: cheapest.pricePaise, updatedAt: new Date() })
    .where(eq(experts.id, expertId));
}

/** Everything this expert currently offers, in the order they chose. */
export async function activeProducts(expertId: string): Promise<ExpertProduct[]> {
  return db
    .select()
    .from(expertProducts)
    .where(and(eq(expertProducts.expertId, expertId), eq(expertProducts.status, "active")))
    .orderBy(asc(expertProducts.sortOrder), asc(expertProducts.pricePaise));
}

/**
 * One product, by slug, only if it is on sale.
 *
 * Scoped to the expert as well as the slug, so a slug belonging to somebody
 * else is a miss rather than a way to buy one expert's session at another's
 * price. Hidden products are a miss too: the booking routes resolve through
 * here, so hiding a product stops it being bookable without any other change.
 */
export async function bookableProduct(
  expertId: string,
  slug: string,
): Promise<ExpertProduct | null> {
  const [row] = await db
    .select()
    .from(expertProducts)
    .where(
      and(
        eq(expertProducts.expertId, expertId),
        sql`lower(${expertProducts.slug}) = ${slug.toLowerCase()}`,
        eq(expertProducts.status, "active"),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * The one an expert sells if a request does not say which.
 *
 * Every booking link that predates products omits the slug, and so does a
 * bare /experts/[slug] visit. Falls back to the cheapest active product
 * rather than erroring, so an expert who renamed their only product does not
 * silently stop being bookable.
 */
export async function defaultProduct(expertId: string): Promise<ExpertProduct | null> {
  const bySlug = await bookableProduct(expertId, DEFAULT_PRODUCT_SLUG);
  if (bySlug) return bySlug;

  const [cheapest] = await activeProducts(expertId);
  return cheapest ?? null;
}

/**
 * Change a price, then refresh the cache. Both, or neither.
 *
 * The ops console and the expert's own profile both reprice; this is the only
 * path either of them may take. A transaction so a failure cannot leave the
 * product changed and the listing showing the old number.
 */
export async function changeProductPrice(productId: string, pricePaise: number): Promise<void> {
  const [row] = await db
    .update(expertProducts)
    .set({ pricePaise, updatedAt: new Date() })
    .where(eq(expertProducts.id, productId))
    .returning({ expertId: expertProducts.expertId });

  if (row) await syncExpertFromProducts(row.expertId);
}

/**
 * Give an expert their first product, from the price they already had.
 *
 * Called when an expert is created and by the backfill. Idempotent on the
 * (expert, slug) unique index, so running it twice is a no-op rather than a
 * second identical product.
 */
export async function ensureDefaultProduct(
  expertId: string,
  pricePaise: number,
): Promise<void> {
  await db
    .insert(expertProducts)
    .values({
      expertId,
      slug: DEFAULT_PRODUCT_SLUG,
      name: "Portfolio audit",
      blurb: "A read of what you hold, and a conversation about it.",
      minutes: SLOT_MINUTES,
      pricePaise,
    })
    .onConflictDoNothing();
}
