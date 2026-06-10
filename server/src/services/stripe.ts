/**
 * ────────────────────────────────────────────────────────────
 * Stripe Payment Service — Authorize, Capture, Cancel
 * ────────────────────────────────────────────────────────────
 *
 * This service wraps the Stripe SDK to implement the
 * **authorize-then-capture** payment pattern, which is standard
 * in ride-hailing and on-demand delivery apps.
 *
 * THE AUTHORIZE-THEN-CAPTURE FLOW:
 *
 *  1. AUTHORIZE (createTripPaymentIntent):
 *     When a rider confirms a trip, we create a PaymentIntent
 *     with `capture_method: 'manual'`. This places a HOLD on
 *     the rider's card for the estimated fare but does NOT move
 *     any money yet. The rider sees a "pending" charge.
 *
 *  2. CAPTURE (capturePayment):
 *     When the driver taps "Trip Complete", we call
 *     `paymentIntents.capture()`. NOW the money actually moves
 *     from the rider's account to our Stripe balance. We can
 *     optionally capture a different (lower) amount if the
 *     actual fare is less than the estimate.
 *
 *  3. CANCEL (cancelPayment):
 *     If the trip is cancelled (by either party), we cancel the
 *     PaymentIntent. This releases the hold on the rider's card
 *     immediately — no money moves, no refund needed.
 *
 * WHY THIS PATTERN?
 *  - We don't know the final fare upfront (it depends on actual
 *    distance/time, tolls, surge, etc.)
 *  - We need to guarantee the rider CAN pay before the driver
 *    commits (the hold verifies sufficient funds)
 *  - If the trip is cancelled, we want a clean release — not a
 *    charge-then-refund which takes days to process
 *
 * STRIPE HOLD DURATION:
 *  - Card authorizations expire after 7 days (Stripe default)
 *  - For rides, this is plenty — a trip should complete within
 *    hours, not days
 *  - If an authorization expires uncaptured, the hold is
 *    automatically released
 * ────────────────────────────────────────────────────────────
 */

import Stripe from "stripe";

// ── Stripe Client Initialization ─────────────────────────────

/**
 * Initialize the Stripe SDK with the secret key from environment.
 *
 * WHY `apiVersion` IS PINNED:
 * Stripe makes breaking changes across API versions. Pinning
 * ensures our integration doesn't silently break when Stripe
 * releases a new version. We upgrade explicitly after testing.
 *
 * The `!` assertion is safe here because if the key is missing,
 * Stripe's constructor will throw an informative error immediately
 * at startup — fail-fast is exactly what we want.
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28",
});

// ── Payment Operations ───────────────────────────────────────

/**
 * Create a PaymentIntent with manual capture (authorize only).
 *
 * This places a hold on the rider's card for the estimated fare
 * amount. No money is moved at this stage — the charge stays
 * "pending" on the rider's bank statement.
 *
 * The returned PaymentIntent contains a `client_secret` which
 * the frontend uses with Stripe.js to confirm the payment on
 * the client side (3D Secure, card authentication, etc.).
 *
 * @param amount   - Fare amount in the smallest currency unit.
 *                   For INR, this is paise (₹100 = 10000 paise).
 *                   For USD, this is cents ($1.00 = 100 cents).
 *                   Using smallest units avoids floating-point
 *                   rounding issues with money.
 * @param currency - ISO 4217 currency code, lowercase.
 *                   Defaults to 'inr' for the Indian market.
 * @returns The full Stripe PaymentIntent object.
 *
 * @example
 * ```ts
 * // Authorize ₹250.00 (25000 paise)
 * const intent = await createTripPaymentIntent(25000, 'inr');
 * // Send intent.client_secret to the frontend
 * ```
 */
export async function createTripPaymentIntent(
  amount: number,
  currency: string = "inr"
): Promise<Stripe.PaymentIntent> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    // 'manual' = authorize only, don't charge yet.
    // We'll call capturePayment() when the trip completes.
    capture_method: "manual",
    // Metadata helps us trace payments back to business events
    // in the Stripe dashboard and webhooks.
    metadata: {
      service: "rideshare",
      type: "trip_fare",
    },
  });

  return paymentIntent;
}

/**
 * Capture a previously authorized PaymentIntent.
 *
 * This is called when the driver taps "Trip Complete" — the money
 * actually moves from the rider's bank account to our Stripe
 * balance at this point.
 *
 * IMPORTANT: A PaymentIntent can only be captured if:
 *  1. It was created with `capture_method: 'manual'`
 *  2. Its status is `requires_capture`
 *  3. The authorization hasn't expired (7-day window)
 *
 * If the actual fare is lower than the authorized amount, Stripe
 * allows partial capture — the remaining hold is automatically
 * released. We could pass `amount_to_capture` here in the future
 * to support this.
 *
 * @param paymentIntentId - The Stripe PaymentIntent ID (starts with 'pi_')
 * @returns The captured PaymentIntent (status will be 'succeeded')
 *
 * @example
 * ```ts
 * // Driver completes the trip
 * const captured = await capturePayment('pi_3abc123...');
 * // captured.status === 'succeeded'
 * ```
 */
export async function capturePayment(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
  return paymentIntent;
}

/**
 * Cancel a previously authorized PaymentIntent.
 *
 * This releases the hold on the rider's card — no money moves,
 * and the rider sees the pending charge disappear from their
 * bank statement (usually within 1-3 business days depending
 * on the bank).
 *
 * Called when:
 *  - The rider cancels the trip before the driver arrives
 *  - The driver cancels (no-show, vehicle issue, etc.)
 *  - The system cancels (no driver found within timeout)
 *
 * This is much cleaner than charge-then-refund because:
 *  1. No money moves, so no refund processing time
 *  2. The rider's available credit is restored immediately on
 *     Stripe's side (bank may take 1-3 days to reflect)
 *  3. No refund fees (some payment processors charge for refunds)
 *
 * @param paymentIntentId - The Stripe PaymentIntent ID (starts with 'pi_')
 * @returns The cancelled PaymentIntent (status will be 'canceled')
 *
 * @example
 * ```ts
 * // Rider cancels the trip
 * const cancelled = await cancelPayment('pi_3abc123...');
 * // cancelled.status === 'canceled'
 * ```
 */
export async function cancelPayment(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
  return paymentIntent;
}
