import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { Toaster } from '@/components/ui/sonner';
import { DocumentBranding } from '@/components/shared/DocumentBranding';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useAuthStore } from '@/lib/stores/auth-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    if (!isInitialized) {
      void fetchMe();
    }
  }, [isInitialized, fetchMe]);

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>
          <DocumentBranding />
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors />
        </AuthBootstrap>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
