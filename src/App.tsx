import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import Index from "./pages/Index";
import CallYaara from "./pages/CallYaara";
import MusicPage from "./pages/MusicPage";
import GamesPage from "./pages/GamesPage";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Profile from "./pages/Profile";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/signin" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="relative min-h-screen w-full overflow-x-hidden bg-background md:pl-48">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/talk" element={<PrivateRoute><CallYaara /></PrivateRoute>} />
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/calls" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/music" element={<MusicPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
