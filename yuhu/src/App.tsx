import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { lazy, Suspense } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";

// Lazy load pages for code splitting
const Chat = lazy(() => import("./pages/Chat"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CallHistory = lazy(() => import("./pages/CallHistory"));
const Friends = lazy(() => import("./pages/Friends"));
const FriendRequests = lazy(() => import("./pages/FriendRequests"));
const NotificationSettings = lazy(() => import("./components/NotificationSettings"));
const TestNotifications = lazy(() => import("./pages/TestNotifications"));
const TestWebRTC = lazy(() => import("./pages/TestWebRTC"));
const TestMultipleImages = lazy(() => import("./pages/TestMultipleImages"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
  </div>
);

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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/friends-list" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
              <Route path="/friend-requests" element={<ProtectedRoute><FriendRequests /></ProtectedRoute>} />
              <Route path="/call-history" element={<ProtectedRoute><CallHistory /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
              <Route path="/test-notifications" element={<ProtectedRoute><TestNotifications /></ProtectedRoute>} />
              <Route path="/test-webrtc" element={<ProtectedRoute><TestWebRTC /></ProtectedRoute>} />
              <Route path="/test-multiple-images" element={<ProtectedRoute><TestMultipleImages /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
