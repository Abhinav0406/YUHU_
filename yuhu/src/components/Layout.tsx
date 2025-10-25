
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import Header from './Header';
import FooterNavigation from './FooterNavigation';

interface LayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  showHeader?: boolean;
  hideFooter?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  requireAuth = false,
  showHeader = true,
  hideFooter = false
}) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Don't show header on chat page since it has its own header
  const isChatPage = location.pathname.startsWith('/chat');

  // Redirect to login if the page requires authentication and user is not authenticated
  if (requireAuth && !loading && !isAuthenticated) {
    navigate('/');
    return null;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-gradient-to-b from-yuhu-light to-white">
        <div className="relative">
          <Loader2 className="h-16 w-16 text-yuhu-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-white"></div>
          </div>
        </div>
        <p className="mt-4 text-yuhu-primary font-medium animate-pulse">Loading Yuhu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {showHeader && !isChatPage && <Header />}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      {!hideFooter && <FooterNavigation />}
    </div>
  );
};

export default Layout;
