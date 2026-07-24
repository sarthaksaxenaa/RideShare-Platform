import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trip History',
  description: 'View your complete trip history on RideShare — pickup/drop locations, fares, ratings, and trip details.',
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
