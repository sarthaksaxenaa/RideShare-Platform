import { Metadata } from 'next';
import TrackTripClient from './track-client';

export const metadata: Metadata = {
  title: 'Live Trip Tracking - RideShare',
  description: 'Track this RideShare trip live for safety.',
  openGraph: {
    title: 'Live Trip Tracking - RideShare',
    description: 'Track this RideShare trip live for safety.',
    siteName: 'RideShare',
  }
};

export default function TrackPage({ params }: { params: { code: string } }) {
  return <TrackTripClient code={params.code} />;
}
