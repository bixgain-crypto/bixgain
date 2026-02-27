import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDataProvider } from "@/context/AppDataContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import Store from "./pages/Store";
import Boosts from "./pages/Boosts";
import Admin from "./pages/Admin";
import SpinToEarn from "./pages/SpinToEarn";
import Referrals from "./pages/Referrals";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppDataProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/missions" element={<Tasks />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/tasks" element={<Navigate to="/missions" replace />} />
            <Route path="/spin" element={<SpinToEarn />} />
            <Route path="/boosts" element={<Boosts />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/store" element={<Store />} />
            <Route path="/wallet" element={<Navigate to="/store" replace />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppDataProvider>
  </QueryClientProvider>
);

export default App;
