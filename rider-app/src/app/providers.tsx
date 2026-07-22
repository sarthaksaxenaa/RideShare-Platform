'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import SmoothScrollProvider from '@/components/smooth-scroll-provider';
import { useThemeStore } from '@/stores/theme-store';

export function Providers({ children }: { children: ReactNode }) {
  // Initialize theme on first render — syncs <html> class with stored pref
  const initializeTheme = useThemeStore((s) => s.initializeTheme);
  useEffect(() => { initializeTheme(); }, [initializeTheme]);
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

