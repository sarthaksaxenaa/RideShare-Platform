import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - RideShare',
  description: 'Privacy Policy for the RideShare platform.',
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
