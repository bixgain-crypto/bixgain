import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDataProvider } from "@/context/AppDataContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import Store from "./pages/Store";
import WalletPage from "./pages/WalletPage";
import Admin from "./pages/Admin";
import SpinToEarn from "./pages/SpinToEarn";
import Referrals from "./pages/Referrals";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Boosts from "./pages/Boosts";

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
            <Route path="/about" element={<About />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/missions" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
            <Route path="/tasks" element={<Navigate to="/missions" replace />} />
            <Route path="/spin" element={<ProtectedRoute><SpinToEarn /></ProtectedRoute>} />
            <Route path="/boosts" element={<ProtectedRoute><Boosts /></ProtectedRoute>} />
            <Route path="/mini-games" element={<Navigate to="/boosts" replace />} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/store" element={<ProtectedRoute><Store /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppDataProvider>
  </QueryClientProvider>
);

export default App;
