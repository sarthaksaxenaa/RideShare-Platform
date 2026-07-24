import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'RideShare admin panel — manage users, view platform statistics, monitor trips, and track revenue.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
