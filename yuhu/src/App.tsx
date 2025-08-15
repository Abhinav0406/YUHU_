import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import CallHistory from "./pages/CallHistory";
import NotificationSettings from "./components/NotificationSettings";
import TestNotifications from "./pages/TestNotifications";
import TestWebRTC from "./pages/TestWebRTC";
import TestMultipleImages from "./pages/TestMultipleImages";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/call-history" element={<ProtectedRoute><CallHistory /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
            <Route path="/test-notifications" element={<ProtectedRoute><TestNotifications /></ProtectedRoute>} />
            <Route path="/test-webrtc" element={<ProtectedRoute><TestWebRTC /></ProtectedRoute>} />
            <Route path="/test-multiple-images" element={<ProtectedRoute><TestMultipleImages /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
