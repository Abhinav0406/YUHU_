
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  showHeader?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  requireAuth = false,
  showHeader = true 
}) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

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
      {showHeader && <Header />}
      <main className="flex-1">{children}</main>
    </div>
  );
};

export default Layout;
