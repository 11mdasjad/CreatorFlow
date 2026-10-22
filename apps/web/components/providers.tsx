'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastContext);
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 15000, refetchOnWindowFocus: false },
        },
      }),
  );
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (localStorage.getItem('creatorflow-theme') === 'dark')
      document.documentElement.dataset.theme = 'dark';
  }, []);
  return (
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={(message, error = false) => setToast({ message, error })}>
        {children}
        {toast && (
          <div
            className={`toast ${toast.error ? 'toast-error' : ''}`}
            role={toast.error ? 'alert' : 'status'}
          >
            {toast.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
            <span>{toast.message}</span>
            <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
              <X size={16} />
            </button>
          </div>
        )}
      </ToastContext.Provider>
    </QueryClientProvider>
  );
}
