import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'Manage your RideShare profile, saved locations, emergency contacts, and account settings.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
