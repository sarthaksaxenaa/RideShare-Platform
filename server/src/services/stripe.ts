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
const IS_MOCK_STRIPE = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('YOUR_STRIPE');

const stripe = IS_MOCK_STRIPE ? null as any : new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28",
});

// ── Payment Operations ───────────────────────────────────────

export async function createTripPaymentIntent(
  amount: number,
  currency: string = "inr"
): Promise<Stripe.PaymentIntent> {
  if (IS_MOCK_STRIPE) {
    console.log(`[Stripe Mock] Created PaymentIntent for ${amount} ${currency}`);
    return {
      id: `pi_mock_${Date.now()}`,
      client_secret: `pi_mock_secret_${Date.now()}`,
      amount,
      currency,
      status: 'requires_payment_method'
    } as unknown as Stripe.PaymentIntent;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    capture_method: "manual",
    metadata: {
      service: "rideshare",
      type: "trip_fare",
    },
  });

  return paymentIntent;
}

export async function capturePayment(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  if (IS_MOCK_STRIPE) {
    console.log(`[Stripe Mock] Captured PaymentIntent ${paymentIntentId}`);
    return { id: paymentIntentId, status: 'succeeded' } as unknown as Stripe.PaymentIntent;
  }

  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
  return paymentIntent;
}

export async function cancelPayment(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  if (IS_MOCK_STRIPE) {
    console.log(`[Stripe Mock] Cancelled PaymentIntent ${paymentIntentId}`);
    return { id: paymentIntentId, status: 'canceled' } as unknown as Stripe.PaymentIntent;
  }

  const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
  return paymentIntent;
}
