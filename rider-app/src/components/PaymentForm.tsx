/**
 * ────────────────────────────────────────────────────────────
 * PaymentForm — Stripe Elements Integration
 * ────────────────────────────────────────────────────────────
 *
 * This component handles the payment step in the ride booking flow.
 * It uses Stripe Elements (PaymentElement) which provides:
 *  - PCI-compliant card collection (card data never touches our server)
 *  - 3D Secure authentication (SCA) handling
 *  - Apple Pay, Google Pay, and other payment methods
 *  - Localized UI with built-in validation
 *
 * PAYMENT FLOW:
 * 1. BookingCard calls POST /api/trips to create a trip + PaymentIntent
 * 2. Server returns clientSecret from the PaymentIntent
 * 3. This component wraps Stripe Elements with that clientSecret
 * 4. User enters card details → Stripe.js confirms the payment
 * 5. On success → we emit trip:request via Socket.io to start matching
 *
 * WHY MANUAL CAPTURE?
 * The PaymentIntent uses `capture_method: 'manual'`, which means:
 *  - confirmPayment() only AUTHORIZES (places a hold on the card)
 *  - The actual charge happens when the driver completes the trip
 *  - If the trip is cancelled, the hold is released — rider isn't charged
 * ────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import styles from './PaymentForm.module.css';

// ── Stripe Initialization ───────────────────────────────────
// loadStripe is called ONCE and cached — it loads the Stripe.js
// script from Stripe's CDN. Using the publishable key (pk_test_)
// is safe — it can only create tokens, not charge cards.
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'
);

// ── Types ───────────────────────────────────────────────────

interface PaymentFormProps {
  /** The client secret from the server's PaymentIntent creation */
  clientSecret: string;
  /** Fare amount in paise for display */
  amount: number;
  /** Called when payment is successfully authorized */
  onSuccess: () => void;
  /** Called when the user cancels the payment */
  onCancel: () => void;
}

// ── Inner Form Component ────────────────────────────────────
// Must be a child of <Elements> to access useStripe() and useElements()

function CheckoutForm({
  amount,
  onSuccess,
  onCancel,
}: Omit<PaymentFormProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't loaded yet — shouldn't happen but guard against it
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      /**
       * confirmPayment() triggers the full Stripe flow:
       *  1. Validates card details locally
       *  2. Sends card data directly to Stripe (never touches our server)
       *  3. Handles 3D Secure / SCA challenges if needed
       *  4. AUTHORIZES the payment (manual capture = hold only)
       *
       * redirect: 'if_required' prevents unnecessary page redirects
       * for cards that don't need 3D Secure verification.
       */
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // No return_url needed — we handle the result inline
        },
        redirect: 'if_required',
      });

      if (error) {
        // Show localized error from Stripe (e.g., "Your card was declined")
        setErrorMessage(error.message || 'Payment failed. Please try again.');
      } else {
        // Payment authorized successfully — the hold is placed
        onSuccess();
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred. Please try again.');
      console.error('[PaymentForm] Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert paise to rupees for display
  const fareInRupees = (amount / 100).toFixed(2);

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <div className={styles.lockIcon}>🔒</div>
        <h3 className={styles.title}>Secure Payment</h3>
        <p className={styles.subtitle}>
          Your card will be authorized for <span className={styles.amount}>₹{fareInRupees}</span>
        </p>
        <p className={styles.note}>
          You'll only be charged when the trip is completed
        </p>
      </div>

      <div className={styles.elementWrapper}>
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {errorMessage && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          {errorMessage}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.payButton}
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <>
              <span className={styles.spinner} />
              Processing...
            </>
          ) : (
            `Authorize ₹${fareInRupees}`
          )}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main PaymentForm Component ──────────────────────────────

/**
 * Wraps Stripe Elements with the client secret and renders the checkout form.
 *
 * The `clientSecret` comes from the server after creating a PaymentIntent.
 * It's passed to Elements as `options.clientSecret`, which tells Stripe.js
 * which PaymentIntent this form is for.
 */
export default function PaymentForm({
  clientSecret,
  amount,
  onSuccess,
  onCancel,
}: PaymentFormProps) {
  
  // Convert paise to rupees for display
  const fareInRupees = (amount / 100).toFixed(2);

  // If we are using the mock backend, skip Stripe completely
  if (clientSecret && clientSecret.startsWith('pi_mock_secret_')) {
    return (
      <div className={styles.overlay}>
        <div className={styles.card}>
          <div className={styles.form}>
            <div className={styles.header}>
              <div className={styles.lockIcon}>🛠️</div>
              <h3 className={styles.title}>Mock Payment (Local Dev)</h3>
              <p className={styles.subtitle}>
                Your card will be authorized for <span className={styles.amount}>₹{fareInRupees}</span>
              </p>
              <p className={styles.note}>
                Stripe API keys were not found in .env. Using bypass mode.
              </p>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.payButton}
                onClick={() => {
                  console.log("[PaymentForm] Mock authorization successful!");
                  onSuccess();
                }}
              >
                Mock Authorize ₹{fareInRupees}
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#00d4ff',
                colorBackground: '#1a1a2e',
                colorText: '#ffffff',
                colorDanger: '#ff4757',
                fontFamily: 'Inter, sans-serif',
                borderRadius: '12px',
                spacingUnit: '4px',
              },
              rules: {
                '.Input': {
                  backgroundColor: '#0d0d1a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'none',
                },
                '.Input:focus': {
                  border: '1px solid #00d4ff',
                  boxShadow: '0 0 8px rgba(0, 212, 255, 0.3)',
                },
                '.Label': {
                  color: '#a0a0b8',
                },
              },
            },
          }}
        >
          <CheckoutForm amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
        </Elements>
      </div>
    </div>
  );
}
