'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import SmoothScrollProvider from '@/components/smooth-scroll-provider';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SmoothScrollProvider>
        {children}
      </SmoothScrollProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#f3f4f6',
            border: '1px solid #1f2937',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
    </QueryClientProvider>
  );
}

