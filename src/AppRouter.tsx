import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDataProvider } from "@/context/AppDataContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Initialize QueryClient outside of the component to prevent re-instantiation
const queryClient = new QueryClient();

/**
 * Helper to lazy load protected components.
 * This keeps the router config clean while enabling code splitting.
 */
const protectedLazy = (importFn: () => Promise<any>) => async () => {
  const { default: Component } = await importFn();
  return { element: <ProtectedRoute><Component /></ProtectedRoute> };
};

/**
 * Helper to lazy load public components.
 */
const publicLazy = (importFn: () => Promise<any>) => async () => {
  const { default: Component } = await importFn();
  return { Component };
};

const router = createBrowserRouter(
  [
    {
      path: '/',
      lazy: publicLazy(() => import('./pages/Index')),
    },
    {
      path: '/about',
      lazy: publicLazy(() => import('./pages/About')),
    },
    {
      path: '/auth',
      lazy: publicLazy(() => import('./pages/Auth')),
    },

    // Protected Routes
    { path: '/dashboard', lazy: protectedLazy(() => import('./pages/Dashboard')) },
    { path: '/profile', lazy: protectedLazy(() => import('./pages/Profile')) },
    { path: '/missions', lazy: protectedLazy(() => import('./pages/Tasks')) },
    { path: '/referrals', lazy: protectedLazy(() => import('./pages/Referrals')) },
    { path: '/spin', lazy: protectedLazy(() => import('./pages/SpinToEarn')) },
    { path: '/games', lazy: protectedLazy(() => import('./pages/Games')) },
    { path: '/games/:slug', lazy: protectedLazy(() => import('./pages/GameDetail')) },
    { path: '/leaderboard', lazy: protectedLazy(() => import('./pages/Leaderboard')) },
    { path: '/store', lazy: protectedLazy(() => import('./pages/Store')) },
    { path: '/wallet', lazy: protectedLazy(() => import('./pages/WalletPage')) },
    { path: '/admin', lazy: protectedLazy(() => import('./pages/Admin')) },

    // Redirects (matching App.tsx logic)
    { path: '/tasks', element: <Navigate to="/missions" replace /> },
    { path: '/boosts', element: <Navigate to="/games" replace /> },
    { path: '/mini-games', element: <Navigate to="/games" replace /> },

    // Catch-all
    {
      path: '*',
      lazy: publicLazy(() => import('./pages/NotFound')),
    },
  ],
  {
    future: {
      v7_normalizeFormMethod: true,
      v7_fetcherPersist: true,
      v7_partialHydration: true,
      v7_relativeSplatPath: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);

export const AppRouter = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RouterProvider 
            router={router} 
            future={{ v7_startTransition: true }} 
          />
        </TooltipProvider>
      </AppDataProvider>
    </QueryClientProvider>
  );
};