import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - RideShare',
  description: 'Terms of Service for the RideShare platform.',
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
