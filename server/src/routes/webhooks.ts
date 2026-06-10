/**
 * ────────────────────────────────────────────────────────────
 * Stripe Webhook Handler — /webhooks/stripe
 * ────────────────────────────────────────────────────────────
 *
 * PAYMENT LIFECYCLE OVERVIEW
 * ──────────────────────────
 * Stripe processes payments asynchronously. When a rider requests
 * a ride, we create a PaymentIntent with `capture_method: 'manual'`,
 * which places a HOLD on their card without moving money. The full
 * lifecycle looks like this:
 *
 *   PENDING  →  AUTHORIZED  →  PAID
 *                            →  CANCELLED  (if card fails)
 *
 * 1. PENDING:    Trip created, PaymentIntent sent to Stripe.
 * 2. AUTHORIZED: Stripe confirms the card has sufficient funds
 *                and places a hold (`amount_capturable_updated`).
 * 3. PAID:       After the ride completes we call `capture()`,
 *                and Stripe fires `payment_intent.succeeded`.
 * 4. CANCELLED:  The card was declined or expired; Stripe fires
 *                `payment_intent.payment_failed`.
 *
 * WHY RAW BODY IS REQUIRED
 * ────────────────────────
 * Stripe signs every webhook payload using HMAC-SHA256 over the
 * **exact bytes** it sent. If Express parses the body with
 * `express.json()` first, the re-serialized JSON may differ from
 * the original (key order, whitespace) and the signature check
 * will ALWAYS fail. That's why this route MUST be mounted with
 * `express.raw({ type: 'application/json' })` BEFORE the global
 * `express.json()` middleware in index.ts.
 *
 * WHY WE ALWAYS RETURN 200
 * ────────────────────────
 * Stripe treats any non-2xx response as a delivery failure and
 * will retry the webhook up to ~15 times over 72 hours with
 * exponential backoff. If we returned 500 for an event we simply
 * don't handle, Stripe would keep retrying pointlessly. Worse,
 * for events we DO handle, a transient error + retry could cause
 * duplicate processing. Always returning 200 tells Stripe "I got
 * it, don't send it again."
 * ────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';

// ── Stripe Client ───────────────────────────────────────────
// Initialize with the secret key from environment variables.
// The `apiVersion` is pinned to avoid breaking changes when
// Stripe releases new API versions.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-04-30.basil',
});

/**
 * The webhook signing secret is unique per endpoint and is
 * generated in the Stripe Dashboard (or via `stripe listen`
 * in dev). It starts with `whsec_`.
 */
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

const router = Router();

// ── POST / — Stripe Webhook Receiver ────────────────────────

/**
 * @route   POST /webhooks/stripe
 * @desc    Receives and verifies Stripe webhook events, then
 *          updates the corresponding trip's payment status.
 * @access  Public (called by Stripe's servers, not our users)
 *
 * IMPORTANT: This endpoint expects `req.body` to be a raw Buffer,
 * NOT parsed JSON. The parent app (index.ts) must mount this
 * router with `express.raw({ type: 'application/json' })` before
 * the global `express.json()` middleware. Example:
 *
 *   app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);
 *   app.use(express.json()); // ← after webhook route
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  // ── 1. Verify Signature ─────────────────────────────────
  // The `stripe-signature` header contains a timestamp and one
  // or more signatures. `constructEvent` validates the payload
  // against these to ensure it genuinely came from Stripe and
  // hasn't been tampered with (prevents replay attacks too,
  // since the timestamp is checked).
  const sig = req.headers['stripe-signature'] as string | undefined;

  if (!sig) {
    console.error('[webhook] Missing stripe-signature header');
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    // Signature mismatch — could be a forged request or a
    // misconfigured webhook secret. Log for debugging.
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[webhook] Signature verification failed: ${message}`);
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  // ── 2. Handle Known Event Types ─────────────────────────
  try {
    switch (event.type) {
      /**
       * AUTHORIZED — Card hold placed successfully.
       * At this point, the rider's card has sufficient funds and
       * Stripe has reserved the amount. The money hasn't moved yet;
       * we'll capture it after the ride completes.
       */
      case 'payment_intent.amount_capturable_updated': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const trip = await prisma.trip.findFirst({
          where: { stripePaymentIntentId: paymentIntent.id },
        });

        if (trip) {
          await prisma.trip.update({
            where: { id: trip.id },
            data: { paymentStatus: 'AUTHORIZED' },
          });
          console.log(`[webhook] Payment authorized for trip ${trip.id}`);
        } else {
          // Trip not found — might be a test event or a race condition
          // where the trip hasn't been persisted yet. Log but don't fail.
          console.warn(
            `[webhook] No trip found for PaymentIntent ${paymentIntent.id} (amount_capturable_updated)`
          );
        }
        break;
      }

      /**
       * PAID — Payment captured, money has moved.
       * This fires after we call `stripe.paymentIntents.capture()`
       * when the ride is completed. The driver can now be paid out.
       */
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const trip = await prisma.trip.findFirst({
          where: { stripePaymentIntentId: paymentIntent.id },
        });

        if (trip) {
          await prisma.trip.update({
            where: { id: trip.id },
            data: { paymentStatus: 'PAID' },
          });
          console.log(`[webhook] Payment captured for trip ${trip.id}`);
        } else {
          console.warn(
            `[webhook] No trip found for PaymentIntent ${paymentIntent.id} (succeeded)`
          );
        }
        break;
      }

      /**
       * CANCELLED — Card declined or authorization failed.
       * The rider's card couldn't be charged. In production, we'd
       * emit a Socket.io event to the rider's client so they can
       * update their payment method and retry.
       *
       * NOTE: We set paymentStatus to 'CANCELLED' rather than
       * 'FAILED' because from the trip's perspective, the payment
       * attempt is terminal — the rider must take explicit action
       * (add a new card, retry) to proceed.
       */
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const trip = await prisma.trip.findFirst({
          where: { stripePaymentIntentId: paymentIntent.id },
        });

        if (trip) {
          await prisma.trip.update({
            where: { id: trip.id },
            data: { paymentStatus: 'CANCELLED' },
          });
          console.log(`[webhook] Payment failed for trip ${trip.id}`);

          // TODO (Phase 3): Notify the rider via Socket.io so they
          // can update their payment method in the app.
          // Example: getIO().to(`user:${trip.riderId}`).emit('payment:failed', { tripId: trip.id });
        } else {
          console.warn(
            `[webhook] No trip found for PaymentIntent ${paymentIntent.id} (payment_failed)`
          );
        }
        break;
      }

      /**
       * UNHANDLED — Event type we don't care about (yet).
       * Stripe sends many event types (invoice.*, charge.*, etc.).
       * We log them for observability but always return 200 so
       * Stripe doesn't keep retrying.
       */
      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Database errors or unexpected failures. We still return 200
    // to prevent Stripe retries — the event has been received, and
    // the processing error should be fixed in code, not by retrying.
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[webhook] Error processing event ${event.type}: ${message}`);
  }

  // ── 3. Always Acknowledge ─────────────────────────────────
  // Return 200 regardless of whether we handled the event or not.
  // See the "WHY WE ALWAYS RETURN 200" note at the top of this file.
  res.status(200).json({ received: true });
});

export default router;
