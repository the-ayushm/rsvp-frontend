"use client";
import SupportIconWrapper from "@/features/support/components/SupportIconServer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { ToastContainer } from "react-toastify";
import { JOB_TOAST_CONTAINER_ID } from "@/lib/job-toast";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/store/reduxStore";

import { CompanyProvider } from "@/context/CompanyContext";
import { ThemeProvider } from "@/theme";
import ThemeDrawer from "@/components/shell/ThemeDrawer";

const toastOptions = {
  style: {
    background: "var(--color-surface-raised)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--elevation-lg)",
    fontSize: "0.875rem",
  },
  success: { iconTheme: { primary: "var(--color-success)", secondary: "var(--color-surface)" } },
  error: { iconTheme: { primary: "var(--color-error)", secondary: "var(--color-surface)" } },
};

export const Providers = ({ children }: { children: React.ReactNode }) => {
  // One QueryClient per app lifetime (not per render)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 10, retry: 1 },
          mutations: { retry: 1 },
        },
      }),
  );

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <CompanyProvider>
            {children}
            <SupportIconWrapper />
            <ThemeDrawer />
            <Toaster position="top-center" toastOptions={toastOptions} />
            <ToastContainer
              containerId={JOB_TOAST_CONTAINER_ID}
              position="bottom-right"
              autoClose={false}
              closeOnClick={false}
              draggable={false}
              theme="light"
              toastClassName="job-progress-toast"
              style={{ zIndex: 99999 }}
            />
          </CompanyProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
};
