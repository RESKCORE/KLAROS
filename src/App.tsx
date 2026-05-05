import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClerkProvider, SignIn, SignUp } from "@clerk/react";
import { AuthProvider } from "@/contexts/ClerkAuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { loadMarketHistory, loadMarketMetrics } from "@/lib/market-metrics";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import DecisionResult from "./pages/DecisionResult";
import History from "./pages/History";
import ConnectData from "./pages/ConnectData";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ??
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  import.meta.env.CLERK_PUBLISHABLE_KEY;

function MissingConfigScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-xl rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Configuration Required</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Clerk publishable key is missing. Add one of the following variables to your local env file and restart the dev server.
        </p>
        <div className="rounded-md bg-muted/40 p-3 text-sm font-mono space-y-1">
          <div>VITE_CLERK_PUBLISHABLE_KEY=pk_...</div>
          <div>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...</div>
        </div>
      </div>
    </div>
  );
}

const App = () => {
  useEffect(() => {
    if (!CLERK_PUBLISHABLE_KEY || typeof window === "undefined") {
      return;
    }

    const schedule = () => {
      void loadMarketMetrics("dataset1");
      void loadMarketHistory("dataset1", 3);
    };

    const windowWithIdle = window as typeof window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (windowWithIdle.requestIdleCallback) {
      const id = windowWithIdle.requestIdleCallback(schedule, { timeout: 1500 });
      return () => windowWithIdle.cancelIdleCallback?.(id);
    }

    const timeout = window.setTimeout(schedule, 300);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {!CLERK_PUBLISHABLE_KEY ? (
          <MissingConfigScreen />
        ) : (
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ClerkProvider
              publishableKey={CLERK_PUBLISHABLE_KEY}
              signInUrl="/login"
              signUpUrl="/signup"
              signInFallbackRedirectUrl="/dashboard"
              signUpFallbackRedirectUrl="/dashboard"
            >
              <AuthProvider>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Index />} />
                  <Route
                    path="/login/*"
                    element={
                      <div className="min-h-screen flex items-center justify-center bg-background">
                        <SignIn
                          routing="path"
                          path="/login"
                          signUpUrl="/signup"
                          fallbackRedirectUrl="/dashboard"
                        />
                      </div>
                    }
                  />
                  <Route
                    path="/signup/*"
                    element={
                      <div className="min-h-screen flex items-center justify-center bg-background">
                        <SignUp
                          routing="path"
                          path="/signup"
                          signInUrl="/login"
                          fallbackRedirectUrl="/dashboard"
                        />
                      </div>
                    }
                  />
                  <Route path="/forgot-password" element={<Navigate to="/login" replace />} />

                  {/* Protected routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions/new"
                    element={
                      <Navigate to="/connect-data" replace />
                    }
                  />
                  <Route
                    path="/decisions/:id"
                    element={
                      <Navigate to="/dashboard" replace />
                    }
                  />
                  <Route
                    path="/decisions/:id/result"
                    element={
                      <ProtectedRoute>
                        <DecisionResult />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <ProtectedRoute>
                        <History />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/connect-data"
                    element={
                      <ProtectedRoute>
                        <ConnectData />
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthProvider>
            </ClerkProvider>
          </BrowserRouter>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
