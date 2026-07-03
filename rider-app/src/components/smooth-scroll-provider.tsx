'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';

/**
 * SmoothScrollProvider
 * 
 * Initializes Lenis smooth scrolling for the entire application.
 * Uses requestAnimationFrame for buttery-smooth, 60fps+ scroll interpolation.
 * 
 * Lenis replaces the browser's native scroll behavior with a custom
 * inertia-based scroll that feels heavy, deliberate, and premium —
 * the same technique used by Studio Freight, Apple, and Stripe.
 */
export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,           // Scroll duration — higher = heavier feel
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Expo easeOut
      touchMultiplier: 1.5,    // Mobile touch scroll speed
      infinite: false,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
